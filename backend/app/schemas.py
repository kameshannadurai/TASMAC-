"""
Pydantic Schemas for TASMAC Shop No. 11066
"""

from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


# User & Auth
class UserBase(BaseModel):
    username: str
    full_name: str = "ANNADURAI M"
    mobile_number: Optional[str] = None
    shop_number: str = "11066"
    role: str = "VIEW_ONLY"  # "ADMIN" or "VIEW_ONLY"
    is_active: int = 1


class UserLogin(BaseModel):
    username: Optional[str] = None
    identifier: Optional[str] = None
    mobile_number: Optional[str] = None
    password: Optional[str] = None
    pin: Optional[str] = None


class UserCreate(BaseModel):
    username: Optional[str] = None
    name: Optional[str] = None
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None
    password: str
    role: Optional[str] = "VIEW_ONLY"
    shop_number: Optional[str] = "11066"


class UserStatusUpdate(BaseModel):
    is_active: int  # 1 or 0


class UserUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None


class UserResetPassword(BaseModel):
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class UserResponse(UserBase):
    id: int
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: int = 1800  # 30 minutes in seconds
    token_type: str = "bearer"
    user: UserResponse


# Module 1: Remittance
class RemittanceBase(BaseModel):
    date: date
    shop_number: Optional[str] = "11066"
    serial_number: Optional[str] = ""
    scan_amount: float = Field(default=0.0, ge=0.0)
    total_sales_amount: float = Field(default=0.0, ge=0.0)
    sales_bottle: int = Field(default=0, ge=0)
    upi_amount: float = Field(default=0.0, ge=0.0)
    card_amount: float = Field(default=0.0, ge=0.0)
    online_amount: float = Field(default=0.0, ge=0.0)
    buyback_opening_balance: float = Field(default=0.0, ge=0.0)
    buy_back_sold_bottle: int = Field(default=0, ge=0)
    buy_back_return_bottle: int = Field(default=0, ge=0)
    actual_cash_submitted: Optional[float] = None
    notes: Optional[str] = None


class RemittanceCreate(RemittanceBase):
    pass


class RemittanceUpdate(BaseModel):
    shop_number: Optional[str] = None
    serial_number: Optional[str] = None
    scan_amount: Optional[float] = Field(default=None, ge=0.0)
    total_sales_amount: Optional[float] = Field(default=None, ge=0.0)
    sales_bottle: Optional[int] = Field(default=None, ge=0)
    upi_amount: Optional[float] = Field(default=None, ge=0.0)
    card_amount: Optional[float] = Field(default=None, ge=0.0)
    online_amount: Optional[float] = Field(default=None, ge=0.0)
    buyback_opening_balance: Optional[float] = Field(default=None, ge=0.0)
    buy_back_sold_bottle: Optional[int] = Field(default=None, ge=0)
    buy_back_return_bottle: Optional[int] = Field(default=None, ge=0)
    actual_cash_submitted: Optional[float] = None
    notes: Optional[str] = None


class RemittanceResponse(RemittanceBase):
    id: int
    buy_back_sold_amount: float
    buy_back_return_amount: float
    previous_buyback_remittance: float = 0.0
    total_collection: float = 0.0
    cash_remittance: float = 0.0
    buyback_amount_return_paid: float = 0.0
    buyback_closing_cash_in_hand: float = 0.0
    total_remittance_amount: float = 0.0
    actual_cash_submitted: float = 0.0
    cash_difference: float = 0.0
    cash_sales: float = 0.0
    total_all_payments: float = 0.0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Module 3: Vendor Receipt Items
class ReceiptItemInput(BaseModel):
    size_label: str
    rate: float
    quantity: int = Field(default=0, ge=0)


class ReceiptItemResponse(ReceiptItemInput):
    id: int
    amount: float
    model_config = ConfigDict(from_attributes=True)


class VendorReceiptCreate(BaseModel):
    receipt_date: date
    receipt_time: Optional[str] = None
    shop_number: str = "11066"
    scanner_number: Optional[str] = None
    tin_number: Optional[str] = None
    vendor_name: Optional[str] = ""
    vendor_mobile: Optional[str] = None
    liquor_items: List[ReceiptItemInput]
    beer_items: List[ReceiptItemInput]
    notes: Optional[str] = None


class VendorReceiptUpdate(BaseModel):
    receipt_date: Optional[date] = None
    receipt_time: Optional[str] = None
    scanner_number: Optional[str] = None
    tin_number: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_mobile: Optional[str] = None
    liquor_items: Optional[List[ReceiptItemInput]] = None
    beer_items: Optional[List[ReceiptItemInput]] = None
    notes: Optional[str] = None


class VendorReceiptResponse(BaseModel):
    id: int
    receipt_number: str
    receipt_date: date
    receipt_time: Optional[str]
    shop_number: str
    scanner_number: Optional[str]
    tin_number: Optional[str]
    vendor_name: Optional[str] = ""
    vendor_mobile: Optional[str]
    total_liquor_bottles: int
    total_liquor_amount: float
    total_beer_bottles: int
    total_beer_amount: float
    total_bottles: int
    total_payable: float
    notes: Optional[str]
    liquor_items: List[ReceiptItemResponse] = []
    beer_items: List[ReceiptItemResponse] = []
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Module 2: Bottle Inventory Summary & History
class BottleInventorySummary(BaseModel):
    initial_recorded_date: Optional[str] = None
    total_available_bottles: int
    total_vendor_collected_bottles: int
    remaining_bottles: int
    has_warning: bool
    warning_message: Optional[str] = None


class BottleHistoryEntry(BaseModel):
    date: date
    buy_back_return_bottles: int
    vendor_collected_bottles: int
    remaining_bottles: int
    notes: Optional[str] = None


# Dashboard Stats
class DashboardStats(BaseModel):
    today_date: str
    today_total_sales: float
    today_return_bottles: int
    total_available_bottles: int
    total_vendor_collected_bottles: int
    remaining_bottles: int
    has_warning: bool
    warning_message: Optional[str] = None


# Audit History
class AuditHistoryEntry(BaseModel):
    id: int
    user_name: str
    user_role: str
    device_id: Optional[str] = None
    entity_type: str
    entity_id: Optional[int] = None
    reference_number: Optional[str] = None
    action: str
    changes_json: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Multi-Device Internet Sync Schemas
class SyncPushMutation(BaseModel):
    table: str  # "remittances" or "vendor_receipts"
    action: str # "CREATE", "UPDATE", "DELETE"
    data: dict
    client_mutation_id: Optional[str] = None


class SyncPushRequest(BaseModel):
    mutations: List[SyncPushMutation]
    device_id: Optional[str] = None


class SyncPushResponse(BaseModel):
    success: bool
    applied_count: int
    server_time: str


class SyncPullResponse(BaseModel):
    server_time: str
    remittances: List[dict]
    vendor_receipts: List[dict]
    audit_logs: List[dict]


