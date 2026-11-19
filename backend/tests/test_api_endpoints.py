"""
API Router Function Tests (No socket/network needed, fully sandbox-friendly)
"""

import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.schemas import (
    RemittanceCreate,
    VendorReceiptCreate,
    ReceiptItemInput,
)
from backend.app.routers import remittance, vendor, inventory, reports


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def test_vendor_rates_router():
    rates = vendor.get_standard_rates()
    assert len(rates["liquor_rates"]) == 4
    assert len(rates["beer_rates"]) == 3
    assert rates["liquor_rates"][0]["rate"] == 4.25
    assert rates["beer_rates"][0]["rate"] == 1.45


def test_remittance_router_crud(db_session):
    # Create
    item = remittance.create_remittance(
        RemittanceCreate(
            date=date(2026, 11, 5),
            scan_amount=25000.0,
            upi_amount=5000.0,
            card_amount=3000.0,
            online_amount=7000.0,
            buy_back_sold_bottle=50,   # 50 * 10 = 500
            buy_back_return_bottle=100, # 100 * 10 = 1000
        ),
        db=db_session,
    )
    # Total Sales = 25000 - 500 = 24500
    assert item.total_sales_amount == 24500.0
    assert item.sales_bottle == 50
    # Actual Cash Submitted = 25000 - 500 - 5000 - 3000 - 1000 = 15500.0
    assert item.actual_cash_submitted == 15500.0

    # Read
    fetched = remittance.get_remittance(item.id, db=db_session)
    assert fetched.date == date(2026, 11, 5)

    # Check inventory summary
    inv = inventory.get_inventory_summary(db=db_session)
    assert inv["total_available_bottles"] == 100
    assert inv["remaining_bottles"] == 100


def test_vendor_receipt_and_inventory_sync(db_session):
    # Add return bottles first
    remittance.create_remittance(
        RemittanceCreate(
            date=date(2026, 11, 5),
            total_sales_amount=10000.0,
            buy_back_return_bottle=120,
        ),
        db=db_session,
    )

    # Add vendor receipt
    receipt = vendor.create_vendor_receipt(
        VendorReceiptCreate(
            receipt_date=date(2026, 11, 5),
            receipt_time="14:00",
            shop_number="11066",
            vendor_name="Rajan Enterprises",
            liquor_items=[
                ReceiptItemInput(size_label="1000 ML", rate=4.25, quantity=20),
            ],
            beer_items=[
                ReceiptItemInput(size_label="650 ML", rate=1.45, quantity=30),
            ],
        ),
        db=db_session,
    )
    assert receipt.total_bottles == 50

    # Verify inventory was synchronized automatically
    inv = inventory.get_inventory_summary(db=db_session)
    assert inv["total_available_bottles"] == 120
    assert inv["total_vendor_collected_bottles"] == 50
    assert inv["remaining_bottles"] == 70

    # Verify reports router summary
    rep = reports.get_reports_overview(db=db_session)
    assert rep["remittance"]["buy_back_return_bottles"] == 120
    assert rep["vendor"]["total_bottles_collected"] == 50
    assert len(rep["vendor"]["vendors"]) == 1


def test_vendor_receipt_optional_vendor_name(db_session):
    receipt = vendor.create_vendor_receipt(
        VendorReceiptCreate(
            receipt_date=date(2026, 11, 6),
            receipt_time="15:30",
            shop_number="11066",
            vendor_name="",  # Optional Vendor Name
            liquor_items=[
                ReceiptItemInput(size_label="1000 ML", rate=4.25, quantity=10),
            ],
            beer_items=[],
        ),
        db=db_session,
    )
    assert receipt.vendor_name == ""
    assert receipt.total_bottles == 10
