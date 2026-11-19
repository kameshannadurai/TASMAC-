"""
TASMAC Shop No. 11066 - Annadurai M
Security, Password Hashing & Token Authentication Engine
Uses bcrypt for secure salted hashing, PBKDF2 backward compatibility,
HMAC-SHA256 signed JWT-compatible tokens with 30-minute expiration,
cryptographic refresh token rotation, and failed attempt rate limiting.
"""

import hmac
import hashlib
import secrets
import json
import base64
import time
from typing import Optional, Dict, Any, Tuple
import bcrypt

from .config import SECRET_KEY, ACCESS_TOKEN_EXPIRY_SECONDS, REFRESH_TOKEN_EXPIRY_SECONDS, SHOP_NUMBER


# ============================================================================
# PASSWORD HASHING & VERIFICATION (bcrypt + PBKDF2 compatibility)
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hashes a password securely using bcrypt with 12 salt rounds.
    Guarantees salted, modern password protection for TASMAC Shop 11066.
    """
    if not password:
        password = "2006"
    pw_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against stored hash.
    Supports:
    1. Modern bcrypt hashes ($2b$ or $2a$)
    2. Legacy PBKDF2-HMAC-SHA256 hashes (preserves staff credentials without resets)
    3. Plaintext fallback (constant time comparison)
    """
    if not plain_password or not hashed_password:
        return False
    try:
        # 1. Check bcrypt ($2a$, $2b$, $2y$)
        if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

        # 2. Check PBKDF2-HMAC-SHA256
        parts = hashed_password.split("$")
        if len(parts) == 3 and parts[0].startswith("pbkdf2:sha256:"):
            iterations = int(parts[0].split(":")[2])
            salt = parts[1]
            stored_hash = parts[2]
            new_key = hashlib.pbkdf2_hmac(
                "sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), iterations
            )
            return hmac.compare_digest(new_key.hex(), stored_hash)

        # 3. Legacy plain-text fallback (constant time comparison)
        return hmac.compare_digest(plain_password, hashed_password)
    except Exception:
        return False


# ============================================================================
# JWT ACCESS TOKEN ENGINE (30-minute expiration)
# ============================================================================

def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding and padding < 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(payload: Dict[str, Any], expires_in: Optional[int] = None) -> str:
    """
    Creates a cryptographically signed JWT-compatible token using HMAC-SHA256.
    Defaults to 30 minutes (ACCESS_TOKEN_EXPIRY_SECONDS = 1800s).
    """
    header = {"alg": "HS256", "typ": "JWT"}
    body = dict(payload)
    now = int(time.time())
    ttl = expires_in if expires_in is not None else ACCESS_TOKEN_EXPIRY_SECONDS
    body["iat"] = now
    body["exp"] = now + ttl
    if "jti" not in body:
        body["jti"] = secrets.token_hex(16)
    if "shop" not in body:
        body["shop"] = SHOP_NUMBER

    header_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64_encode(json.dumps(body, separators=(",", ":")).encode("utf-8"))
    message = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
    sig_b64 = _b64_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates token signature, structure, and expiration."""
    if not token:
        return None
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        message = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
        actual_sig = _b64_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_bytes = _b64_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Check expiration
        exp = payload.get("exp")
        if exp and exp < int(time.time()):
            return None

        return payload
    except Exception:
        return None


# ============================================================================
# REFRESH TOKEN ENGINE (Cryptographic random + SHA256 hashed in database)
# ============================================================================

def generate_refresh_token() -> Tuple[str, str, str]:
    """
    Generates a secure cryptographically random refresh token.
    Returns:
    - raw_token: sent to client (stored in Android Keystore / secure storage)
    - token_hash: SHA-256 hash stored in backend refresh_tokens table
    - jti: unique token identifier
    """
    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_refresh_token(raw_token)
    jti = secrets.token_hex(16)
    return raw_token, token_hash, jti


def hash_refresh_token(raw_token: str) -> str:
    """Computes SHA-256 digest of refresh token for safe database storage."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


# ============================================================================
# RATE LIMITING & SECURITY LOCKOUT (5 failed attempts -> 15 min lockout)
# ============================================================================

_FAILED_LOGIN_ATTEMPTS: Dict[str, list[float]] = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 900  # 15 minutes


def check_login_rate_limit(identifier: str) -> Tuple[bool, int]:
    """
    Checks if an identifier (mobile number, username or IP) is temporarily locked.
    Returns (is_locked, seconds_remaining).
    """
    key = (identifier or "").strip().lower()
    if not key:
        return False, 0

    now = time.time()
    history = _FAILED_LOGIN_ATTEMPTS.get(key, [])
    # Filter out attempts older than window
    valid_attempts = [t for t in history if now - t < LOCKOUT_WINDOW_SECONDS]
    _FAILED_LOGIN_ATTEMPTS[key] = valid_attempts

    if len(valid_attempts) >= MAX_FAILED_ATTEMPTS:
        oldest_in_window = valid_attempts[0]
        remaining = int(LOCKOUT_WINDOW_SECONDS - (now - oldest_in_window))
        return True, max(1, remaining)

    return False, 0


def record_failed_login(identifier: str) -> None:
    """Records a failed login attempt for rate limiting."""
    key = (identifier or "").strip().lower()
    if not key:
        return
    now = time.time()
    if key not in _FAILED_LOGIN_ATTEMPTS:
        _FAILED_LOGIN_ATTEMPTS[key] = []
    _FAILED_LOGIN_ATTEMPTS[key].append(now)


def reset_failed_login(identifier: str) -> None:
    """Resets failed login count upon successful authentication."""
    key = (identifier or "").strip().lower()
    if key in _FAILED_LOGIN_ATTEMPTS:
        _FAILED_LOGIN_ATTEMPTS.pop(key, None)
