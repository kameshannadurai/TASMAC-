"""
CRUD and Transaction-safe Database Operations for TASMAC Shop No. 11066
"""

from typing import List, Optional, Tuple, Dict, Any
from datetime import date, datetime
import json
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc

from .models import (
    User,
    DailyRemittance,
    VendorReceipt,
    VendorReceiptLiquorItem,
    VendorReceiptBeerItem,
    BottleInventoryTransaction,
    AuditHistory,
)
from .schemas import (
    RemittanceCreate,
    RemittanceUpdate,
    VendorReceiptCreate,
    VendorReceiptUpdate,
)
from .calculations import (
    calculate_remittance,
    calculate_receipt_totals,
    calculate_inventory_summary,
    LIQUOR_RATES,
    BEER_RATES,
)


# ==============================================================================
# AUDIT LOGGING HELPER
# ==============================================================================
def create_audit_log(
    db: Session,
    entity_type: str,
    entity_id: int,
    action: str,
    changes: Optional[Dict[str, Any]] = None,
):
    log = AuditHistory(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        changes_json=json.dumps(changes or {}, default=str),
        created_at=datetime.utcnow(),
    )
    db.add(log)


# ==============================================================================
# MODULE 1: DAILY REMITTANCE
# ==============================================================================
def get_remittance_by_date(db: Session, record_date: date) -> Optional[DailyRemittance]:
    return db.query(DailyRemittance).filter(DailyRemittance.date == record_date).first()


def get_remittance_by_id(db: Session, remittance_id: int) -> Optional[DailyRemittance]:
    return db.query(DailyRemittance).filter(DailyRemittance.id == remittance_id).first()


def list_remittances(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 1000,
) -> List[DailyRemittance]:
    query = db.query(DailyRemittance)
    if start_date:
        query = query.filter(DailyRemittance.date >= start_date)
    if end_date:
        query = query.filter(DailyRemittance.date <= end_date)
    return query.order_by(desc(DailyRemittance.date)).offset(skip).limit(limit).all()


def create_remittance(db: Session, data: RemittanceCreate) -> DailyRemittance:
    # Check duplicate date
    existing = get_remittance_by_date(db, data.date)
    if existing:
        raise ValueError(f"A remittance record already exists for date {data.date}. Use edit to update.")

    calcs = calculate_remittance(
        total_sales_amount=data.total_sales_amount,
        upi_amount=data.upi_amount,
        card_amount=data.card_amount,
        buy_back_sold_bottle=data.buy_back_sold_bottle,
        buy_back_return_bottle=data.buy_back_return_bottle,
        scan_amount=data.scan_amount,
        online_amount=data.online_amount,
        shop_number=data.shop_number or "11066",
        serial_number=data.serial_number or "",
        sales_bottle=data.sales_bottle or 0,
        buyback_opening_balance=data.buyback_opening_balance or 0.0,
        actual_cash_submitted=data.actual_cash_submitted,
    )

    remittance = DailyRemittance(
        date=data.date,
        shop_number=calcs["shop_number"],
        serial_number=calcs["serial_number"],
        scan_amount=calcs["scan_amount"],
        total_sales_amount=calcs["total_sales_amount"],
        sales_bottle=calcs["sales_bottle"],
        upi_amount=calcs["upi_amount"],
        card_amount=calcs["card_amount"],
        online_amount=calcs["online_amount"],
        buyback_opening_balance=calcs["buyback_opening_balance"],
        buy_back_sold_bottle=calcs["buy_back_sold_bottle"],
        buy_back_sold_amount=calcs["buy_back_sold_amount"],
        buy_back_return_bottle=calcs["buy_back_return_bottle"],
        buy_back_return_amount=calcs["buy_back_return_amount"],
        previous_buyback_remittance=calcs["previous_buyback_remittance"],
        total_collection=calcs["total_collection"],
        cash_remittance=calcs["cash_remittance"],
        buyback_amount_return_paid=calcs["buyback_amount_return_paid"],
        buyback_closing_cash_in_hand=calcs["buyback_closing_cash_in_hand"],
        total_remittance_amount=calcs["total_remittance_amount"],
        actual_cash_submitted=calcs["actual_cash_submitted"],
        cash_difference=calcs["cash_difference"],
        cash_sales=calcs["cash_sales"],
        total_all_payments=calcs["total_all_payments"],
        notes=data.notes,
    )
    db.add(remittance)
    db.flush()

    create_audit_log(
        db,
        "REMITTANCE",
        remittance.id,
        "CREATE",
        {"date": str(data.date), "sales": data.total_sales_amount, "return_bottles": data.buy_back_return_bottle},
    )

    # Sync inventory transaction
    sync_inventory_transaction_for_remittance(db, remittance)

    db.commit()
    db.refresh(remittance)
    return remittance


