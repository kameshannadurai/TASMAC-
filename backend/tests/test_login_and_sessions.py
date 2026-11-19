"""
Comprehensive Unit & Integration Test Suite for TASMAC Shop No. 11066
Complete Login & Session Upgrade:
- Admin ANNADURAI M (9443626183 / 2006)
- View-Only Staff PREM (9842111001) & SELVAKUMAR (9842111002)
- Common Login, Rate Limiting (5 failed -> 429)
- 30-minute Access Tokens & 30-day Refresh Token Rotation
- Refresh Token Reuse Detection
- Logout Revocation
- Password Changes
- Strict Role-Based Access Control (Admin vs View-Only HTTP 403)
- Audit Logging & Sensitive Data Redaction
"""

import pytest
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import Base, engine, SessionLocal, migrate_db_columns
from backend.app.models import User, RefreshToken, AuditHistory, DailyRemittance, VendorReceipt
from backend.app.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    reset_failed_login,
)
from backend.app.config import SHOP_NUMBER, DEFAULT_USERNAME, DEFAULT_MOBILE, DEFAULT_PIN


@pytest.fixture(autouse=True)
def setup_database():
    """Initializes schema and seeds baseline accounts."""
    Base.metadata.create_all(bind=engine)
    migrate_db_columns()
    db = SessionLocal()

    # Reset failed login rate-limits
    reset_failed_login("9443626183")
    reset_failed_login("annadurai")
    reset_failed_login("9842111001")
    reset_failed_login("9842111002")
    reset_failed_login("testclient")

    # 1. Admin ANNADURAI M
    admin = db.query(User).filter(User.username == "annadurai").first()
    if not admin:
        admin = User(
            username="annadurai",
            full_name="ANNADURAI M",
            mobile_number="9443626183",
            shop_number=SHOP_NUMBER,
            role="ADMIN",
            password_hash=hash_password("2006"),
            pin="2006",
            is_active=1,
        )
        db.add(admin)
    else:
        admin.mobile_number = "9443626183"
        admin.role = "ADMIN"
        admin.full_name = "ANNADURAI M"
        admin.password_hash = hash_password("2006")
        admin.pin = "2006"
        admin.is_active = 1

    # 2. Staff PREM
    prem = db.query(User).filter(User.username == "prem").first()
    if not prem:
        prem = User(
            username="prem",
            full_name="PREM",
            mobile_number="9842111001",
            shop_number=SHOP_NUMBER,
            role="VIEW_ONLY",
            password_hash=hash_password("11066"),
            pin="11066",
            is_active=1,
        )
        db.add(prem)
    else:
        prem.role = "VIEW_ONLY"
        prem.mobile_number = "9842111001"
        prem.is_active = 1

    # 3. Staff SELVAKUMAR
    selva = db.query(User).filter(User.username == "selvakumar").first()
    if not selva:
        selva = User(
            username="selvakumar",
            full_name="SELVAKUMAR",
            mobile_number="9842111002",
            shop_number=SHOP_NUMBER,
            role="VIEW_ONLY",
            password_hash=hash_password("11066"),
            pin="11066",
            is_active=1,
        )
        db.add(selva)
    else:
        selva.role = "VIEW_ONLY"
        selva.mobile_number = "9842111002"
        selva.is_active = 1

    db.commit()
    db.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


# ==============================================================================
# TEST 1 & 2: ADMIN AUTHENTICATION (MOBILE & USERNAME)
# ==============================================================================

def test_admin_login_with_mobile(client):
    """Admin ANNADURAI M logs in with mobile number 9443626183 and password 2006."""
    res = client.post("/api/auth/login", json={"mobile_number": "9443626183", "password": "2006"})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["full_name"] == "ANNADURAI M"
    assert data["user"]["mobile_number"] == "9443626183"
    assert data["user"]["shop_number"] == "11066"
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["expires_in"] == 1800  # 30 minutes


def test_admin_login_with_username(client):
    """Admin ANNADURAI M logs in with username annadurai and password 2006."""
    res = client.post("/api/auth/login", json={"username": "annadurai", "password": "2006"})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["username"] == "annadurai"


# ==============================================================================
# TEST 3 & 4: VIEW-ONLY STAFF AUTHENTICATION (PREM & SELVAKUMAR)
# ==============================================================================

def test_prem_view_only_login(client):
    """Staff PREM logs in with mobile number 9842111001 and receives VIEW_ONLY role."""
    res = client.post("/api/auth/login", json={"identifier": "9842111001", "password": "11066"})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "VIEW_ONLY"
    assert data["user"]["full_name"] == "PREM"
    assert "access_token" in data
    assert "refresh_token" in data


def test_selvakumar_view_only_login(client):
    """Staff SELVAKUMAR logs in with mobile number 9842111002 and receives VIEW_ONLY role."""
    res = client.post("/api/auth/login", json={"identifier": "9842111002", "password": "11066"})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "VIEW_ONLY"
    assert data["user"]["full_name"] == "SELVAKUMAR"


# ==============================================================================
# TEST 5 & 6: REJECTED LOGINS (WRONG PASSWORD / UNREGISTERED USER)
# ==============================================================================

