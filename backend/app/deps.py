"""
TASMAC Shop No. 11066 - Annadurai M
FastAPI Authentication & Role-Based Authorization Dependencies
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Extracts user from Bearer token if provided; returns None otherwise (for backward compatibility)."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    username = payload["sub"]
    user = db.query(User).filter(User.username == username, User.is_active == 1).first()
    return user


def require_authenticated(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Enforces that the request has a valid, active user token."""
    user = get_current_user_optional(authorization, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in with your TASMAC Shop 11066 credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(
    current_user: User = Depends(require_authenticated),
) -> User:
    """Enforces that the authenticated user has the ADMIN role (Annadurai M)."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Administrative privileges required. Only Admin ANNADURAI M can create, edit, or delete records.",
        )
    return current_user