def update_remittance(
    db: Session, remittance_id: int, data: RemittanceUpdate
) -> Optional[DailyRemittance]:
    remittance = get_remittance_by_id(db, remittance_id)
    if not remittance:
        return None

    # Merge fields
    fields = data.model_dump(exclude_unset=True)
    scan_amount = fields.get("scan_amount", remittance.scan_amount)
    total_sales_amount = fields.get("total_sales_amount", remittance.total_sales_amount)
    upi_amount = fields.get("upi_amount", remittance.upi_amount)
    card_amount = fields.get("card_amount", remittance.card_amount)
    online_amount = fields.get("online_amount", remittance.online_amount)
    sold_bottles = fields.get("buy_back_sold_bottle", remittance.buy_back_sold_bottle)
    return_bottles = fields.get("buy_back_return_bottle", remittance.buy_back_return_bottle)
    shop_num = fields.get("shop_number", getattr(remittance, "shop_number", "11066"))
    serial_num = fields.get("serial_number", getattr(remittance, "serial_number", ""))
    sales_btls = fields.get("sales_bottle", getattr(remittance, "sales_bottle", 0))
    opening_bal = fields.get("buyback_opening_balance", getattr(remittance, "buyback_opening_balance", 0.0))
    act_cash = fields.get("actual_cash_submitted", getattr(remittance, "actual_cash_submitted", None))

    calcs = calculate_remittance(
        total_sales_amount=total_sales_amount,
        upi_amount=upi_amount,
        card_amount=card_amount,
        buy_back_sold_bottle=sold_bottles,
        buy_back_return_bottle=return_bottles,
        scan_amount=scan_amount,
        online_amount=online_amount,
        shop_number=shop_num,
        serial_number=serial_num,
        sales_bottle=sales_btls,
        buyback_opening_balance=opening_bal,
        actual_cash_submitted=act_cash,
    )

    remittance.shop_number = calcs["shop_number"]
    remittance.serial_number = calcs["serial_number"]
    remittance.scan_amount = calcs["scan_amount"]
    remittance.total_sales_amount = calcs["total_sales_amount"]
    remittance.sales_bottle = calcs["sales_bottle"]
    remittance.upi_amount = calcs["upi_amount"]
    remittance.card_amount = calcs["card_amount"]
    remittance.online_amount = calcs["online_amount"]
    remittance.buyback_opening_balance = calcs["buyback_opening_balance"]
    remittance.buy_back_sold_bottle = calcs["buy_back_sold_bottle"]
    remittance.buy_back_sold_amount = calcs["buy_back_sold_amount"]
    remittance.buy_back_return_bottle = calcs["buy_back_return_bottle"]
    remittance.buy_back_return_amount = calcs["buy_back_return_amount"]
    remittance.previous_buyback_remittance = calcs["previous_buyback_remittance"]
    remittance.total_collection = calcs["total_collection"]
    remittance.cash_remittance = calcs["cash_remittance"]
    remittance.buyback_amount_return_paid = calcs["buyback_amount_return_paid"]
    remittance.buyback_closing_cash_in_hand = calcs["buyback_closing_cash_in_hand"]
    remittance.total_remittance_amount = calcs["total_remittance_amount"]
    remittance.actual_cash_submitted = calcs["actual_cash_submitted"]
    remittance.cash_difference = calcs["cash_difference"]
    remittance.cash_sales = calcs["cash_sales"]
    remittance.total_all_payments = calcs["total_all_payments"]
    if data.notes is not None:
        remittance.notes = data.notes

    remittance.updated_at = datetime.utcnow()

    create_audit_log(db, "REMITTANCE", remittance.id, "UPDATE", fields)
    sync_inventory_transaction_for_remittance(db, remittance)

    db.commit()
    db.refresh(remittance)
    return remittance


def delete_remittance(db: Session, remittance_id: int) -> bool:
    remittance = get_remittance_by_id(db, remittance_id)
    if not remittance:
        return False

    # Delete inventory transaction
    db.query(BottleInventoryTransaction).filter(
        BottleInventoryTransaction.transaction_type == "REMITTANCE_RETURN",
        BottleInventoryTransaction.reference_id == remittance.id,
    ).delete()

    create_audit_log(
        db,
        "REMITTANCE",
        remittance.id,
        "DELETE",
        {"date": str(remittance.date), "return_bottles": remittance.buy_back_return_bottle},
    )

    db.delete(remittance)
    db.commit()
    return True


