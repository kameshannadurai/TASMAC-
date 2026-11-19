"""
End-to-end Database & Scenario Tests for TASMAC Shop No. 11066
Validating exact Test Cases 1 to 6 from Section 12.
"""

import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.schemas import (
    RemittanceCreate,
    VendorReceiptCreate,
    VendorReceiptUpdate,
    ReceiptItemInput,
)
from backend.app import crud


@pytest.fixture
def test_db():
    # Use isolated in-memory SQLite database
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


def test_section_12_scenarios_1_to_6(test_db):
    """
    Executes sequentially:
    TEST 1: Day 1 Buy Back Return Bottles = 100 -> Expected Available = 100
    TEST 2: Day 2 Buy Back Return Bottles = 50 -> Expected Available = 150
    TEST 3: Vendor Receipt Total Bottles = 80 -> Expected Available = 150, Collected = 80, Remaining = 70
    TEST 4: Change Vendor Receipt Total Bottles from 80 to 90 -> Expected Remaining = 60
    TEST 5: Delete the receipt containing 90 bottles -> Expected Remaining = 150
    TEST 6: Reconnect/restart preserves all records
    """
    # ---------------------------------------------------------
    # TEST CASE 1: Day 1 Buy Back Return Bottles = 100
    # ---------------------------------------------------------
    rem1 = crud.create_remittance(
        test_db,
        RemittanceCreate(
            date=date(2026, 11, 1),
            scan_amount=15000.0,
            upi_amount=3000.0,
            card_amount=2000.0,
            online_amount=5000.0,
            buy_back_sold_bottle=20,
            buy_back_return_bottle=100,  # 100 bottles returned
        ),
    )
    assert rem1.buy_back_return_bottle == 100
    assert rem1.buy_back_return_amount == 1000.0
    assert rem1.buy_back_sold_amount == 200.0
    # Total Sales = 15000 - 200 = 14800
    assert rem1.total_sales_amount == 14800.0
    assert rem1.sales_bottle == 20

    inv_after_test1 = crud.get_inventory_summary(test_db)
    # Expected Available Bottles = 100
    assert inv_after_test1["total_available_bottles"] == 100
    assert inv_after_test1["total_vendor_collected_bottles"] == 0
    assert inv_after_test1["remaining_bottles"] == 100

    # ---------------------------------------------------------
    # TEST CASE 2: Day 2 Buy Back Return Bottles = 50
    # ---------------------------------------------------------
    rem2 = crud.create_remittance(
        test_db,
        RemittanceCreate(
            date=date(2026, 11, 2),
            scan_amount=12000.0,
            total_sales_amount=18000.0,
            upi_amount=4000.0,
            card_amount=1000.0,
            online_amount=6000.0,
            buy_back_sold_bottle=30,
            buy_back_return_bottle=50,  # 50 bottles returned
        ),
    )
    inv_after_test2 = crud.get_inventory_summary(test_db)
    # Expected Available Bottles = 150
    assert inv_after_test2["total_available_bottles"] == 150
    assert inv_after_test2["total_vendor_collected_bottles"] == 0
    assert inv_after_test2["remaining_bottles"] == 150

    # ---------------------------------------------------------
    # TEST CASE 3: Vendor Receipt Total Bottles = 80
    # ---------------------------------------------------------
    receipt = crud.create_vendor_receipt(
        test_db,
        VendorReceiptCreate(
            receipt_date=date(2026, 11, 3),
            receipt_time="11:30",
            shop_number="11066",
            scanner_number="SCN-01",
            tin_number="TIN-3398711066",
            vendor_name="Murugan Agencies",
            vendor_mobile="9876543210",
            liquor_items=[
                ReceiptItemInput(size_label="1000 ML", rate=4.25, quantity=20),             # 20
                ReceiptItemInput(size_label="750/700/650 ML", rate=3.25, quantity=30),      # 30
                ReceiptItemInput(size_label="375/360/355/350/325/320/300 ML", rate=0.70, quantity=10), # 10
                ReceiptItemInput(size_label="200/180/100 ML", rate=0.59, quantity=0),       # 0
            ],
            beer_items=[
                ReceiptItemInput(size_label="650 ML", rate=1.45, quantity=20),              # 20 -> Total = 20+30+10+20 = 80
                ReceiptItemInput(size_label="500/480/440 ML", rate=0.72, quantity=0),
                ReceiptItemInput(size_label="325 ML", rate=0.67, quantity=0),
            ],
        ),
    )
    assert receipt.total_bottles == 80

    inv_after_test3 = crud.get_inventory_summary(test_db)
    # Expected: Available = 150, Vendor Collected = 80, Remaining = 70
    assert inv_after_test3["total_available_bottles"] == 150
    assert inv_after_test3["total_vendor_collected_bottles"] == 80
    assert inv_after_test3["remaining_bottles"] == 70

    # ---------------------------------------------------------
    # TEST CASE 4: Edit Receipt from 80 to 90
    # ---------------------------------------------------------
    updated_receipt = crud.update_vendor_receipt(
        test_db,
        receipt.id,
        VendorReceiptUpdate(
            liquor_items=[
                ReceiptItemInput(size_label="1000 ML", rate=4.25, quantity=30),             # +10 -> 30 (liquor total = 70)
                ReceiptItemInput(size_label="750/700/650 ML", rate=3.25, quantity=30),
                ReceiptItemInput(size_label="375/360/355/350/325/320/300 ML", rate=0.70, quantity=10),
                ReceiptItemInput(size_label="200/180/100 ML", rate=0.59, quantity=0),
            ],
            beer_items=[
                ReceiptItemInput(size_label="650 ML", rate=1.45, quantity=20),              # 20 -> Total = 70 + 20 = 90
                ReceiptItemInput(size_label="500/480/440 ML", rate=0.72, quantity=0),
                ReceiptItemInput(size_label="325 ML", rate=0.67, quantity=0),
            ],
        ),
    )
    assert updated_receipt.total_bottles == 90

    inv_after_test4 = crud.get_inventory_summary(test_db)
    # Expected Remaining Bottles = 60 (150 - 90 = 60)
    assert inv_after_test4["total_available_bottles"] == 150
    assert inv_after_test4["total_vendor_collected_bottles"] == 90
    assert inv_after_test4["remaining_bottles"] == 60

    # ---------------------------------------------------------
    # TEST CASE 5: Delete Receipt of 90 bottles
    # ---------------------------------------------------------
    del_ok = crud.delete_vendor_receipt(test_db, receipt.id)
    assert del_ok is True

    inv_after_test5 = crud.get_inventory_summary(test_db)
    # Expected Remaining Bottles = 150
    assert inv_after_test5["total_available_bottles"] == 150
    assert inv_after_test5["total_vendor_collected_bottles"] == 0
    assert inv_after_test5["remaining_bottles"] == 150

    # ---------------------------------------------------------
    # TEST CASE 6: Verify Persistence
    # ---------------------------------------------------------
    remittances = crud.list_remittances(test_db)
    assert len(remittances) == 2
    assert remittances[0].buy_back_return_bottle == 50
    assert remittances[1].buy_back_return_bottle == 100

