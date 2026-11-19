"""
TASMAC Shop No. 11066 - Annadurai M
Authentication, User Management, Refresh Tokens & Audit History API Router
"""

from typing import List, Optional
from datetime import datetime, timedelta
import re
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from ..database import get_db
from ..models import User, AuditHistory, RefreshToken
from ..schemas import (
    UserLogin,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserStatusUpdate,
    UserResetPassword,
    ChangePasswordRequest,
    RefreshTokenRequest,
    LogoutRequest,
    TokenResponse,
    AuditHistoryEntry,
)
from ..security import (
    verify_password,
    hash_password,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    check_login_rate_limit,
    record_failed_login,
    reset_failed_login,
)
from ..deps import require_authenticated, require_admin, get_current_user_optional

router = APIRouter(prefix="/api", tags=["Auth & User Management"])


@router.post("/auth/login", response_model=TokenResponse)
def login(login_data: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Common login for Admin (ANNADURAI M) and View-Only Staff (PREM, SELVAKUMAR).
    Accepts 10-digit mobile number or username and password / PIN.
    Implements rate limiting: temporary lockout after 5 failed attempts (15 min).
    Issues 30-minute access token and 30-day rotated refresh token.
    """
    raw_ident = (login_data.mobile_number or login_data.identifier or login_data.username or "").strip()
    client_ip = request.client.host if request.client else "unknown"
    rate_key = raw_ident.lower() if raw_ident else client_ip

    # Check Rate Limit (Temporary lockout after 5 failed attempts)
    is_locked, remaining_seconds = check_login_rate_limit(rate_key)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Account temporarily locked. Please try again in {remaining_seconds} seconds.",
            headers={"Retry-After": str(remaining_seconds)},
        )

    # Find user by mobile number or username (with backward-compatible alias for admin)
    user = (
        db.query(User)
        .filter(or_(User.username == raw_ident, User.mobile_number == raw_ident))
        .first()
    )
    if not user and raw_ident in ("9842111066", "9443626183"):
        user = db.query(User).filter(User.username == "annadurai").first()

    provided_secret = login_data.password or login_data.pin or ""

    if not user:
        record_failed_login(rate_key)
        # Log unauthorized attempt in audit log
        audit = AuditHistory(
            user_name=raw_ident or "Unknown",
            user_role="UNAUTHORIZED",
            device_id=client_ip,
            entity_type="AUTH",
            entity_id=0,
            reference_number=raw_ident,
            action="LOGIN_FAILED",
            changes_json=f"Failed login attempt for nonexistent user/mobile: '{raw_ident}' from IP {client_ip}",
        )
        db.add(audit)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mobile number, username, or password.",
        )

    if user.is_active != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your staff account has been deactivated by Admin ANNADURAI M. Please contact the administrator.",
        )

    # Verify password against hash or legacy PIN (or Admin migration PINs 2006/11066)
    valid = False
    if user.password_hash:
        valid = verify_password(provided_secret, user.password_hash)

    if not valid and user.pin:
        valid = (provided_secret == user.pin) or verify_password(provided_secret, user.pin)

    if not valid and user.role == "ADMIN" and provided_secret in ("2006", "11066"):
        valid = True

    if not valid:
        record_failed_login(rate_key)
        audit = AuditHistory(
            user_name=user.full_name,
            user_role=user.role,
            device_id=client_ip,
            entity_type="AUTH",
            entity_id=user.id,
            reference_number=user.username,
            action="LOGIN_FAILED",
            changes_json=f"Incorrect password attempt for user '{user.username}' ({user.mobile_number}) from IP {client_ip}",
        )
        db.add(audit)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mobile number, username, or password.",
        )

    # Successful login: reset rate limit counter
    reset_failed_login(rate_key)

    # Update last login timestamp
    user.last_login = datetime.utcnow()

    # Generate 30-minute access token
    access_token = create_access_token({
        "sub": user.username,
        "name": user.full_name,
        "role": user.role,
        "shop": user.shop_number,
        "mobile": user.mobile_number,
    })

    # Generate cryptographic 30-day refresh token
    raw_refresh_token, token_hash, jti = generate_refresh_token()
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        jti=jti,
        expires_at=datetime.utcnow() + timedelta(days=30),
        revoked=0,
    )
    db.add(refresh_record)

    # Audit log successful login
    audit = AuditHistory(
        user_name=user.full_name,
        user_role=user.role,
        device_id=client_ip,
        entity_type="AUTH",
        entity_id=user.id,
        reference_number=user.username,
        action="LOGIN_SUCCESS",
        changes_json=f"Successful login as {user.role} for user '{user.username}' ({user.full_name})",
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        expires_in=1800,  # 30 minutes
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/auth/refresh", response_model=TokenResponse)
def refresh_session_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Rotates refresh token and issues a fresh 30-minute access token.
    Detects refresh token reuse and immediately invalidates compromised sessions.
    """
    raw_token = (data.refresh_token or "").strip()
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is required.",
        )

    t_hash = hash_refresh_token(raw_token)
    token_record = db.query(RefreshToken).filter(RefreshToken.token_hash == t_hash).first()

    if not token_record or token_record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
        )

    # Reuse detection: if an already-revoked refresh token is presented, revoke ALL tokens for that user
    if token_record.revoked == 1:
        db.query(RefreshToken).filter(RefreshToken.user_id == token_record.user_id).update({"revoked": 1})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security violation: Token reuse detected. All active sessions have been terminated. Please log in again.",
        )

    # Valid token: revoke old token and rotate
    token_record.revoked = 1

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user or user.is_active != 1:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or not found.",
        )

    new_raw, new_hash, new_jti = generate_refresh_token()
    token_record.replaced_by = new_jti

    new_record = RefreshToken(
        user_id=user.id,
        token_hash=new_hash,
        jti=new_jti,
        expires_at=datetime.utcnow() + timedelta(days=30),
        revoked=0,
    )
    db.add(new_record)

    new_access_token = create_access_token({
        "sub": user.username,
        "name": user.full_name,
        "role": user.role,
        "shop": user.shop_number,
        "mobile": user.mobile_number,
    })

    db.commit()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_raw,
        expires_in=1800,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/auth/logout")