# ==============================================================================
# MODULE 3: VENDOR HANDOVER RECEIPT
# ==============================================================================
def generate_receipt_number(db: Session, receipt_date: date) -> str:
    """Generate sequential receipt number e.g. RCP-11066-YYYYMMDD-001"""
    date_prefix = receipt_date.strftime("%Y%m%d")
    count = (
        db.query(func.count(VendorReceipt.id))
        .filter(VendorReceipt.receipt_date == receipt_date)
        .scalar()
        or 0
    )
    return f"RCP-11066-{date_prefix}-{count + 1:03d}"


def get_vendor_receipt_by_id(db: Session, receipt_id: int) -> Optional[VendorReceipt]:
    return db.query(VendorReceipt).filter(VendorReceipt.id == receipt_id).first()


def list_vendor_receipts(
    db: Session,
    vendor_name: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 1000,
) -> List[VendorReceipt]:
    query = db.query(VendorReceipt)
    if vendor_name:
        query = query.filter(VendorReceipt.vendor_name.ilike(f"%{vendor_name}%"))
    if start_date:
        query = query.filter(VendorReceipt.receipt_date >= start_date)
    if end_date:
        query = query.filter(VendorReceipt.receipt_date <= end_date)
    return query.order_by(desc(VendorReceipt.receipt_date), desc(VendorReceipt.id)).offset(skip).limit(limit).all()


def create_vendor_receipt(db: Session, data: VendorReceiptCreate) -> VendorReceipt:
    receipt_number = generate_receipt_number(db, data.receipt_date)

    # Calculate item totals
    liquor_raw = [item.model_dump() for item in data.liquor_items]
    beer_raw = [item.model_dump() for item in data.beer_items]
    totals = calculate_receipt_totals(liquor_raw, beer_raw)

    receipt = VendorReceipt(
        receipt_number=receipt_number,
        receipt_date=data.receipt_date,
        receipt_time=data.receipt_time or datetime.now().strftime("%H:%M"),
        shop_number="11066",
        scanner_number=data.scanner_number,
        tin_number=data.tin_number,
        vendor_name=data.vendor_name or "",
        vendor_mobile=data.vendor_mobile,
        total_liquor_bottles=totals["total_liquor_qty"],
        total_liquor_amount=float(totals["liquor_items"][0]["rate"] * 0) if not totals["liquor_items"] else sum(i["amount"] for i in totals["liquor_items"]),
        total_beer_bottles=totals["total_beer_qty"],
        total_beer_amount=sum(i["amount"] for i in totals["beer_items"]),
        total_bottles=totals["total_bottles"],
        total_payable=totals["total_payable"],
        notes=data.notes,
    )
    db.add(receipt)
    db.flush()

    # Add liquor items
    for item in totals["liquor_items"]:
        db.add(
            VendorReceiptLiquorItem(
                receipt_id=receipt.id,
                size_label=item["size_label"],
                rate=item["rate"],
                quantity=item["quantity"],
                amount=item["amount"],
            )
        )

    # Add beer items
    for item in totals["beer_items"]:
        db.add(
            VendorReceiptBeerItem(
                receipt_id=receipt.id,
                size_label=item["size_label"],
                rate=item["rate"],
                quantity=item["quantity"],
                amount=item["amount"],
            )
        )

    db.flush()

    create_audit_log(
        db,
        "VENDOR_RECEIPT",
        receipt.id,
        "CREATE",
        {"receipt_number": receipt_number, "vendor": data.vendor_name, "total_bottles": receipt.total_bottles},
    )

    sync_inventory_transaction_for_receipt(db, receipt)

    db.commit()
    db.refresh(receipt)
    return receipt