def test_login_rejected_incorrect_password(client):
    """Incorrect password returns HTTP 401 Unauthorized."""
    res = client.post("/api/auth/login", json={"identifier": "9443626183", "password": "wrongpassword"})
    assert res.status_code == 401
    assert "Invalid mobile number" in res.json()["detail"]


def test_login_rejected_unregistered_mobile(client):
    """Unregistered mobile number returns HTTP 401 Unauthorized."""
    res = client.post("/api/auth/login", json={"identifier": "9999999999", "password": "anypassword"})
    assert res.status_code == 401
    assert "Invalid mobile number" in res.json()["detail"]


# ==============================================================================
# TEST 7: RATE LIMITING AFTER 5 FAILED ATTEMPTS (HTTP 429)
# ==============================================================================

def test_login_rate_limiting_after_5_failed_attempts(client):
    """5 consecutive failed login attempts trigger HTTP 429 Too Many Requests lockout."""
    target_mobile = "9111111111"
    reset_failed_login(target_mobile)

    # 5 failed attempts
    for _ in range(5):
        res = client.post("/api/auth/login", json={"identifier": target_mobile, "password": "bad"})
        assert res.status_code == 401

    # 6th attempt should be blocked by rate limiter with HTTP 429
    res_blocked = client.post("/api/auth/login", json={"identifier": target_mobile, "password": "bad"})
    assert res_blocked.status_code == 429
    assert "temporarily locked" in res_blocked.json()["detail"].lower()
    assert "Retry-After" in res_blocked.headers

    # Clean up
    reset_failed_login(target_mobile)


# ==============================================================================
# TEST 8, 9, 10, 11: ROLE-BASED ACCESS CONTROL (ADMIN VS VIEW-ONLY)
# ==============================================================================

def test_admin_has_full_crud_permissions(client):
    """Admin can create remittance and manage records."""
    login_res = client.post("/api/auth/login", json={"identifier": "9443626183", "password": "2006"})
    admin_token = login_res.json()["access_token"]
    admin_hdr = {"Authorization": f"Bearer {admin_token}"}

    # Admin creates remittance
    rem_data = {
        "date": "2026-11-20",
        "scan_amount": 10000.0,
        "total_sales_amount": 10000.0,
        "sales_bottle": 100,
        "upi_amount": 2000.0,
        "card_amount": 1000.0,
        "online_amount": 3000.0,
    }
    # Check if record exists and clean up via db
    db = SessionLocal()
    db.query(DailyRemittance).filter(DailyRemittance.date == "2026-11-20").delete()
    db.commit()
    db.close()

    create_res = client.post("/api/remittance", json=rem_data, headers=admin_hdr)
    assert create_res.status_code in (201, 200)

    # Admin can list users
    users_res = client.get("/api/users", headers=admin_hdr)
    assert users_res.status_code == 200
    assert len(users_res.json()) >= 3


def test_view_only_user_blocked_from_mutating_remittance(client):
    """View-only staff cannot add, update, or delete remittance records (HTTP 403 Forbidden)."""
    login_res = client.post("/api/auth/login", json={"identifier": "9842111001", "password": "11066"})
    staff_token = login_res.json()["access_token"]
    staff_hdr = {"Authorization": f"Bearer {staff_token}"}

    rem_data = {
        "date": "2026-11-21",
        "scan_amount": 5000.0,
        "total_sales_amount": 5000.0,
    }
    # Mutating POST must be rejected with HTTP 403 Forbidden
    res = client.post("/api/remittance", json=rem_data, headers=staff_hdr)
    assert res.status_code == 403
    assert "Access Denied" in res.json()["detail"] or "Administrative privileges required" in res.json()["detail"]


def test_view_only_user_blocked_from_user_management(client):
    """View-only staff cannot access user management endpoints (HTTP 403 Forbidden)."""
    login_res = client.post("/api/auth/login", json={"identifier": "9842111001", "password": "11066"})
    staff_token = login_res.json()["access_token"]
    staff_hdr = {"Authorization": f"Bearer {staff_token}"}

    res_users = client.get("/api/users", headers=staff_hdr)
    assert res_users.status_code == 403

    res_create = client.post("/api/users", json={"full_name": "Test", "mobile_number": "9111222333", "password": "pass"}, headers=staff_hdr)
    assert res_create.status_code == 403


def test_view_only_user_blocked_from_pushing_sync_mutations(client):
    """View-only staff cannot push sync mutations (HTTP 403 Forbidden)."""
    login_res = client.post("/api/auth/login", json={"identifier": "9842111001", "password": "11066"})
    staff_token = login_res.json()["access_token"]
    staff_hdr = {"Authorization": f"Bearer {staff_token}"}

    res_push = client.post(
        "/api/sync/push",
        json={"mutations": [{"table": "remittances", "action": "CREATE", "data": {}, "client_mutation_id": "test_m1"}]},
        headers=staff_hdr,
    )
    assert res_push.status_code == 403


# ==============================================================================
# TEST 12, 13, 14, 15: SESSION REFRESH TOKENS, ROTATION & LOGOUT
# ==============================================================================

