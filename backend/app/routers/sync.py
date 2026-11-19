"""
TASMAC Shop No. 11066 - Annadurai M
Multi-Device Internet Synchronization Engine (Pull & Push Delta Sync)
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import User, DailyRemittance, VendorReceipt, VendorReceiptLiquorItem, VendorReceiptBeerItem, AuditHistory
from ..schemas import SyncPushRequest, SyncPushResponse, SyncPullResponse
from ..deps import get_current_user_optional, require_admin, require_authenticated
from ..calculations import calculate_remittance, calculate_receipt_totals

router = APIRouter(prefix="/api/sync", tags=["Multi-Device Synchronization"])


@router.get("/pull", response_model=SyncPullResponse)
def pull_sync_data(
    since: Optional[str] = Query(None, description="ISO timestamp of last sync"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Pulls cloud database records for automatic multi-device synchronization.
    If 'since' is provided, returns changes since that timestamp.
    All authorized devices (Admin and View-Only) can pull records.
    """
    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            pass

    # Remittances
    rem_query = db.query(DailyRemittance)
    if since_dt:
        rem_query = rem_query.filter(DailyRemittance.updated_at >= since_dt)
    remittances = rem_query.order_by(desc(DailyRemittance.date)).all()

    # Vendor Receipts
    rec_query = db.query(VendorReceipt)
    if since_dt:
        rec_query = rec_query.filter(VendorReceipt.updated_at >= since_dt)
    receipts = rec_query.order_by(desc(VendorReceipt.receipt_date)).all()

    # Format remittances dicts
    rem_list = []
    for r in remittances:
        rem_list.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "shop_number": r.shop_number,
            "serial_number": r.serial_number,
            "scan_amount": r.scan_amount,
            "total_sales_amount": r.total_sales_amount,
            "sales_bottle": r.sales_bottle,
            "upi_amount": r.upi_amount,
            "card_amount": r.card_amount,
            "online_amount": r.online_amount,
            "buyback_opening_balance": r.buyback_opening_balance,
            "buy_back_sold_bottle": r.buy_back_sold_bottle,
            "buy_back_sold_amount": r.buy_back_sold_amount,
            "buy_back_return_bottle": r.buy_back_return_bottle,
            "buy_back_return_amount": r.buy_back_return_amount,
            "previous_buyback_remittance": r.previous_buyback_remittance,
            "total_collection": r.total_collection,
            "cash_remittance": r.cash_remittance,
            "buyback_amount_return_paid": r.buyback_amount_return_paid,
            "buyback_closing_cash_in_hand": r.buyback_closing_cash_in_hand,
            "total_remittance_amount": r.total_remittance_amount,
            "actual_cash_submitted": r.actual_cash_submitted,
            "cash_difference": r.cash_difference,
            "cash_sales": r.cash_sales,
            "total_all_payments": r.total_all_payments,
            "notes": r.notes or "",
            "updated_at": r.updated_at.isoformat() if r.updated_at else datetime.utcnow().isoformat(),
        })

    # Format vendor receipts dicts
    rec_list = []
    for rec in receipts:
        liquor_items = [
            {"size_label": i.size_label, "rate": i.rate, "quantity": i.quantity, "amount": i.amount}
            for i in rec.liquor_items
        ]
        beer_items = [
            {"size_label": i.size_label, "rate": i.rate, "quantity": i.quantity, "amount": i.amount}
            for i in rec.beer_items
        ]
        rec_list.append({
            "id": rec.id,
            "receipt_number": rec.receipt_number,
            "receipt_date": rec.receipt_date.isoformat(),
            "receipt_time": rec.receipt_time or "",
            "shop_number": rec.shop_number,
            "scanner_number": rec.scanner_number or "",
            "tin_number": rec.tin_number or "",
            "vendor_name": rec.vendor_name or "",
            "vendor_mobile": rec.vendor_mobile or "",
            "total_liquor_bottles": rec.total_liquor_bottles,
            "total_liquor_amount": rec.total_liquor_amount,
            "total_beer_bottles": rec.total_beer_bottles,
            "total_beer_amount": rec.total_beer_amount,
            "total_bottles": rec.total_bottles,
            "total_payable": rec.total_payable,
            "liquor_items": liquor_items,
            "beer_items": beer_items,
            "notes": rec.notes or "",
            "updated_at": rec.updated_at.isoformat() if rec.updated_at else datetime.utcnow().isoformat(),
        })

    # Audit logs (only provided if user is authenticated admin, otherwise empty)
    audit_list = []
    if user and user.role == "ADMIN":
        logs = db.query(AuditHistory).order_by(desc(AuditHistory.created_at)).limit(50).all()
        for log in logs:
            audit_list.append({
                "id": log.id,
                "user_name": log.user_name,
                "user_role": log.user_role,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "reference_number": log.reference_number,
                "action": log.action,
                "changes_json": log.changes_json,
                "created_at": log.created_at.isoformat(),
            })

    return SyncPullResponse(
        server_time=datetime.utcnow().isoformat(),
        remittances=rem_list,
        vendor_receipts=rec_list,
        audit_logs=audit_list,
    )