def update_vendor_receipt(
    db: Session, receipt_id: int, data: VendorReceiptUpdate
) -> Optional[VendorReceipt]:
    receipt = get_vendor_receipt_by_id(db, receipt_id)
    if not receipt:
        return None

    if data.receipt_date:
        receipt.receipt_date = data.receipt_date
    if data.receipt_time:
        receipt.receipt_time = data.receipt_time
    if data.scanner_number is not None:
        receipt.scanner_number = data.scanner_number
    if data.tin_number is not None:
        receipt.tin_number = data.tin_number
    if data.vendor_name is not None:
        receipt.vendor_name = data.vendor_name
    if data.vendor_mobile is not None:
        receipt.vendor_mobile = data.vendor_mobile
    if data.notes is not None:
        receipt.notes = data.notes

    # Update line items if provided
    if data.liquor_items is not None or data.beer_items is not None:
        liquor_items_raw = (
            [i.model_dump() for i in data.liquor_items]
            if data.liquor_items is not None
            else [{"size_label": i.size_label, "rate": i.rate, "quantity": i.quantity} for i in receipt.liquor_items]
        )
        beer_items_raw = (
            [i.model_dump() for i in data.beer_items]
            if data.beer_items is not None
            else [{"size_label": i.size_label, "rate": i.rate, "quantity": i.quantity} for i in receipt.beer_items]
        )

        totals = calculate_receipt_totals(liquor_items_raw, beer_items_raw)

        # Clear existing items and replace
        db.query(VendorReceiptLiquorItem).filter(VendorReceiptLiquorItem.receipt_id == receipt.id).delete()
        db.query(VendorReceiptBeerItem).filter(VendorReceiptBeerItem.receipt_id == receipt.id).delete()

        for item in totals["liquor_items"]:
            db.add(
                VendorReceiptLiquorItem(
                    receipt_id=receipt.id,
                    size_label=item["size_label"],
                    rate=item["rate"],
                    quantity=item["quantity"],
                    amount=item["amount"],
                )
            )

        for item in totals["beer_items"]:
            db.add(
                VendorReceiptBeerItem(
                    receipt_id=receipt.id,
                    size_label=item["size_label"],
                    rate=item["rate"],
                    quantity=item["quantity"],
                    amount=item["amount"],
                )
            )

        receipt.total_liquor_bottles = totals["total_liquor_qty"]
        receipt.total_liquor_amount = sum(i["amount"] for i in totals["liquor_items"])
        receipt.total_beer_bottles = totals["total_beer_qty"]
        receipt.total_beer_amount = sum(i["amount"] for i in totals["beer_items"])
        receipt.total_bottles = totals["total_bottles"]
        receipt.total_payable = totals["total_payable"]

    receipt.updated_at = datetime.utcnow()

    create_audit_log(
        db,
        "VENDOR_RECEIPT",
        receipt.id,
        "UPDATE",
        {"vendor": receipt.vendor_name, "total_bottles": receipt.total_bottles},
    )

    sync_inventory_transaction_for_receipt(db, receipt)

    db.commit()
    db.refresh(receipt)
    return receipt


def delete_vendor_receipt(db: Session, receipt_id: int) -> bool:
    receipt = get_vendor_receipt_by_id(db, receipt_id)
    if not receipt:
        return False

    db.query(BottleInventoryTransaction).filter(
        BottleInventoryTransaction.transaction_type == "VENDOR_COLLECTION",
        BottleInventoryTransaction.reference_id == receipt.id,
    ).delete()

    create_audit_log(
        db,
        "VENDOR_RECEIPT",
        receipt.id,
        "DELETE",
        {"receipt_number": receipt.receipt_number, "bottles": receipt.total_bottles},
    )

    db.delete(receipt)
    db.commit()
    return True


# ==============================================================================
# MODULE 2: BOTTLE INVENTORY SYNCHRONIZATION & CALCULATIONS
# ==============================================================================
def sync_inventory_transaction_for_remittance(db: Session, remittance: DailyRemittance):
    """Ensure Module 1 Buy Back Return updates the bottle inventory transaction"""
    tx = (
        db.query(BottleInventoryTransaction)
        .filter(
            BottleInventoryTransaction.transaction_type == "REMITTANCE_RETURN",
            BottleInventoryTransaction.reference_id == remittance.id,
        )
        .first()
    )
    if not tx:
        tx = BottleInventoryTransaction(
            date=remittance.date,
            transaction_type="REMITTANCE_RETURN",
            reference_id=remittance.id,
            reference_number=f"REM-{remittance.date.strftime('%Y%m%d')}",
            bottles_in=remittance.buy_back_return_bottle,
            bottles_out=0,
        )
        db.add(tx)
    else:
        tx.date = remittance.date
        tx.bottles_in = remittance.buy_back_return_bottle


