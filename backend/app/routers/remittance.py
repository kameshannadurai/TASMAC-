"""
API Router for Module 1: Total Remittance
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import RemittanceCreate, RemittanceUpdate, RemittanceResponse
from ..deps import get_current_user_optional
from ..models import User
from .. import crud

router = APIRouter(prefix="/api/remittance", tags=["Module 1 - Remittance"])


def check_admin_mutation(user: Optional[User] = Depends(get_current_user_optional)):
    if user and user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: View-Only users cannot create, modify, or delete remittance records. Admin Annadurai M access only.",
        )
    return user


@router.get("", response_model=List[RemittanceResponse])
def get_remittances(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1),
    db: Session = Depends(get_db),
):
    return crud.list_remittances(db, start_date=start_date, end_date=end_date, skip=skip, limit=limit)


@router.get("/by-date/{record_date}", response_model=Optional[RemittanceResponse])
def get_remittance_by_date(record_date: date, db: Session = Depends(get_db)):
    remittance = crud.get_remittance_by_date(db, record_date)
    if not remittance:
        raise HTTPException(status_code=404, detail="No remittance record found for this date")
    return remittance


@router.get("/{remittance_id}", response_model=RemittanceResponse)
def get_remittance(remittance_id: int, db: Session = Depends(get_db)):
    remittance = crud.get_remittance_by_id(db, remittance_id)
    if not remittance:
        raise HTTPException(status_code=404, detail="Remittance not found")
    return remittance


@router.post("", response_model=RemittanceResponse, status_code=status.HTTP_201_CREATED)
def create_remittance(
    data: RemittanceCreate,
    db: Session = Depends(get_db),
    admin: Optional[User] = Depends(check_admin_mutation),
):
    try:
        return crud.create_remittance(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{remittance_id}", response_model=RemittanceResponse)
def update_remittance(
    remittance_id: int,
    data: RemittanceUpdate,
    db: Session = Depends(get_db),
    admin: Optional[User] = Depends(check_admin_mutation),
):
    remittance = crud.update_remittance(db, remittance_id, data)
    if not remittance:
        raise HTTPException(status_code=404, detail="Remittance not found")
    return remittance


@router.delete("/{remittance_id}", status_code=status.HTTP_200_OK)
def delete_remittance(
    remittance_id: int,
    db: Session = Depends(get_db),
    admin: Optional[User] = Depends(check_admin_mutation),
):
    success = crud.delete_remittance(db, remittance_id)
    if not success:
        raise HTTPException(status_code=404, detail="Remittance not found")
    return {"status": "success", "message": "Remittance deleted successfully and bottle inventory recalculated"}

