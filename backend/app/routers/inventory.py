"""
API Router for Module 2: Vendor Bottle Management
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import BottleInventorySummary, BottleHistoryEntry, DashboardStats
from .. import crud

router = APIRouter(prefix="/api/inventory", tags=["Module 2 - Vendor Bottle Management"])


@router.get("/summary", response_model=BottleInventorySummary)
def get_inventory_summary(db: Session = Depends(get_db)):
    """
    Returns the real-time bottle balance:
    Total Bottles Available = Cumulative Buy Back Return Bottles
    Total Vendor Empty Collected Bottles = Sum of saved vendor receipts
    Remaining Bottles = Available - Collected
    """
    return crud.get_inventory_summary(db)


@router.get("/history", response_model=List[BottleHistoryEntry])
def get_bottle_history(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    return crud.get_bottle_history(db, start_date=start_date, end_date=end_date)


@router.get("/dashboard-stats", response_model=DashboardStats)
def get_dashboard_stats(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    today = target_date or date.today()
    return crud.get_dashboard_stats(db, today=today)

