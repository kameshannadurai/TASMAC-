"""
Unit tests for TASMAC Shop No. 11066 calculation formulas
"""

import pytest
from backend.app.calculations import (
    calculate_remittance,
    calculate_receipt_totals,
    calculate_inventory_summary,
    LIQUOR_RATES,
    BEER_RATES,
)


def test_remittance_formulas():
    """
    Test exact formulas from Section A, B, C, D, E, F:
    Total Scan Collection Amount = 50000.0 (entered in Section B, No. 5)
    Buy Back Sold Bottle = 120 -> Buy Back Sold Amount = 120 * 10 = 1200.0
    Sales Bottle = 120
    Total Sales Amount = Total Scan Collection Amount - Buy Back Sold Amount = 50000 - 1200 = 48800.0
    Actual Cash Submitted = Total Scan Collection Amount - Buy Back Sold Amount = 48800.0
    Total Collection = Total Sales Amount + Buy Back Sold Amount = 50000.0
    Buy Back Return Bottle = 80 -> Buy Back Return Amount = 80 * 10 = 800.0
    """
    res = calculate_remittance(
        scan_amount=50000.0,
        upi_amount=15000.0,
        card_amount=5000.0,
        online_amount=20000.0,
        buy_back_sold_bottle=120,    # 120 * 10 = 1200
        buy_back_return_bottle=80,   # 80 * 10 = 800
    )

    # 1. Sales Bottle = Buyback Sold Bottle
    assert res["sales_bottle"] == 120

    # 2. Buy Back Sold Amount = 120 * 10 = 1200.0
    assert res["buy_back_sold_amount"] == 1200.0

    # 3. Buy Back Return Amount = 80 * 10 = 800.0
    assert res["buy_back_return_amount"] == 800.0

    # 4. Total Sales Amount = 50000 - 1200 = 48800.0
    assert res["total_sales_amount"] == 48800.0

    # 5. Actual Cash Submitted = 50000 - 1200 - 15000 - 5000 + (-800) = 28000.0
    assert res["actual_cash_submitted"] == 28000.0

    # 6. Total Collection = 48800 + 1200 = 50000.0
    assert res["total_collection"] == 50000.0

    assert res["scan_amount"] == 50000.0
    assert res["online_amount"] == 20000.0


def test_tasmac_remittance_register_complete_accounting():
    """
    Test exact formulas and example from user prompt:
    - Total Scan Collection Amount = ₹7,91,050
    - Buyback Sold Bottle = 4,847 -> Buyback Sold Amount = ₹48,470
    - Total Sales Amount = 7,91,050 - 48,470 = ₹7,42,580
    - Actual Cash Submitted = 7,91,050 - 48,470 = ₹7,42,580
    - Buyback Opening Balance = ₹42,950
    - Buyback Return Bottle = 2,224 -> Buyback Return Amount Paid = ₹22,240
    - Previous Buyback Remittance = 42,950 - 22,240 = ₹20,710
    - Total Collection = 7,42,580 + 48,470 = ₹7,91,050
    - UPI = 25000, Card = 10000, Online = 5000
    - Cash Remittance = 7,42,580 - 25000 - 10000 - 5000 + 20,710 = ₹7,23,290
    - Total Remittance Amount = 7,42,580 + 20,710 = ₹7,63,290
    """
    res = calculate_remittance(
        scan_amount=791050.0,
        upi_amount=25000.0,
        card_amount=10000.0,
        online_amount=5000.0,
        buy_back_sold_bottle=4847,     # 4847 * 10 = 48470.0
        buy_back_return_bottle=2224,   # 2224 * 10 = 22240.0
        buyback_opening_balance=42950.0,
    )

    # 1. Total Scan Collection Amount
    assert res["scan_amount"] == 791050.0

    # 2. Total Sales Amount = 791050 - 48470 = 742580.0
    assert res["total_sales_amount"] == 742580.0

    # 3. Sales Bottle = 4847
    assert res["sales_bottle"] == 4847

    # 4. Buyback Sold Bottle = 4847
    assert res["buy_back_sold_bottle"] == 4847

    # 5. Buyback Sold Amount = 48470.0
    assert res["buy_back_sold_amount"] == 48470.0

    # 6. Total Collection = 742580 + 48470 = 791050.0
    assert res["total_collection"] == 791050.0

    # 7. Previous Buyback Remittance = 42950 - 22240 = 20710.0
    assert res["previous_buyback_remittance"] == 20710.0

    # 8. Cash Remittance = 742580 - 25000 - 10000 - 5000 + 20710 = 723290.0
    assert res["cash_remittance"] == 723290.0

    # 9. Buyback Return Paid = 22240.0
    assert res["buyback_amount_return_paid"] == 22240.0

    # 10. Buyback Closing Cash in Hand = 48470.0
    assert res["buyback_closing_cash_in_hand"] == 48470.0

    # 11. Actual Cash Submitted = 791050 - 48470 - 25000 - 10000 + 20710 = 728290.0
    assert res["actual_cash_submitted"] == 728290.0

    # 12. Total Remittance Amount = 742580 + 20710 = 763290.0
    assert res["total_remittance_amount"] == 763290.0

    # 13. Cash difference = 728290 - 723290 = 5000.0 (Online collection difference)
    assert res["cash_difference"] == 5000.0