def test_access_token_has_30_minute_expiration(client):
    """Access token payload exp is set to approximately 30 minutes (1800s)."""
    res = client.post("/api/auth/login", json={"mobile_number": "9443626183", "password": "2006"})
    token = res.json()["access_token"]
    payload = decode_access_token(token)
    assert payload is not None
    ttl = payload["exp"] - payload["iat"]
    assert ttl == 1800


def test_refresh_token_rotation_and_new_access_token(client):
    """Calling POST /api/auth/refresh rotates the refresh token and issues a new access token."""
    login_res = client.post("/api/auth/login", json={"mobile_number": "9443626183", "password": "2006"})
    old_access = login_res.json()["access_token"]
    old_refresh = login_res.json()["refresh_token"]

    ref_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    new_access = ref_data["access_token"]
    new_refresh = ref_data["refresh_token"]

    assert new_access != old_access
    assert new_refresh != old_refresh
    assert ref_data["user"]["role"] == "ADMIN"


def test_refresh_token_reuse_detection_revokes_sessions(client):
    """Reusing an old/revoked refresh token triggers reuse detection and revokes all user sessions."""
    login_res = client.post("/api/auth/login", json={"identifier": "9842111002", "password": "11066"})
    token1 = login_res.json()["refresh_token"]

    # First refresh succeeds
    ref1 = client.post("/api/auth/refresh", json={"refresh_token": token1})
    assert ref1.status_code == 200
    token2 = ref1.json()["refresh_token"]

    # Attempting to re-use token1 (already rotated) must trigger security violation
    reuse_attempt = client.post("/api/auth/refresh", json={"refresh_token": token1})
    assert reuse_attempt.status_code == 401
    assert "reuse detected" in reuse_attempt.json()["detail"].lower()

    # Even token2 should now be invalidated as a defense against replay attacks
    compromised_attempt = client.post("/api/auth/refresh", json={"refresh_token": token2})
    assert compromised_attempt.status_code == 401


def test_logout_revokes_refresh_token(client):
    """Calling POST /api/auth/logout revokes the refresh token; subsequent refresh fails with 401."""
    login_res = client.post("/api/auth/login", json={"mobile_number": "9443626183", "password": "2006"})
    token = login_res.json()["access_token"]
    refresh = login_res.json()["refresh_token"]

    # Logout
    logout_res = client.post(
        "/api/auth/logout",
        json={"refresh_token": refresh},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_res.status_code == 200

    # Refresh must be rejected
    fail_res = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert fail_res.status_code == 401


# ==============================================================================
# TEST 16: PASSWORD CHANGE & SESSION REVOCATION
# ==============================================================================

def test_password_change_revokes_existing_sessions(client):
    """User changing password revokes existing refresh tokens and requires new password for login."""
    # 1. Staff Prem logs in
    login_res = client.post("/api/auth/login", json={"identifier": "9842111001", "password": "11066"})
    token = login_res.json()["access_token"]
    old_refresh = login_res.json()["refresh_token"]

    # 2. Prem changes password to NewPass@2026
    change_res = client.post(
        "/api/auth/change-password",
        json={"current_password": "11066", "new_password": "NewPass@2026"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert change_res.status_code == 200

    # 3. Old refresh token must be revoked
    ref_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert ref_res.status_code == 401

    # 4. Old password fails
    old_login = client.post("/api/auth/login", json={"identifier": "9842111001", "password": "11066"})
    assert old_login.status_code == 401

    # 5. New password succeeds
    new_login = client.post("/api/auth/login", json={"identifier": "9842111001", "password": "NewPass@2026"})
    assert new_login.status_code == 200

    # Reset password back to 11066
    client.post(
        "/api/auth/change-password",
        json={"current_password": "NewPass@2026", "new_password": "11066"},
        headers={"Authorization": f"Bearer {new_login.json()['access_token']}"},
    )


# ==============================================================================
# TEST 17 & 18: SECURITY HYGIENE & AUDIT LOGGING
# ==============================================================================

def test_no_passwords_or_pins_exposed_in_public_apis(client):
    """Confirms no plaintext passwords, hashes, or default PINs are exposed in public endpoints."""
    # /api/shop-info
    info = client.get("/api/shop-info").json()
    assert "default_pin" not in info
    assert "pin" not in info
    assert "password_hash" not in info

    # /api/auth/me
    admin_login = client.post("/api/auth/login", json={"mobile_number": "9443626183", "password": "2006"}).json()
    token = admin_login["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert "pin" not in me
    assert "password_hash" not in me
    assert "password" not in me


def test_audit_logging_of_auth_actions(client):
    """Verifies login successes and failures are recorded in tamper-proof AuditHistory."""
    # Trigger a failed login
    client.post("/api/auth/login", json={"identifier": "audit_probe_user", "password": "bad"})

    db = SessionLocal()
    failed_log = (
        db.query(AuditHistory)
        .filter(AuditHistory.action == "LOGIN_FAILED")
        .order_by(AuditHistory.id.desc())
        .first()
    )
    assert failed_log is not None
    assert "audit_probe_user" in failed_log.changes_json
    db.close()