def sync_inventory_transaction_for_receipt(db: Session, receipt: VendorReceipt):
    """Ensure Module 3 Total Bottles updates the bottle inventory transaction"""
    tx = (
        db.query(BottleInventoryTransaction)
        .filter(
            BottleInventoryTransaction.transaction_type == "VENDOR_COLLECTION",
            BottleInventoryTransaction.reference_id == receipt.id,
        )
        .first()
    )
    if not tx:
        tx = BottleInventoryTransaction(
            date=receipt.receipt_date,
            transaction_type="VENDOR_COLLECTION",
            reference_id=receipt.id,
            reference_number=receipt.receipt_number,
            bottles_in=0,
            bottles_out=receipt.total_bottles,
        )
        db.add(tx)
    else:
        tx.date = receipt.receipt_date
        tx.bottles_out = receipt.total_bottles


def get_inventory_summary(db: Session) -> Dict[str, Any]:
    """
    Cumulative calculations directly from original saved transactions:
    Total Bottles Available = Cumulative Buy Back Return Bottle entries from initial recorded date.
    Total Vendor Empty Collected Bottles = Sum of Total Bottles from all saved vendor receipts.
    Remaining Bottles = Total Bottles Available - Total Vendor Empty Collected Bottles.
    """
    first_remittance = db.query(DailyRemittance).order_by(asc(DailyRemittance.date)).first()
    initial_recorded_date = first_remittance.date.strftime("%d-%m-%Y") if first_remittance else None

    # Total Bottles Available = sum of all buy_back_return_bottle
    total_available = (
        db.query(func.coalesce(func.sum(DailyRemittance.buy_back_return_bottle), 0)).scalar() or 0
    )

    # Total Vendor Empty Collected Bottles = sum of all total_bottles from vendor receipts
    total_vendor_collected = (
        db.query(func.coalesce(func.sum(VendorReceipt.total_bottles), 0)).scalar() or 0
    )

    return calculate_inventory_summary(
        cumulative_return_bottles=int(total_available),
        total_vendor_collected_bottles=int(total_vendor_collected),
        initial_recorded_date=initial_recorded_date,
    )


def get_bottle_history(db: Session, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
    """
    Build date-wise unified bottle history:
    Combines daily remittance returns and daily vendor collections by date,
    calculating cumulative running remaining bottles.
    """
    # Fetch all dates from remittances and vendor receipts
    remittance_dates = db.query(DailyRemittance.date).distinct()
    vendor_dates = db.query(VendorReceipt.receipt_date).distinct()
    all_dates = set([r[0] for r in remittance_dates] + [v[0] for v in vendor_dates])
    sorted_dates = sorted(all_dates)

    history = []
    running_available = 0
    running_collected = 0

    for d in sorted_dates:
        # Returns on day d
        day_returns = (
            db.query(func.coalesce(func.sum(DailyRemittance.buy_back_return_bottle), 0))
            .filter(DailyRemittance.date == d)
            .scalar()
            or 0
        )
        # Collected on day d
        day_collected = (
            db.query(func.coalesce(func.sum(VendorReceipt.total_bottles), 0))
            .filter(VendorReceipt.receipt_date == d)
            .scalar()
            or 0
        )

        running_available += day_returns
        running_collected += day_collected
        remaining = running_available - running_collected

        if (start_date is None or d >= start_date) and (end_date is None or d <= end_date):
            history.append({
                "date": d,
                "buy_back_return_bottles": int(day_returns),
                "vendor_collected_bottles": int(day_collected),
                "remaining_bottles": int(remaining),
                "cumulative_available": int(running_available),
                "cumulative_collected": int(running_collected),
            })

    # Return descending by date for display
    history.reverse()
    return history


def get_dashboard_stats(db: Session, today: date) -> Dict[str, Any]:
    """Live summary metrics for home dashboard"""
    inv_summary = get_inventory_summary(db)

    # Today's remittance
    today_remittance = get_remittance_by_date(db, today)
    today_sales = today_remittance.total_sales_amount if today_remittance else 0.0
    today_returns = today_remittance.buy_back_return_bottle if today_remittance else 0

    return {
        "today_date": today.strftime("%d-%m-%Y"),
        "today_total_sales": float(today_sales),
        "today_return_bottles": int(today_returns),
        "total_available_bottles": inv_summary["total_available_bottles"],
        "total_vendor_collected_bottles": inv_summary["total_vendor_collected_bottles"],
        "remaining_bottles": inv_summary["remaining_bottles"],
        "has_warning": inv_summary["has_warning"],
        "warning_message": inv_summary["warning_message"],
    }

