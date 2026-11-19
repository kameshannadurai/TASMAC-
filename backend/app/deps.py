"""
TASMAC Shop No. 11066 - Annadurai M
FastAPI Authentication & Role-Based Authorization Dependencies
Enforces Shop-Level Isolation & Backend-Enforced Permissions
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token
from .config import SHOP_NUMBER


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Extracts user from Bearer token if provided; returns None otherwise."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    # Verify shop-level data isolation
    token_shop = payload.get("shop")
    if token_shop and str(token_shop) != str(SHOP_NUMBER):
        return None

    username = payload["sub"]
    user = db.query(User).filter(User.username == username, User.is_active == 1).first()
    return user


def require_authenticated(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """
    Enforces strict authentication and shop-level data isolation:
    1. Validates Bearer token presence and structure.
    2. Verifies cryptographic signature and session expiration.
    3. Validates shop number match against SHOP_NUMBER (11066).
    4. Validates user account exists, is active, and matches shop.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token for TASMAC Shop 11066.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate shop number in token for strict shop isolation
    token_shop = payload.get("shop")
    if token_shop and str(token_shop) != str(SHOP_NUMBER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Shop isolation error: Token shop '{token_shop}' does not match shop '{SHOP_NUMBER}'.",
        )

    username = payload["sub"]
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )
    if user.is_active != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated by Administrator ANNADURAI M.",
        )
    if user.shop_number and str(user.shop_number) != str(SHOP_NUMBER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to Shop 11066.",
        )
    return user


def require_admin(
    current_user: User = Depends(require_authenticated),
) -> User:
    """
    Enforces that the authenticated user has the ADMIN role (Annadurai M).
    View-only users receive HTTP 403 Forbidden.
    """
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Administrative privileges required. Only Admin ANNADURAI M can create, edit, or delete records.",
        )
    return current_user