@router.post("/push", response_model=SyncPushResponse)
def push_sync_data(
    payload: SyncPushRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Pushes offline or batched mutations to the cloud database.
    CRITICAL SECURITY RULE: Only Admin Annadurai M can push mutations to the cloud.
    View-only users are strictly rejected with 403 Forbidden.
    """
    applied = 0
    now = datetime.utcnow()

    for m in payload.mutations:
        table = m.table.lower()
        action = m.action.upper()
        data = m.data

        if table == "remittances":
            entry_date = date.fromisoformat(data["date"])
            existing = db.query(DailyRemittance).filter(DailyRemittance.date == entry_date).first()

            if action == "DELETE":
                if existing:
                    db.delete(existing)
                    applied += 1
            else:
                # CREATE or UPDATE
                # Run central verified calculation formulas
                calc = calculate_remittance(
                    scan_amount=data.get("scan_amount", 0.0),
                    upi_amount=data.get("upi_amount", 0.0),
                    card_amount=data.get("card_amount", 0.0),
                    online_amount=data.get("online_amount", 0.0),
                    buy_back_sold_bottle=data.get("buy_back_sold_bottle", 0),
                    buy_back_return_bottle=data.get("buy_back_return_bottle", 0),
                    buyback_opening_balance=data.get("buyback_opening_balance", 0.0),
                    shop_number=data.get("shop_number", "11066"),
                    serial_number=data.get("serial_number", ""),
                )

                if existing:
                    for k, v in calc.items():
                        if hasattr(existing, k):
                            setattr(existing, k, v)
                    existing.notes = data.get("notes", "")
                    existing.updated_at = now
                else:
                    new_item = DailyRemittance(
                        date=entry_date,
                        **calc,
                        notes=data.get("notes", ""),
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(new_item)
                db.flush()
                applied += 1

                # Log to audit history
                audit = AuditHistory(
                    user_name=admin.full_name,
                    user_role=admin.role,
                    device_id=payload.device_id,
                    entity_type="DAILY_REMITTANCE",
                    entity_id=existing.id if existing else (new_item.id or 0),
                    reference_number=str(entry_date),
                    action=action,
                    changes_json=f"{action} remittance for {entry_date} via multi-device sync.",
                )
                db.add(audit)

        elif table == "vendor_receipts":
            receipt_num = data.get("receipt_number", "")
            rec_date = date.fromisoformat(data["receipt_date"])
            existing = db.query(VendorReceipt).filter(VendorReceipt.receipt_number == receipt_num).first()

            if action == "DELETE":
                if existing:
                    db.delete(existing)
                    applied += 1
            else:
                totals = calculate_receipt_totals(data.get("liquor_items", []), data.get("beer_items", []))
                if existing:
                    existing.receipt_date = rec_date
                    existing.receipt_time = data.get("receipt_time", "")
                    existing.scanner_number = data.get("scanner_number", "")
                    existing.tin_number = data.get("tin_number", "")
                    existing.vendor_name = data.get("vendor_name", "")
                    existing.vendor_mobile = data.get("vendor_mobile", "")
                    existing.total_liquor_bottles = totals["total_liquor_qty"]
                    existing.total_liquor_amount = totals["total_liquor_amount"]
                    existing.total_beer_bottles = totals["total_beer_qty"]
                    existing.total_beer_amount = totals["total_beer_amount"]
                    existing.total_bottles = totals["total_bottles"]
                    existing.total_payable = totals["total_payable"]
                    existing.notes = data.get("notes", "")
                    existing.updated_at = now
                else:
                    new_rec = VendorReceipt(
                        receipt_number=receipt_num,
                        receipt_date=rec_date,
                        receipt_time=data.get("receipt_time", ""),
                        shop_number="11066",
                        scanner_number=data.get("scanner_number", ""),
                        tin_number=data.get("tin_number", ""),
                        vendor_name=data.get("vendor_name", ""),
                        vendor_mobile=data.get("vendor_mobile", ""),
                        total_liquor_bottles=totals["total_liquor_qty"],
                        total_liquor_amount=totals["total_liquor_amount"],
                        total_beer_bottles=totals["total_beer_qty"],
                        total_beer_amount=totals["total_beer_amount"],
                        total_bottles=totals["total_bottles"],
                        total_payable=totals["total_payable"],
                        notes=data.get("notes", ""),
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(new_rec)
                db.flush()
                applied += 1

                # Log to audit history
                audit = AuditHistory(
                    user_name=admin.full_name,
                    user_role=admin.role,
                    device_id=payload.device_id,
                    entity_type="VENDOR_RECEIPT",
                    entity_id=existing.id if existing else (new_rec.id or 0),
                    reference_number=receipt_num,
                    action=action,
                    changes_json=f"{action} receipt {receipt_num} via multi-device sync.",
                )
                db.add(audit)

    db.commit()

    return SyncPushResponse(
        success=True,
        applied_count=applied,
        server_time=datetime.utcnow().isoformat(),
    )
