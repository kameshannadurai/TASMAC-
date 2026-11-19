"""
API Router for Database Backup and Restore
"""

from typing import Dict, Any
from datetime import datetime
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import json

from ..database import get_db, Base, engine
from ..config import DATABASE_FILE
from ..models import (
    User,
    DailyRemittance,
    VendorReceipt,
    VendorReceiptLiquorItem,
    VendorReceiptBeerItem,
    BottleInventoryTransaction,
    AuditHistory,
)

router = APIRouter(prefix="/api/backup", tags=["Database Backup and Restore"])


@router.get("/export-json")
def export_database_json(db: Session = Depends(get_db)):
    """Export all database tables into portable JSON"""
    remittances = [
        {
            "id": r.id,
            "date": str(r.date),
            "scan_amount": r.scan_amount,
            "total_sales_amount": r.total_sales_amount,
            "upi_amount": r.upi_amount,
            "card_amount": r.card_amount,
            "online_amount": r.online_amount,
            "buy_back_sold_bottle": r.buy_back_sold_bottle,
            "buy_back_sold_amount": r.buy_back_sold_amount,
            "buy_back_return_bottle": r.buy_back_return_bottle,
            "buy_back_return_amount": r.buy_back_return_amount,
            "cash_sales": r.cash_sales,
            "total_all_payments": r.total_all_payments,
            "notes": r.notes,
        }
        for r in db.query(DailyRemittance).all()
    ]

    receipts = []
    for rc in db.query(VendorReceipt).all():
        receipts.append({
            "id": rc.id,
            "receipt_number": rc.receipt_number,
            "receipt_date": str(rc.receipt_date),
            "receipt_time": rc.receipt_time,
            "shop_number": rc.shop_number,
            "scanner_number": rc.scanner_number,
            "tin_number": rc.tin_number,
            "vendor_name": rc.vendor_name,
            "vendor_mobile": rc.vendor_mobile,
            "total_liquor_bottles": rc.total_liquor_bottles,
            "total_liquor_amount": rc.total_liquor_amount,
            "total_beer_bottles": rc.total_beer_bottles,
            "total_beer_amount": rc.total_beer_amount,
            "total_bottles": rc.total_bottles,
            "total_payable": rc.total_payable,
            "notes": rc.notes,
            "liquor_items": [
                {"size_label": i.size_label, "rate": i.rate, "quantity": i.quantity, "amount": i.amount}
                for i in rc.liquor_items
            ],
            "beer_items": [
                {"size_label": i.size_label, "rate": i.rate, "quantity": i.quantity, "amount": i.amount}
                for i in rc.beer_items
            ],
        })

    audit_logs = [
        {
            "id": a.id,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "action": a.action,
            "changes_json": a.changes_json,
            "created_at": str(a.created_at),
        }
        for a in db.query(AuditHistory).all()
    ]

    return {
        "shop_number": "11066",
        "app_title": "TASMAC SHOP NO. 11066",
        "exported_at": datetime.utcnow().isoformat(),
        "remittances": remittances,
        "vendor_receipts": receipts,
        "audit_logs": audit_logs,
    }


@router.get("/download-sqlite")
def download_sqlite_file():
    """Download the raw SQLite database file directly"""
    if not os.path.exists(DATABASE_FILE):
        raise HTTPException(status_code=404, detail="Database file not found")
    return FileResponse(
        path=str(DATABASE_FILE),
        filename=f"tasmac_shop11066_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db",
        media_type="application/x-sqlite3",
    )


@router.post("/restore-json")
def restore_database_json(data: Dict[str, Any], db: Session = Depends(get_db)):
    """Restore database state from an uploaded JSON backup"""
    try:
        from ..schemas import RemittanceCreate, VendorReceiptCreate, ReceiptItemInput
        from .. import crud
        from datetime import datetime as dt

        # Clear existing tables safely
        db.query(AuditHistory).delete()
        db.query(BottleInventoryTransaction).delete()
        db.query(VendorReceiptLiquorItem).delete()
        db.query(VendorReceiptBeerItem).delete()
        db.query(VendorReceipt).delete()
        db.query(DailyRemittance).delete()
        db.commit()

        # Re-import remittances
        for r in data.get("remittances", []):
            rc = RemittanceCreate(
                date=dt.strptime(r["date"], "%Y-%m-%d").date(),
                scan_amount=r.get("scan_amount", 0.0),
                total_sales_amount=r.get("total_sales_amount", 0.0),
                upi_amount=r.get("upi_amount", 0.0),
                card_amount=r.get("card_amount", 0.0),
                online_amount=r.get("online_amount", 0.0),
                buy_back_sold_bottle=r.get("buy_back_sold_bottle", 0),
                buy_back_return_bottle=r.get("buy_back_return_bottle", 0),
                notes=r.get("notes"),
            )
            crud.create_remittance(db, rc)

        # Re-import vendor receipts
        for v in data.get("vendor_receipts", []):
            vc = VendorReceiptCreate(
                receipt_date=dt.strptime(v["receipt_date"], "%Y-%m-%d").date(),
                receipt_time=v.get("receipt_time"),
                shop_number="11066",
                scanner_number=v.get("scanner_number"),
                tin_number=v.get("tin_number"),
                vendor_name=v.get("vendor_name"),
                vendor_mobile=v.get("vendor_mobile"),
                liquor_items=[ReceiptItemInput(**item) for item in v.get("liquor_items", [])],
                beer_items=[ReceiptItemInput(**item) for item in v.get("beer_items", [])],
                notes=v.get("notes"),
            )
            crud.create_vendor_receipt(db, vc)

        return {"status": "success", "message": "Database successfully restored from backup!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Restore failed: {str(e)}")

