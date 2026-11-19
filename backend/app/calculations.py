"""
TASMAC Shop No. 11066 - Annadurai M
Core Business Calculation Logic
"""

from typing import Dict, Any, List
from decimal import Decimal, ROUND_HALF_UP

# Fixed Rates for Module 3 - Vendor Information Details
LIQUOR_RATES = [
    {"size_label": "1000 ML", "rate": Decimal("4.25")},
    {"size_label": "750/700/650 ML", "rate": Decimal("3.25")},
    {"size_label": "375/360/355/350/325/320/300 ML", "rate": Decimal("0.70")},
    {"size_label": "200/180/100 ML", "rate": Decimal("0.59")},
]

BEER_RATES = [
    {"size_label": "650 ML", "rate": Decimal("1.45")},
    {"size_label": "500/480/440 ML", "rate": Decimal("0.72")},
    {"size_label": "325 ML", "rate": Decimal("0.67")},
]


def calculate_remittance(
    total_sales_amount: float = 0.0,
    upi_amount: float = 0.0,
    card_amount: float = 0.0,
    buy_back_sold_bottle: int = 0,
    buy_back_return_bottle: int = 0,
    scan_amount: float = 0.0,
    online_amount: float = 0.0,
    shop_number: str = "11066",
    serial_number: str = "",
    sales_bottle: int = 0,
    buyback_opening_balance: float = 0.0,
    actual_cash_submitted: float = None,
) -> Dict[str, Any]:
    """
    TASMAC Official Remittance Register Accounting Formulas:
    - Section A, No. 4: TOTAL SALES AMOUNT = TOTAL SCAN COLLECTION AMOUNT - Buyback Sold Amount
    - Section B, No. 5: TOTAL SCAN COLLECTION AMOUNT (manually entered)
    - Sales Bottle = Buyback Sold Bottle
    - Buyback Sold Amount = Buyback Sold Bottle * 10
    - Buyback Return Amount Paid = Buyback Return Bottle * 10
    - Previous Buyback Remittance = Buyback Opening Balance - Buyback Return Amount Paid
    - Total Collection = Total Sales Amount + Buyback Sold Amount
    - Cash Remittance = Total Sales Amount - UPI - Card - Online + Previous Buyback Remittance
    - Buyback Closing Cash in Hand = Buyback Sold Amount
    - Actual Cash Submitted = TOTAL SCAN COLLECTION AMOUNT - Buyback Sold Amount - UPI Amount - Card Amount + Previous Buyback Remittance
    - Cash Difference = Actual Cash Submitted - Cash Remittance
    - Total Remittance Amount = Total Sales Amount + Previous Buyback Remittance
    """
    scan = Decimal(str(scan_amount or 0.0))
    upi = Decimal(str(upi_amount or 0.0))
    card = Decimal(str(card_amount or 0.0))
    online = Decimal(str(online_amount or 0.0))
    opening_buyback = Decimal(str(buyback_opening_balance or 0.0))

    sold_bottles = int(buy_back_sold_bottle or 0)
    return_bottles = int(buy_back_return_bottle or 0)

    # 1. Sales Bottle = Buyback Sold Bottle
    sales_btls = sold_bottles

    # 2. Buy Back Sold Amount = Buy Back Sold Bottle * 10
    buy_back_sold_amount = Decimal(sold_bottles * 10)

    # 3. Buy Back Return Amount = Buy Back Return Bottle * 10
    buy_back_return_amount = Decimal(return_bottles * 10)

    # 4. Total Sales Amount = TOTAL SCAN COLLECTION AMOUNT - Buyback Sold Amount
    # If scan_amount is provided, calculate total_sales automatically.
    # If scan_amount is 0 but total_sales_amount was provided (legacy/compat), derive scan.
    if scan > Decimal("0") or total_sales_amount == 0.0:
        total_sales = scan - buy_back_sold_amount
    else:
        total_sales = Decimal(str(total_sales_amount or 0.0))
        scan = total_sales + buy_back_sold_amount

    # 5. Previous Buyback Remittance = Buyback Opening Balance - Buyback Return Amount Paid
    previous_buyback_remittance = opening_buyback - buy_back_return_amount

    # 6. Actual Cash Submitted = TOTAL SCAN COLLECTION AMOUNT - Buyback Sold Amount - UPI Amount - Card Amount + Previous Buyback Remittance
    act_cash = scan - buy_back_sold_amount - upi - card + previous_buyback_remittance

    # 7. Total Collection = Total Sales Amount + Buy Back Sold Amount
    total_collection = total_sales + buy_back_sold_amount

    # 8. Cash Remittance = Sales Amount - UPI - Card - Online + Previous Buyback Remittance
    cash_remittance = total_sales - upi - card - online + previous_buyback_remittance

    # 9. Buyback Closing Cash in Hand = Buy Back Sold Amount
    buyback_closing_cash_in_hand = buy_back_sold_amount

    # 10. Total Remittance Amount = Sales Amount + Previous Buyback Remittance
    total_remittance_amount = total_sales + previous_buyback_remittance

    # 11. Cash Difference = Actual Cash Submitted - Cash Remittance
    cash_diff = act_cash - cash_remittance

    # Compatibility formulas:
    cash_sales = total_sales - upi - card - buy_back_sold_amount
    total_all_payments = total_sales - buy_back_sold_amount

    return {
        "shop_number": str(shop_number or "11066"),
        "serial_number": str(serial_number or ""),
        "scan_amount": float(scan),
        "total_sales_amount": float(total_sales),
        "sales_bottle": sales_btls,
        "upi_amount": float(upi),
        "card_amount": float(card),
        "online_amount": float(online),
        "buyback_opening_balance": float(opening_buyback),
        "buy_back_sold_bottle": sold_bottles,
        "buy_back_sold_amount": float(buy_back_sold_amount),
        "buy_back_return_bottle": return_bottles,
        "buy_back_return_amount": float(buy_back_return_amount),
        "previous_buyback_remittance": float(previous_buyback_remittance),
        "total_collection": float(total_collection),
        "cash_remittance": float(cash_remittance),
        "buyback_amount_return_paid": float(buy_back_return_amount),
        "buyback_closing_cash_in_hand": float(buyback_closing_cash_in_hand),
        "total_remittance_amount": float(total_remittance_amount),
        "actual_cash_submitted": float(act_cash),
        "cash_difference": float(cash_diff),
        "cash_sales": float(cash_sales),
        "total_all_payments": float(total_all_payments),
    }


