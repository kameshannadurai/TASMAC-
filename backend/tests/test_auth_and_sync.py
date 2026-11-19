"""
Unit and Integration Tests for TASMAC Shop No. 11066
Multi-User Authentication, Role-Based Access Control & Sync
"""

import pytest
from datetime import date
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import Base, engine, SessionLocal, migrate_db_columns
from backend.app.models import User, DailyRemittance
from backend.app.security import hash_password, create_access_token


@pytest.fixture
def client():
    # Setup test DB
    Base.metadata.create_all(bind=engine)
    migrate_db_columns()
    db = SessionLocal()
    # Seed admin user
    admin = db.query(User).filter(User.username == "annadurai").first()
    if not admin:
        admin = User(
            username="annadurai",
            full_name="ANNADURAI M",
            mobile_number="9842111066",
            shop_number="11066",
            role="ADMIN",
            password_hash=hash_password("11066"),
            pin="11066",
            is_active=1,
        )
        db.add(admin)
        db.commit()
    db.close()

    with TestClient(app) as test_client:
        yield test_client


def test_admin_login_success(client):
    res = client.post("/api/auth/login", json={"username": "annadurai", "password": "11066"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["full_name"] == "ANNADURAI M"


def test_admin_login_by_mobile(client):
    res = client.post("/api/auth/login", json={"username": "9842111066", "password": "11066"})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "ADMIN"


def test_login_invalid_password(client):
    res = client.post("/api/auth/login", json={"username": "annadurai", "password": "wrong_password"})
    assert res.status_code == 401


def test_admin_creates_view_only_staff(client):
    db = SessionLocal()
    db.query(User).filter(User.username == "kumar_staff").delete()
    db.commit()
    db.close()

    # Log in as admin
    admin_login = client.post("/api/auth/login", json={"username": "annadurai", "password": "11066"}).json()
    admin_token = admin_login["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create new staff user
    create_res = client.post(
        "/api/users",
        json={
            "username": "kumar_staff",
            "full_name": "Kumar S",
            "mobile_number": "9876543210",
            "password": "staffpass123",
            "role": "ADMIN",  # Attempting to assign ADMIN role should be OVERRIDDEN to VIEW_ONLY!
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    staff_data = create_res.json()
    # Enforce Rule: Every newly created account receives VIEW_ONLY permissions
    assert staff_data["role"] == "VIEW_ONLY"
    assert staff_data["username"] == "kumar_staff"

    # Staff logs in
    staff_login = client.post("/api/auth/login", json={"username": "kumar_staff", "password": "staffpass123"}).json()
    assert "access_token" in staff_login
    assert staff_login["user"]["role"] == "VIEW_ONLY"


def test_view_only_user_cannot_mutate_remittance(client):
    db = SessionLocal()
    staff = db.query(User).filter(User.username == "kumar_staff").first()
    if not staff:
        staff = User(
            username="kumar_staff",
            full_name="Kumar S",
            role="VIEW_ONLY",
            pin="staff123",
            password_hash=hash_password("staffpass123"),
            is_active=1,
        )
        db.add(staff)
        db.commit()
    db.close()

    staff_token = create_access_token({
        "sub": "kumar_staff",
        "name": "Kumar S",
        "role": "VIEW_ONLY",
        "shop": "11066",
    })
    headers = {"Authorization": f"Bearer {staff_token}"}

    # Attempt to create a remittance record directly via API
    mutate_res = client.post(
        "/api/remittance",
        json={
            "date": "2026-11-18",
            "scan_amount": 50000.0,
            "buy_back_sold_bottle": 100,
        },
        headers=headers,
    )
    # Must be rejected with 403 Forbidden!
    assert mutate_res.status_code == 403
    assert "Access Denied" in mutate_res.json()["detail"]


def test_sync_pull_and_push(client):
    admin_token = create_access_token({
        "sub": "annadurai",
        "name": "ANNADURAI M",
        "role": "ADMIN",
        "shop": "11066",
    })
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin pushes mutation
    push_res = client.post(
        "/api/sync/push",
        json={
            "mutations": [
                {
                    "table": "remittances",
                    "action": "CREATE",
                    "data": {
                        "date": "2026-11-17",
                        "scan_amount": 75000.0,
                        "buy_back_sold_bottle": 150,
                        "buy_back_return_bottle": 80,
                        "upi_amount": 10000.0,
                        "card_amount": 5000.0,
                    },
                }
            ],
            "device_id": "phone-1-redmi9",
        },
        headers=headers,
    )
    assert push_res.status_code == 200
    assert push_res.json()["applied_count"] == 1

    # Phone 2 pulls sync data
    pull_res = client.get("/api/sync/pull", headers=headers)
    assert pull_res.status_code == 200
    data = pull_res.json()
    assert len(data["remittances"]) >= 1
    found = any(r["date"] == "2026-11-17" for r in data["remittances"])
    assert found
