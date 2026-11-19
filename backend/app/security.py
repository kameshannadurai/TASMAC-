"""
TASMAC Shop No. 11066 - Annadurai M
Security, Password Hashing & Token Authentication Engine
Uses Python standard library hashlib (PBKDF2-HMAC-SHA256), hmac, secrets
"""

import hmac
import hashlib
import secrets
import json
import base64
import time
from typing import Optional, Dict, Any

from .config import SECRET_KEY, TOKEN_EXPIRY_SECONDS, SHOP_NUMBER


def hash_password(password: str) -> str:
    """
    Hashes a password securely using PBKDF2-HMAC-SHA256 with a 16-byte random salt
    and 100,000 iterations.
    """
    if not password:
        password = "11066"
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against the stored PBKDF2 hash using constant-time comparison.
    Safely supports legacy PIN matching if unmigrated.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        parts = hashed_password.split("$")
        if len(parts) == 3 and parts[0].startswith("pbkdf2:sha256:"):
            iterations = int(parts[0].split(":")[2])
            salt = parts[1]
            stored_hash = parts[2]
            new_key = hashlib.pbkdf2_hmac(
                "sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), iterations
            )
            return hmac.compare_digest(new_key.hex(), stored_hash)

        # Legacy plain-text fallback (constant time comparison)
        return hmac.compare_digest(plain_password, hashed_password)
    except Exception:
        return False


def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding and padding < 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(payload: Dict[str, Any], expires_in: Optional[int] = None) -> str:
    """Creates a cryptographically signed JWT-compatible token using HMAC-SHA256."""
    header = {"alg": "HS256", "typ": "JWT"}
    body = dict(payload)
    now = int(time.time())
    ttl = expires_in if expires_in is not None else TOKEN_EXPIRY_SECONDS
    body["iat"] = now
    body["exp"] = now + ttl
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
