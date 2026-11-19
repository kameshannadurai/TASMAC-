"""
API Router for Module 3: Vendor Information Details
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import VendorReceiptCreate, VendorReceiptUpdate, VendorReceiptResponse
from ..calculations import LIQUOR_RATES, BEER_RATES
from ..deps import get_current_user_optional
from ..models import User
from .. import crud

router = APIRouter(prefix="/api/vendor", tags=["Module 3 - Vendor Information Details"])


def check_admin_mutation(user: Optional[User] = Depends(get_current_user_optional)):
    if user and user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: View-Only users cannot add, edit, or delete vendor receipts. Admin Annadurai M access only.",
        )
    return user


@router.get("/rates")
def get_standard_rates():
    """Returns fixed bottle size rates specified by TASMAC"""
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
):
    return crud.list_vendor_receipts(
        db, vendor_name=vendor_name, start_date=start_date, end_date=end_date, skip=skip, limit=limit
    )


@router.get("/receipts/{receipt_id}", response_model=VendorReceiptResponse)
def get_vendor_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = crud.get_vendor_receipt_by_id(db, receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Vendor receipt not found")
    return receipt


@router.post("/receipts", response_model=VendorReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_vendor_receipt(
    data: VendorReceiptCreate,
    db: Session = Depends(get_db),
    admin: Optional[User] = Depends(check_admin_mutation),
):
    return crud.create_vendor_receipt(db, data)


@router.put("/receipts/{receipt_id}", response_model=VendorReceiptResponse)
def update_vendor_receipt(
    receipt_id: int,
    data: VendorReceiptUpdate,
    db: Session = Depends(get_db),
    admin: Optional[User] = Depends(check_admin_mutation),
):
    receipt = crud.update_vendor_receipt(db, receipt_id, data)
    if not receipt:
        raise HTTPException(status_code=404, detail="Vendor receipt not found")
    return receipt


@router.delete("/receipts/{receipt_id}", status_code=status.HTTP_200_OK)
def delete_vendor_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    admin: Optional[User] = Depends(check_admin_mutation),
):
    success = crud.delete_vendor_receipt(db, receipt_id)
    if not success:
        raise HTTPException(status_code=404, detail="Vendor receipt not found")
    return {"status": "success", "message": "Vendor receipt deleted successfully and bottle inventory recalculated"}

