"""
API Router for Reports and Analytics
"""

from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from ..database import get_db
from ..models import DailyRemittance, VendorReceipt
from .. import crud

router = APIRouter(prefix="/api/reports", tags=["Reports and Analytics"])


@router.get("/summary")
def get_reports_overview(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    rem_q = db.query(DailyRemittance)
    ven_q = db.query(VendorReceipt)
    if start_date:
        rem_q = rem_q.filter(DailyRemittance.date >= start_date)
        ven_q = ven_q.filter(VendorReceipt.receipt_date >= start_date)
    if end_date:
        rem_q = rem_q.filter(DailyRemittance.date <= end_date)
        ven_q = ven_q.filter(VendorReceipt.receipt_date <= end_date)

    # Remittance totals
    total_sales = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.total_sales_amount), 0.0)).scalar() or 0.0
    total_upi = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.upi_amount), 0.0)).scalar() or 0.0
    total_card = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.card_amount), 0.0)).scalar() or 0.0
    total_online = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.online_amount), 0.0)).scalar() or 0.0
    total_scan = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.scan_amount), 0.0)).scalar() or 0.0
    total_cash = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.cash_sales), 0.0)).scalar() or 0.0
    total_all_payments = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.total_all_payments), 0.0)).scalar() or 0.0
    total_sold_bottles = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.buy_back_sold_bottle), 0)).scalar() or 0
    total_sold_amount = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.buy_back_sold_amount), 0.0)).scalar() or 0.0
    total_return_bottles = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.buy_back_return_bottle), 0)).scalar() or 0
    total_return_amount = rem_q.with_entities(func.coalesce(func.sum(DailyRemittance.buy_back_return_amount), 0.0)).scalar() or 0.0

    # Vendor receipt totals
    vendor_receipts_count = ven_q.count()
    vendor_bottles_collected = ven_q.with_entities(func.coalesce(func.sum(VendorReceipt.total_bottles), 0)).scalar() or 0
    vendor_payable_sum = ven_q.with_entities(func.coalesce(func.sum(VendorReceipt.total_payable), 0.0)).scalar() or 0.0

    # Vendor-wise breakdown
    vendor_breakdown = (
        ven_q.with_entities(
            VendorReceipt.vendor_name,
            func.count(VendorReceipt.id).label("receipt_count"),
            func.sum(VendorReceipt.total_bottles).label("bottles"),
            func.sum(VendorReceipt.total_payable).label("payable"),
        )
        .group_by(VendorReceipt.vendor_name)
        .order_by(desc("bottles"))
        .all()
    )

    inv_summary = crud.get_inventory_summary(db)

    return {
        "start_date": str(start_date) if start_date else None,
        "end_date": str(end_date) if end_date else None,
        "remittance": {
            "total_sales": float(total_sales),
            "total_upi": float(total_upi),
            "total_card": float(total_card),
            "total_online": float(total_online),
            "total_scan": float(total_scan),
            "total_cash": float(total_cash),
            "total_all_payments": float(total_all_payments),
            "buy_back_sold_bottles": int(total_sold_bottles),
            "buy_back_sold_amount": float(total_sold_amount),
            "buy_back_return_bottles": int(total_return_bottles),
            "buy_back_return_amount": float(total_return_amount),
        },
        "inventory": inv_summary,
        "vendor": {
            "receipts_count": vendor_receipts_count,
            "total_bottles_collected": int(vendor_bottles_collected),
            "total_payable": float(vendor_payable_sum),
            "vendors": [
                {
                    "vendor_name": v[0],
                    "receipt_count": v[1],
                    "total_bottles": int(v[2] or 0),
                    "total_payable": float(v[3] or 0.0),
                }
                for v in vendor_breakdown
            ],
        },
    }

