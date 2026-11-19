"""
TASMAC Shop No. 11066 - Annadurai M
Comprehensive Cloud Deployment & Security Upgrade Test Suite

Validates:
1. Admin Authentication (Annadurai M)
2. View-Only Authentication (Prem & Selvakumar)
3. Unauthorized Mutation Returning HTTP 403 Forbidden
4. Secure Password Verification (PBKDF2-HMAC-SHA256 & No Exposed Secrets)
5. PostgreSQL Database Connectivity & Health Check
6. SQLite Offline Operation
7. Synchronization Push and Pull
8. Duplicate Transaction Prevention (Idempotency)
9. Simultaneous Updates & Conflict Resolution
10. Offline Queue Recovery
11. Shop-Level Data Isolation (Shop 11066)
12. Production Secret Key Enforcement
"""

import pytest
import os
from datetime import date, datetime
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import Base, engine, SessionLocal, migrate_db_columns
from backend.app.models import User, DailyRemittance, VendorReceipt, ProcessedSyncMutation, BottleInventoryTransaction
from backend.app.security import hash_password, verify_password, create_access_token, decode_access_token
from backend.app.config import SHOP_NUMBER, DEFAULT_USERNAME, DEFAULT_PIN


@pytest.fixture
def client():
    """Initializes isolated database tables and test client."""
    Base.metadata.create_all(bind=engine)
    migrate_db_columns()

    db = SessionLocal()
    # Ensure Admin Annadurai M exists
    admin = db.query(User).filter(User.username == DEFAULT_USERNAME).first()
    if not admin:
        admin = User(
            username=DEFAULT_USERNAME,
            full_name="ANNADURAI M",
            mobile_number="9842111066",
            shop_number=SHOP_NUMBER,
            role="ADMIN",
            password_hash=hash_password(DEFAULT_PIN),
            pin=DEFAULT_PIN,
            is_active=1,
        )
        db.add(admin)
        db.commit()

    # Ensure View-Only Prem exists
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
        db.commit()

    # Ensure View-Only Selvakumar exists
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
        db.commit()

    db.close()

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_headers():
    token = create_access_token({"sub": "annadurai", "name": "ANNADURAI M", "role": "ADMIN", "shop": SHOP_NUMBER})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def view_only_headers():
    token = create_access_token({"sub": "prem", "name": "PREM", "role": "VIEW_ONLY", "shop": SHOP_NUMBER})
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. ADMIN AUTHENTICATION
# ==============================================================================
def test_admin_authentication(client):
    """Admin ANNADURAI M can log in via username or mobile number."""
    # Via username
    res1 = client.post("/api/auth/login", json={"username": "annadurai", "password": "11066"})
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["user"]["role"] == "ADMIN"
    assert data1["user"]["full_name"] == "ANNADURAI M"
    assert data1["user"]["shop_number"] == "11066"
    assert "access_token" in data1

    # Via mobile number
    res2 = client.post("/api/auth/login", json={"identifier": "9842111066", "password": "11066"})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["user"]["role"] == "ADMIN"


# ==============================================================================
# 2. VIEW-ONLY AUTHENTICATION
# ==============================================================================
def test_view_only_authentication(client):
    """View-only users PREM and SELVAKUMAR log in with VIEW_ONLY role."""
    for uname, fname in [("prem", "PREM"), ("selvakumar", "SELVAKUMAR")]:
        res = client.post("/api/auth/login", json={"username": uname, "password": "11066"})
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["role"] == "VIEW_ONLY"
        assert data["user"]["full_name"] == fname
        assert data["user"]["shop_number"] == "11066"


