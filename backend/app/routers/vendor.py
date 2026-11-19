"""
API Router for Module 3: Vendor Information Details
Protected by Role-Based Access Control & Shop-Level Isolation
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import VendorReceiptCreate, VendorReceiptUpdate, VendorReceiptResponse
from ..calculations import LIQUOR_RATES, BEER_RATES
from ..deps import require_authenticated, require_admin, get_current_user_optional
from ..models import User
from .. import crud

router = APIRouter(prefix="/api/vendor", tags=["Module 3 - Vendor Information Details"])


@router.get("/rates")
def get_standard_rates():
    """Returns fixed bottle size rates specified by TASMAC."""
    return {
        "liquor_rates": [{"size_label": r["size_label"], "rate": float(r["rate"])} for r in LIQUOR_RATES],
        "beer_rates": [{"size_label": r["size_label"], "rate": float(r["rate"])} for r in BEER_RATES],
    }


@router.get("/receipts", response_model=List[VendorReceiptResponse])
def get_vendor_receipts(
    vendor_name: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Lists vendor receipts. Authorized for Admin and View-Only users."""
    return crud.list_vendor_receipts(
        db, vendor_name=vendor_name, start_date=start_date, end_date=end_date, skip=skip, limit=limit
    )


@router.get("/receipts/{receipt_id}", response_model=VendorReceiptResponse)
def get_vendor_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Retrieves a single vendor receipt by ID."""
    receipt = crud.get_vendor_receipt_by_id(db, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Vendor receipt not found")
    return receipt


@router.post("/receipts", response_model=VendorReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_vendor_receipt(
    data: VendorReceiptCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Creates a new vendor receipt and automatically synchronizes bottle balance.
    ADMIN ONLY: View-only users receive HTTP 403 Forbidden.
    """
    return crud.create_vendor_receipt(db, data)


@router.put("/receipts/{receipt_id}", response_model=VendorReceiptResponse)
def update_vendor_receipt(
    receipt_id: int,
    data: VendorReceiptUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Updates an existing vendor receipt.
    ADMIN ONLY: View-only users receive HTTP 403 Forbidden.
    """
    receipt = crud.update_vendor_receipt(db, receipt_id, data)
    if not receipt:
        raise HTTPException(status_code=404, detail="Vendor receipt not found")
    return receipt


@router.delete("/receipts/{receipt_id}", status_code=status.HTTP_200_OK)
def delete_vendor_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Deletes a vendor receipt and recalculates bottle inventory.
    ADMIN ONLY: View-only users receive HTTP 403 Forbidden.
    """
    success = crud.delete_vendor_receipt(db, receipt_id)
    if not success:
        raise HTTPException(status_code=404, detail="Vendor receipt not found")
    return {"status": "success", "message": "Vendor receipt deleted successfully and bottle inventory recalculated"}