def calculate_receipt_totals(
    liquor_items: List[Dict[str, Any]], beer_items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Exact Formulas for Module 3 - Vendor Information Details:
    Amount = Quantity * Rate
    Total Bottles = Sum of Liquor Quantities + Sum of Beer Quantities
    Total Payable = Sum of Liquor Amounts + Sum of Beer Amounts
    """
    processed_liquor = []
    total_liquor_qty = 0
    total_liquor_amount = Decimal("0.00")

    for item in liquor_items:
        size = item.get("size_label", "")
        qty = int(item.get("quantity", 0) or 0)
        rate = Decimal(str(item.get("rate", 0.0)))
        amount = (Decimal(qty) * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_liquor_qty += qty
        total_liquor_amount += amount
        processed_liquor.append({
            "size_label": size,
            "rate": float(rate),
            "quantity": qty,
            "amount": float(amount),
        })

    processed_beer = []
    total_beer_qty = 0
    total_beer_amount = Decimal("0.00")

    for item in beer_items:
        size = item.get("size_label", "")
        qty = int(item.get("quantity", 0) or 0)
        rate = Decimal(str(item.get("rate", 0.0)))
        amount = (Decimal(qty) * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_beer_qty += qty
        total_beer_amount += amount
        processed_beer.append({
            "size_label": size,
            "rate": float(rate),
            "quantity": qty,
            "amount": float(amount),
        })

    total_bottles = total_liquor_qty + total_beer_qty
    total_payable = (total_liquor_amount + total_beer_amount).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return {
        "liquor_items": processed_liquor,
        "beer_items": processed_beer,
        "total_liquor_qty": total_liquor_qty,
        "total_beer_qty": total_beer_qty,
        "total_bottles": total_bottles,
        "total_payable": float(total_payable),
    }


def calculate_inventory_summary(
    cumulative_return_bottles: int,
    total_vendor_collected_bottles: int,
    initial_recorded_date: str = None,
) -> Dict[str, Any]:
    """
    Exact Formulas for Module 2 - Vendor Bottle Management:
    Total Bottles Available = Cumulative Buy Back Return Bottle entries
    Total Vendor Empty Collected Bottles = Sum of Total Bottles from all saved vendor receipts
    Remaining Bottles = Total Bottles Available - Total Vendor Empty Collected Bottles
    """
    available = int(cumulative_return_bottles or 0)
    collected = int(total_vendor_collected_bottles or 0)
    remaining = available - collected
    has_warning = remaining < 0

    return {
        "initial_recorded_date": initial_recorded_date,
        "total_available_bottles": available,
        "total_vendor_collected_bottles": collected,
        "remaining_bottles": remaining,
        "has_warning": has_warning,
        "warning_message": (
            f"WARNING: Vendor collected bottles ({collected}) exceed available bottles ({available}) by {abs(remaining)} bottles!"
            if has_warning
            else None
        ),
    }