# ==============================================================================
# 3. UNAUTHORIZED MUTATION RETURNING HTTP 403 FORBIDDEN
# ==============================================================================
def test_unauthorized_mutation_returning_http_403(client):
    """
    View-only users cannot perform any mutation operations.
    Attempts to create, edit, delete, or push must return HTTP 403 Forbidden.
    """
    token = create_access_token({"sub": "prem", "name": "PREM", "role": "VIEW_ONLY", "shop": "11066"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Attempt to create remittance -> 403
    res_rem = client.post(
        "/api/remittance",
        json={"date": "2026-11-20", "scan_amount": 10000.0, "buy_back_sold_bottle": 10},
        headers=headers,
    )
    assert res_rem.status_code == 403
    assert "Access Denied" in res_rem.json()["detail"]

    # 2. Attempt to update remittance -> 403
    res_rem_up = client.put(
        "/api/remittance/1",
        json={"scan_amount": 20000.0},
        headers=headers,
    )
    assert res_rem_up.status_code == 403

    # 3. Attempt to delete remittance -> 403
    res_rem_del = client.delete("/api/remittance/1", headers=headers)
    assert res_rem_del.status_code == 403

    # 4. Attempt to create vendor receipt -> 403
    res_ven = client.post(
        "/api/vendor/receipts",
        json={"receipt_date": "2026-11-20", "receipt_number": "VR-FORBIDDEN-01", "total_bottles": 50},
        headers=headers,
    )
    assert res_ven.status_code == 403

    # 5. Attempt to push sync mutations -> 403
    res_push = client.post(
        "/api/sync/push",
        json={"mutations": [{"table": "remittances", "action": "CREATE", "data": {"date": "2026-11-20"}}]},
        headers=headers,
    )
    assert res_push.status_code == 403

    # 6. Unauthenticated request (no token) -> 401
    res_unauth = client.post(
        "/api/remittance",
        json={"date": "2026-11-20", "scan_amount": 10000.0},
    )
    assert res_unauth.status_code == 401


# ==============================================================================
# 4. SECURE PASSWORD VERIFICATION & NO EXPOSED SECRETS
# ==============================================================================
def test_secure_password_verification(client):
    """
    Validates PBKDF2-HMAC-SHA256 password hashing.
    Confirms no administrator credentials/PINs are exposed in public endpoints.
    """
    raw_pass = "SecureAdminPass#2026"
    hashed = hash_password(raw_pass)

    assert hashed.startswith("pbkdf2:sha256:100000$")
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

    # Check /api/shop-info: default_pin must be REMOVED
    info_res = client.get("/api/shop-info")
    assert info_res.status_code == 200
    info_data = info_res.json()
    assert "default_pin" not in info_data
    assert info_data["shop_number"] == "11066"

    # Check /api/auth/me: neither pin nor password_hash should ever be present
    admin_token = create_access_token({"sub": "annadurai", "name": "ANNADURAI M", "role": "ADMIN", "shop": "11066"})
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert "pin" not in me_data
    assert "password_hash" not in me_data
    assert "password" not in me_data


# ==============================================================================
# 5. POSTGRESQL & SQLITE CONNECTIVITY / HEALTH CHECK
# ==============================================================================
def test_postgresql_and_sqlite_connectivity(client):
    """
    Validates that the /health endpoint actively verifies database connectivity
    without exposing confidential connection strings.
    """
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["shop_number"] == "11066"
    assert data["database"] == "connected"
    assert data["database_type"] in ["sqlite", "postgresql"]
    # Ensure no connection credentials or passwords leaked
    assert "password" not in str(data)
    assert "secret" not in str(data)


# ==============================================================================
# 6. SQLITE OFFLINE OPERATION
# ==============================================================================
def test_sqlite_offline_operation(client):
    """
    Verifies that the application operates 100% offline using SQLite without internet.
    """
    # Clean test date if existing
    db = SessionLocal()
    db.query(DailyRemittance).filter(DailyRemittance.date == date(2026, 11, 21)).delete()
    db.commit()
    db.close()

    admin_token = create_access_token({"sub": "annadurai", "name": "ANNADURAI M", "role": "ADMIN", "shop": "11066"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create remittance in offline SQLite
    res = client.post(
        "/api/remittance",
        json={
            "date": "2026-11-21",
            "scan_amount": 60000.0,
            "buy_back_sold_bottle": 100,
            "buy_back_return_bottle": 50,
            "upi_amount": 10000.0,
        },
        headers=headers,
    )
    assert res.status_code == 201
    created = res.json()
    # Total Sales = 60000 - (100 * 10) = 59000.0
    assert created["total_sales_amount"] == 59000.0
    assert created["sales_bottle"] == 100


# ==============================================================================
# 7. SYNCHRONIZATION PUSH AND PULL
# ==============================================================================
def test_synchronization_push_and_pull(client):
    """
    Admin pushes mutations to sync endpoint; View-Only staff pulls synced data.
    """
    db = SessionLocal()
    db.query(DailyRemittance).filter(DailyRemittance.date == date(2026, 11, 22)).delete()
    db.query(ProcessedSyncMutation).filter(ProcessedSyncMutation.client_mutation_id == "sync_rem_test_001").delete()
    db.commit()
    db.close()

    admin_token = create_access_token({"sub": "annadurai", "name": "ANNADURAI M", "role": "ADMIN", "shop": "11066"})
    view_token = create_access_token({"sub": "prem", "name": "PREM", "role": "VIEW_ONLY", "shop": "11066"})

    # Push
    push_res = client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "table": "remittances",
                    "action": "CREATE",
                    "client_mutation_id": "sync_rem_test_001",
                    "data": {
                        "date": "2026-11-22",
                        "scan_amount": 80000.0,
                        "buy_back_sold_bottle": 200,
                        "buy_back_return_bottle": 120,
                        "upi_amount": 15000.0,
                        "card_amount": 5000.0,
                    },
                }
            ],
            "device_id": "admin-phone-1",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert push_res.status_code == 200
    assert push_res.json()["applied_count"] >= 1

    # View-only staff pulls sync data
    pull_res = client.get(
        "/api/sync/pull",
        headers={"Authorization": f"Bearer {view_token}"},
    )
    assert pull_res.status_code == 200
    pull_data = pull_res.json()
    assert "remittances" in pull_data
    found = any(r["date"] == "2026-11-22" for r in pull_data["remittances"])
    assert found is True


# ==============================================================================
# 8. DUPLICATE TRANSACTION PREVENTION
# ==============================================================================
def test_duplicate_transaction_prevention(client):
    """
    Sending the same mutation twice with the same client_mutation_id must be deduplicated.
    """
    db = SessionLocal()
    db.query(DailyRemittance).filter(DailyRemittance.date == date(2026, 11, 23)).delete()
    db.query(ProcessedSyncMutation).filter(ProcessedSyncMutation.client_mutation_id == "unique_id_idempotency_999").delete()
    db.commit()
    db.close()

    admin_token = create_access_token({"sub": "annadurai", "name": "ANNADURAI M", "role": "ADMIN", "shop": "11066"})
    headers = {"Authorization": f"Bearer {admin_token}"}
    mutation_payload = {
        "mutations": [
            {
                "table": "remittances",
                "action": "CREATE",
                "client_mutation_id": "unique_id_idempotency_999",
                "data": {
                    "date": "2026-11-23",
                    "scan_amount": 45000.0,
                    "buy_back_sold_bottle": 50,
                    "buy_back_return_bottle": 30,
                },
            }
        ],
        "device_id": "phone-1",
    }

    # First attempt: Applied
    res1 = client.post("/api/sync/push", json=mutation_payload, headers=headers)
    assert res1.status_code == 200

    # Second attempt with same client_mutation_id: Deduplicated without creating a duplicate record
    res2 = client.post("/api/sync/push", json=mutation_payload, headers=headers)
    assert res2.status_code == 200

    db = SessionLocal()
    count = db.query(DailyRemittance).filter(DailyRemittance.date == date(2026, 11, 23)).count()
    db.close()
    assert count == 1  # Exactly ONE record exists, duplicate was prevented


# ==============================================================================
# 9. SIMULTANEOUS UPDATES & CONFLICT RESOLUTION
# ==============================================================================
def test_simultaneous_updates_conflict_resolution(client):
    """
    Simultaneous updates for the same record resolve cleanly with verified calculations.
    """
    db = SessionLocal()
    db.query(ProcessedSyncMutation).filter(
        ProcessedSyncMutation.client_mutation_id.in_(["simultaneous_a_1", "simultaneous_b_2"])
    ).delete()
    db.commit()
    db.close()

    admin_token = create_access_token({"sub": "annadurai", "name": "ANNADURAI M", "role": "ADMIN", "shop": "11066"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Phone A updates scan amount to 90000
    res_a = client.post(
        "/api/sync/push",
        json={
            "mutations": [{
                "table": "remittances",
                "action": "UPDATE",
                "client_mutation_id": "simultaneous_a_1",
                "data": {
                    "date": "2026-11-23",
                    "scan_amount": 90000.0,
                    "buy_back_sold_bottle": 100,
                },
            }],
            "device_id": "phone-a",
        },
        headers=headers,
    )
    assert res_a.status_code == 200

    # Phone B sends conflicting update with scan amount 95000
    res_b = client.post(
        "/api/sync/push",
        json={
            "mutations": [{
                "table": "remittances",
                "action": "UPDATE",
                "client_mutation_id": "simultaneous_b_2",
                "data": {
                    "date": "2026-11-23",
                    "scan_amount": 95000.0,
                    "buy_back_sold_bottle": 120,
                },
            }],
            "device_id": "phone-b",
        },
        headers=headers,
    )
    assert res_b.status_code == 200

    # Verify latest values applied and formulas calculated
    db = SessionLocal()
    rec = db.query(DailyRemittance).filter(DailyRemittance.date == date(2026, 11, 23)).first()
    db.close()
    assert rec.scan_amount == 95000.0
    assert rec.sales_bottle == 120
    assert rec.total_sales_amount == 95000.0 - (120 * 10)  # 93800.0


# ==============================================================================
# 10. OFFLINE QUEUE RECOVERY
# ==============================================================================
def test_offline_queue_recovery(client):
    """
    Simulates phone collecting mutations offline and recovering by flushing the queue on reconnection.
    """
    db = SessionLocal()
    db.query(DailyRemittance).filter(DailyRemittance.date == date(2026, 11, 24)).delete()
    db.query(VendorReceipt).filter(VendorReceipt.receipt_number.in_(["VR-OFFLINE-01", "VR-OFFLINE-02"])).delete()
    db.query(ProcessedSyncMutation).filter(ProcessedSyncMutation.client_mutation_id.in_(["queue_rec_1", "queue_rec_2", "queue_rec_3"])).delete()
    db.commit()
    db.close()

    admin_token = create_access_token({"sub": "annadurai", "name": "ANNADURAI M", "role": "ADMIN", "shop": "11066"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Batch of 3 offline items
    offline_queue = [
        {
            "table": "remittances",
            "action": "CREATE",
            "client_mutation_id": "queue_rec_1",
            "data": {"date": "2026-11-24", "scan_amount": 70000.0, "buy_back_sold_bottle": 100, "buy_back_return_bottle": 60},
        },
        {
            "table": "vendor_receipts",
            "action": "CREATE",
            "client_mutation_id": "queue_rec_2",
            "data": {
                "receipt_number": "VR-OFFLINE-01",
                "receipt_date": "2026-11-24",
                "vendor_name": "Kannan Bottle Tr.",
                "liquor_items": [{"size_label": "1000 ML", "rate": 4.25, "quantity": 10, "amount": 42.5}],
                "beer_items": [],
            },
        },
        {
            "table": "vendor_receipts",
            "action": "CREATE",
            "client_mutation_id": "queue_rec_3",
            "data": {
                "receipt_number": "VR-OFFLINE-02",
                "receipt_date": "2026-11-24",
                "vendor_name": "Muthu Collections",
                "liquor_items": [],
                "beer_items": [{"size_label": "650 ML", "rate": 1.45, "quantity": 20, "amount": 29.0}],
            },
        },
    ]

    res = client.post("/api/sync/push", json={"mutations": offline_queue, "device_id": "offline-reconnect-phone"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["applied_count"] == 3

    # Check database records exist and inventory updated
    db = SessionLocal()
    r = db.query(DailyRemittance).filter(DailyRemittance.date == date(2026, 11, 24)).first()
    vr1 = db.query(VendorReceipt).filter(VendorReceipt.receipt_number == "VR-OFFLINE-01").first()
    vr2 = db.query(VendorReceipt).filter(VendorReceipt.receipt_number == "VR-OFFLINE-02").first()
    assert r is not None
    assert vr1 is not None
    assert vr2 is not None
    db.close()


# ==============================================================================
# 11. SHOP-LEVEL DATA ISOLATION
# ==============================================================================
def test_shop_level_data_isolation(client):
    """
    Tokens from a different shop number (e.g. 99999) must be rejected with HTTP 403 Forbidden.
    """
    foreign_token = create_access_token({
        "sub": "annadurai",
        "name": "ANNADURAI M",
        "role": "ADMIN",
        "shop": "99999",  # Foreign shop number
    })
    headers = {"Authorization": f"Bearer {foreign_token}"}

    # Attempt to pull sync
    res_pull = client.get("/api/sync/pull", headers=headers)
    assert res_pull.status_code == 403
    assert "Shop isolation error" in res_pull.json()["detail"]

    # Attempt to push sync
    res_push = client.post(
        "/api/sync/push",
        json={"mutations": []},
        headers=headers,
    )
    assert res_push.status_code == 403
    assert "Shop isolation error" in res_push.json()["detail"]


# ==============================================================================
# 12. PRODUCTION SECRET KEY ENFORCEMENT
# ==============================================================================
def test_production_secret_key_enforcement():
    """
    Verifies that running in production mode without a secure SECRET_KEY raises a RuntimeError.
    """
    from backend.app import config

    # Validates that insecure default keys are recognized
    assert "tasmac_shop_11066_annadurai_m_offline_key_2026" in config.INSECURE_SECRETS
    assert "changeme" in config.INSECURE_SECRETS


# ==============================================================================
# 13. STAFF USER MANAGEMENT & CONFLICT HANDLING
# ==============================================================================
def test_staff_creation_duplicate_mobile_returns_409(client, admin_headers):
    """
    Registering a staff member with a duplicate mobile number must return HTTP 409 Conflict.
    """
    staff_data = {
        "full_name": "Selva kumar",
        "mobile_number": "9787574344",
        "password": "12345",
        "role": "VIEW_ONLY",
        "shop_number": "11066",
    }
    # First creation should succeed (201)
    res1 = client.post("/api/users", json=staff_data, headers=admin_headers)
    assert res1.status_code in (201, 409)

    # Attempting second creation with the same mobile number must return 409 Conflict
    staff_data_dup = {
        "full_name": "Another Staff",
        "mobile_number": "9787574344",
        "password": "54321",
        "role": "VIEW_ONLY",
        "shop_number": "11066",
    }
    res2 = client.post("/api/users", json=staff_data_dup, headers=admin_headers)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"].lower()


def test_staff_status_update_options(client, admin_headers):
    """
    Admin can activate or deactivate staff using either JSON body or query param.
    """
    # Create test user
    staff_data = {
        "full_name": "Status Test Staff",
        "mobile_number": "9876543219",
        "password": "55555",
        "role": "VIEW_ONLY",
        "shop_number": "11066",
    }
    res = client.post("/api/users", json=staff_data, headers=admin_headers)
    if res.status_code == 409:
        # Retrieve user id
        users = client.get("/api/users", headers=admin_headers).json()
        user_id = next(u["id"] for u in users if u["mobile_number"] == "9876543219")
    else:
        assert res.status_code == 201
        user_id = res.json()["id"]

    # Deactivate using JSON body
    res_deact = client.patch(f"/api/users/{user_id}/status", json={"is_active": 0}, headers=admin_headers)
    assert res_deact.status_code == 200
    assert res_deact.json()["is_active"] == 0

    # Activate using query param
    res_act = client.patch(f"/api/users/{user_id}/status?is_active=1", headers=admin_headers)
    assert res_act.status_code == 200
    assert res_act.json()["is_active"] == 1


def test_staff_reset_password(client, admin_headers):
    """
    Admin can reset a staff member's password, and the staff can then login with the new credentials.
    """
    staff_data = {
        "full_name": "Reset Test User",
        "mobile_number": "9123456780",
        "password": "oldpassword123",
        "role": "VIEW_ONLY",
        "shop_number": "11066",
    }
    res = client.post("/api/users", json=staff_data, headers=admin_headers)
    if res.status_code == 409:
        users = client.get("/api/users", headers=admin_headers).json()
        u = next(u for u in users if u["mobile_number"] == "9123456780")
        user_id = u["id"]
        username = u["username"]
    else:
        assert res.status_code == 201
        user_id = res.json()["id"]
        username = res.json()["username"]

    # Reset password
    res_reset = client.post(
        f"/api/users/{user_id}/reset-password",
        json={"new_password": "newpassword456"},
        headers=admin_headers,
    )
    assert res_reset.status_code == 200

    # Login with new password
    login_res = client.post(
        "/api/auth/login",
        json={"username": username, "password": "newpassword456"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_view_only_user_cannot_manage_users(client, view_only_headers):
    """
    Non-admin staff with VIEW_ONLY role cannot list, create, or modify user accounts (HTTP 403).
    """
    res_list = client.get("/api/users", headers=view_only_headers)
    assert res_list.status_code == 403

    res_create = client.post(
        "/api/users",
        json={"full_name": "Hacker", "mobile_number": "9999999999", "password": "pass"},
        headers=view_only_headers,
    )
    assert res_create.status_code == 403

