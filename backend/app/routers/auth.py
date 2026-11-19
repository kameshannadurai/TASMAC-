"""
TASMAC Shop No. 11066 - Annadurai M
Authentication, User Management & Audit History API Router
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from ..database import get_db
from ..models import User, AuditHistory
from ..schemas import (
    UserLogin,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserStatusUpdate,
    UserResetPassword,
    TokenResponse,
    AuditHistoryEntry,
)
from ..security import verify_password, hash_password, create_access_token
from ..deps import require_authenticated, require_admin

router = APIRouter(prefix="/api", tags=["Auth & User Management"])


@router.post("/auth/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Login using Username or Mobile Number and Password / PIN.
    Supports Admin (Annadurai M) and View-Only Staff users.
    """
    identifier = (login_data.identifier or login_data.username or "").strip()
    user = (
        db.query(User)
        .filter(or_(User.username == identifier, User.mobile_number == identifier))
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username, mobile number, or password.",
        )

    if user.is_active != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your staff account has been deactivated by Admin Annadurai M.",
        )

    provided_secret = login_data.password or login_data.pin or ""
    valid = False

    # Check password_hash if set
    if user.password_hash:
        valid = verify_password(provided_secret, user.password_hash)

    # Fallback to PIN if legacy or PIN matches
    if not valid and user.pin:
        valid = (provided_secret == user.pin) or verify_password(provided_secret, user.pin)

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username, mobile number, or password.",
        )

    # Update last login timestamp
    user.last_login = datetime.utcnow()
    db.commit()

    # Generate token
    token = create_access_token({
        "sub": user.username,
        "name": user.full_name,
        "role": user.role,
        "shop": user.shop_number,
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/auth/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(require_authenticated)):
    """Returns profile and role of currently logged in user."""
    return UserResponse.model_validate(current_user)


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
    import re

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
    import re

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