def test_actual_cash_submitted_formula_user_example():
    """
    Test exact values from user prompt:
    - Total Scan Collection Amount = ₹7,91,050
    - Buyback Sold Amount = ₹48,470 (4847 bottles * 10)
    - UPI Amount = ₹20,000
    - Card Amount = ₹10,000
    - Previous Buyback Remittance = ₹20,710

    Formula:
    ACTUAL CASH SUBMITTED = TOTAL SCAN COLLECTION AMOUNT − BUYBACK SOLD AMOUNT − UPI AMOUNT − CARD AMOUNT + PREVIOUS BUYBACK REMITTANCE
    Calculation:
    791050 - 48470 - 20000 - 10000 + 20710 = 733290.0
    """
    res = calculate_remittance(
        scan_amount=791050.0,
        upi_amount=20000.0,
        card_amount=10000.0,
        buy_back_sold_bottle=4847,   # 4847 * 10 = 48470.0
        buyback_opening_balance=20710.0, # with 0 return bottles, prev remittance is 20710.0
        buy_back_return_bottle=0,
    )

    assert res["scan_amount"] == 791050.0
    assert res["buy_back_sold_amount"] == 48470.0
    assert res["upi_amount"] == 20000.0
    assert res["card_amount"] == 10000.0
    assert res["previous_buyback_remittance"] == 20710.0
    assert res["actual_cash_submitted"] == 733290.0


def test_vendor_receipt_formulas():
    """
    Test vendor receipt rates:
    Liquor:
      1000 ML @ 4.25
      750/700/650 ML @ 3.25
      375/360/355/350/325/320/300 ML @ 0.70
      200/180/100 ML @ 0.59
    Beer:
      650 ML @ 1.45
      500/480/440 ML @ 0.72
      325 ML @ 0.67
    """
    liquor = [
        {"size_label": "1000 ML", "rate": 4.25, "quantity": 10},  # 42.50
        {"size_label": "750/700/650 ML", "rate": 3.25, "quantity": 20}, # 65.00
        {"size_label": "375/360/355/350/325/320/300 ML", "rate": 0.70, "quantity": 30}, # 21.00
        {"size_label": "200/180/100 ML", "rate": 0.59, "quantity": 40}, # 23.60
    ]
    beer = [
        {"size_label": "650 ML", "rate": 1.45, "quantity": 50},  # 72.50
        {"size_label": "500/480/440 ML", "rate": 0.72, "quantity": 10}, # 7.20
        {"size_label": "325 ML", "rate": 0.67, "quantity": 15}, # 10.05
    ]

    totals = calculate_receipt_totals(liquor, beer)

    expected_liquor_qty = 10 + 20 + 30 + 40  # 100
    expected_beer_qty = 50 + 10 + 15         # 75
    expected_total_bottles = 175

    expected_liquor_amt = 42.50 + 65.00 + 21.00 + 23.60  # 152.10
    expected_beer_amt = 72.50 + 7.20 + 10.05             # 89.75
    expected_total_payable = 152.10 + 89.75              # 241.85

    assert totals["total_liquor_qty"] == expected_liquor_qty
    assert totals["total_beer_qty"] == expected_beer_qty
    assert totals["total_bottles"] == expected_total_bottles
    assert totals["total_payable"] == expected_total_payable


def test_inventory_warning_on_negative():
    """Test warning when vendor collections exceed available bottles"""
    summary = calculate_inventory_summary(
        cumulative_return_bottles=50,
        total_vendor_collected_bottles=70,
    )
    assert summary["remaining_bottles"] == -20
    assert summary["has_warning"] is True
    assert "WARNING" in summary["warning_message"]