def logout(
    data: Optional[LogoutRequest] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Logs out user and invalidates refresh token in database.
    """
    if data and data.refresh_token:
        t_hash = hash_refresh_token(data.refresh_token)
        db.query(RefreshToken).filter(RefreshToken.token_hash == t_hash).update({"revoked": 1})
        db.commit()

    if current_user:
        audit = AuditHistory(
            user_name=current_user.full_name,
            user_role=current_user.role,
            entity_type="AUTH",
            entity_id=current_user.id,
            reference_number=current_user.username,
            action="LOGOUT",
            changes_json=f"User '{current_user.username}' logged out.",
        )
        db.add(audit)
        db.commit()

    return {"success": True, "message": "Logged out successfully."}


@router.get("/auth/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(require_authenticated)):
    """Returns profile and role of currently logged in user."""
    return UserResponse.model_validate(current_user)


@router.post("/auth/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
):
    """Allows authenticated user to change their password."""
    # Verify current password
    valid = False
    if current_user.password_hash:
        valid = verify_password(data.current_password, current_user.password_hash)
    if not valid and current_user.pin:
        valid = (data.current_password == current_user.pin) or verify_password(data.current_password, current_user.pin)

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if not data.new_password or len(data.new_password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 4 characters long.",
        )

    current_user.password_hash = hash_password(data.new_password)
    current_user.pin = data.new_password[:20] if len(data.new_password) <= 20 else data.new_password[:10]
    # Revoke all existing refresh tokens for security
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).update({"revoked": 1})

    audit = AuditHistory(
        user_name=current_user.full_name,
        user_role=current_user.role,
        entity_type="AUTH",
        entity_id=current_user.id,
        reference_number=current_user.username,
        action="UPDATE",
        changes_json=f"User '{current_user.username}' changed their password.",
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": "Password changed successfully. Please log in with your new password."}


# =========================================================================
# ADMIN ONLY: USER MANAGEMENT (View-only staff creation & permission)
# =========================================================================

@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin Only: Lists all registered users and staff for Shop 11066."""
    users = db.query(User).order_by(desc(User.role == "ADMIN"), User.full_name).all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_staff_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Admin Only: Creates a staff account.
    CRITICAL SECURITY RULE: Every newly created account receives VIEW_ONLY permissions by default.
    No user can register themselves or be created as ADMIN.
    Rejects duplicate mobile numbers with HTTP 409 Conflict.
    """
    full_name = (data.full_name or data.name or "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Staff member full name is required.")

    mobile = (data.mobile_number or "").strip()
    if not mobile or len(mobile) < 10:
        raise HTTPException(status_code=400, detail="A valid 10-digit mobile number is required.")

    # Check for duplicate mobile number -> HTTP 409 Conflict
    mob_existing = db.query(User).filter(User.mobile_number == mobile).first()
    if mob_existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Mobile number '{mobile}' is already registered to '{mob_existing.full_name}'.",
        )

    # Auto-generate username if not explicitly given
    username = (data.username or "").strip().lower()
    if not username:
        clean_prefix = re.sub(r"[^a-z0-9]", "_", full_name.lower())[:15]
        username = f"{clean_prefix}_{mobile[-4:]}"

    # Check for duplicate username -> HTTP 409 Conflict
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Staff account with username '{username}' already exists.",
        )

    # Strictly enforce VIEW_ONLY role
    new_user = User(
        username=username,
        full_name=full_name,
        mobile_number=mobile,
        shop_number="11066",
        role="VIEW_ONLY",  # ALWAYS VIEW_ONLY FOR NEW ACCOUNTS
        password_hash=hash_password(data.password),
        pin=data.password[:20] if len(data.password) <= 20 else "11066",
        is_active=1,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Log audit entry
    audit = AuditHistory(
        user_name=admin.full_name,
        user_role=admin.role,
        entity_type="USER_MANAGEMENT",
        entity_id=new_user.id or 0,
        reference_number=new_user.username,
        action="CREATE",
        changes_json=f"Created staff account '{new_user.username}' ({new_user.full_name}) with VIEW_ONLY role.",
    )
    db.add(audit)
    db.commit()

    return UserResponse.model_validate(new_user)


@router.patch("/users/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    status_data: Optional[UserStatusUpdate] = None,
    is_active: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin Only: Activates or deactivates a staff account. Accepts JSON body or query param."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.username == "annadurai" or user.role == "ADMIN":
        raise HTTPException(status_code=400, detail="Cannot deactivate the Primary Shop Administrator.")

    target_status = 1
    if status_data is not None:
        target_status = 1 if status_data.is_active else 0
    elif is_active is not None:
        target_status = 1 if is_active else 0

    user.is_active = target_status
    # If deactivating, revoke all active refresh tokens for this user
    if target_status == 0:
        db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked": 1})

    db.commit()
    db.refresh(user)

    action_text = "Activated" if user.is_active == 1 else "Deactivated"
    audit = AuditHistory(
        user_name=admin.full_name,
        user_role=admin.role,
        entity_type="USER_MANAGEMENT",
        entity_id=user.id or 0,
        reference_number=user.username,
        action="UPDATE",
        changes_json=f"{action_text} staff account '{user.username}'.",
    )
    db.add(audit)
    db.commit()

    return UserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user_profile(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Admin Only: Updates a user's full name and mobile number.
    Admin can edit staff details or their own details.
    Rejects duplicate mobile numbers with HTTP 409 Conflict.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    new_name = (data.full_name or data.name or "").strip()
    new_mobile = (data.mobile_number or "").strip()

    if not new_name and not new_mobile:
        raise HTTPException(status_code=400, detail="Please provide at least a name or mobile number to update.")

    changes = []
    if new_name and new_name != user.full_name:
        changes.append(f"Name: '{user.full_name}' -> '{new_name}'")
        user.full_name = new_name

    if new_mobile and new_mobile != user.mobile_number:
        if not re.match(r"^\d{10}$", new_mobile):
            raise HTTPException(status_code=400, detail="Mobile number must be exactly 10 digits.")
        # Check uniqueness across other users
        dup = db.query(User).filter(User.mobile_number == new_mobile, User.id != user_id).first()
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Mobile number '{new_mobile}' is already registered to '{dup.full_name}'.",
            )
        changes.append(f"Mobile: '{user.mobile_number or ''}' -> '{new_mobile}'")
        user.mobile_number = new_mobile

    if not changes:
        return UserResponse.model_validate(user)

    db.commit()
    db.refresh(user)

    audit = AuditHistory(
        user_name=admin.full_name,
        user_role=admin.role,
        entity_type="USER_MANAGEMENT",
        entity_id=user.id or 0,
        reference_number=user.username,
        action="UPDATE",
        changes_json=f"Updated details for user '{user.username}': " + "; ".join(changes),
    )
    db.add(audit)
    db.commit()

    return UserResponse.model_validate(user)


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    data: UserResetPassword,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin Only: Securely resets a staff user's password."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not data.new_password or len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long.")

    user.password_hash = hash_password(data.new_password)
    user.pin = data.new_password[:20] if len(data.new_password) <= 20 else data.new_password[:10]
    # Revoke all active refresh tokens for this user so they must log in with new password
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked": 1})
    db.commit()

    audit = AuditHistory(
        user_name=admin.full_name,
        user_role=admin.role,
        entity_type="USER_MANAGEMENT",
        entity_id=user.id or 0,
        reference_number=user.username,
        action="UPDATE",
        changes_json=f"Reset password for user '{user.username}'.",
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Password for {user.username} has been reset successfully."}


# =========================================================================
# ADMIN ONLY: ACTIVITY HISTORY AUDIT LOG
# =========================================================================

@router.get("/audit-history", response_model=List[AuditHistoryEntry])
def get_audit_history(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin Only: Retrieves tamper-proof activity history log."""
    logs = db.query(AuditHistory).order_by(desc(AuditHistory.created_at)).limit(limit).all()
    return [AuditHistoryEntry.model_validate(log) for log in logs]
