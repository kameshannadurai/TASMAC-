"""
SQLAlchemy Database Models for TASMAC Shop No. 11066
"""

from datetime import datetime, date, time
from sqlalchemy import Column, Integer, String, Float, Date, Time, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), default="ANNADURAI M")
    mobile_number = Column(String(20), unique=True, index=True, nullable=True)
    shop_number = Column(String(20), default="11066")
    role = Column(String(20), default="VIEW_ONLY", nullable=False)  # ADMIN or VIEW_ONLY
    password_hash = Column(String(255), nullable=True)
    pin = Column(String(100), nullable=True)  # Quick PIN login
    is_active = Column(Integer, default=1)   # 1: Active, 0: Deactivated
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class DailyRemittance(Base):
    __tablename__ = "daily_remittances"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False, index=True)  # One entry per day
    shop_number = Column(String(20), default="11066")
    serial_number = Column(String(50), nullable=True)
    scan_amount = Column(Float, default=0.0)
    total_sales_amount = Column(Float, default=0.0)
    sales_bottle = Column(Integer, default=0)
    upi_amount = Column(Float, default=0.0)
    card_amount = Column(Float, default=0.0)
    online_amount = Column(Float, default=0.0)

    # Buyback Details
    buyback_opening_balance = Column(Float, default=0.0)
    buy_back_sold_bottle = Column(Integer, default=0)
    buy_back_sold_amount = Column(Float, default=0.0)
    buy_back_return_bottle = Column(Integer, default=0)
    buy_back_return_amount = Column(Float, default=0.0)
    previous_buyback_remittance = Column(Float, default=0.0)

    # Remittance Calculations
    total_collection = Column(Float, default=0.0)
    cash_remittance = Column(Float, default=0.0)
    buyback_amount_return_paid = Column(Float, default=0.0)
    buyback_closing_cash_in_hand = Column(Float, default=0.0)
    total_remittance_amount = Column(Float, default=0.0)
    actual_cash_submitted = Column(Float, default=0.0)
    cash_difference = Column(Float, default=0.0)

    # Compatibility fields
    cash_sales = Column(Float, default=0.0)
    total_all_payments = Column(Float, default=0.0)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VendorReceipt(Base):
    __tablename__ = "vendor_receipts"

    id = Column(Integer, primary_key=True, index=True)
    receipt_number = Column(String(50), unique=True, nullable=False, index=True)
    receipt_date = Column(Date, nullable=False, index=True)
    receipt_time = Column(String(10), nullable=True)  # e.g., "14:30"
    shop_number = Column(String(20), default="11066")
    scanner_number = Column(String(50), nullable=True)
    tin_number = Column(String(50), nullable=True)
    vendor_name = Column(String(100), nullable=True, default="", index=True)
    vendor_mobile = Column(String(20), nullable=True)

    total_liquor_bottles = Column(Integer, default=0)
    total_liquor_amount = Column(Float, default=0.0)
    total_beer_bottles = Column(Integer, default=0)
    total_beer_amount = Column(Float, default=0.0)
    total_bottles = Column(Integer, default=0)
    total_payable = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    liquor_items = relationship(
        "VendorReceiptLiquorItem",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="VendorReceiptLiquorItem.id",
    )
    beer_items = relationship(
        "VendorReceiptBeerItem",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="VendorReceiptBeerItem.id",
    )


class VendorReceiptLiquorItem(Base):
    __tablename__ = "vendor_receipt_liquor_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("vendor_receipts.id", ondelete="CASCADE"), nullable=False)
    size_label = Column(String(50), nullable=False)
    rate = Column(Float, nullable=False)
    quantity = Column(Integer, default=0)
    amount = Column(Float, default=0.0)

    receipt = relationship("VendorReceipt", back_populates="liquor_items")


class VendorReceiptBeerItem(Base):
    __tablename__ = "vendor_receipt_beer_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("vendor_receipts.id", ondelete="CASCADE"), nullable=False)
    size_label = Column(String(50), nullable=False)
    rate = Column(Float, nullable=False)
    quantity = Column(Integer, default=0)
    amount = Column(Float, default=0.0)

    receipt = relationship("VendorReceipt", back_populates="beer_items")


class BottleInventoryTransaction(Base):
    __tablename__ = "bottle_inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    transaction_type = Column(String(30), nullable=False)  # REMITTANCE_RETURN or VENDOR_COLLECTION
    reference_id = Column(Integer, nullable=False)
    reference_number = Column(String(50), nullable=True)
    bottles_in = Column(Integer, default=0)   # From buy back return
    bottles_out = Column(Integer, default=0)  # From vendor collection
    running_balance = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditHistory(Base):
    __tablename__ = "audit_history"

    id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String(100), default="ANNADURAI M")
    user_role = Column(String(20), default="ADMIN")
    device_id = Column(String(100), nullable=True)
    entity_type = Column(String(50), nullable=False)  # REMITTANCE or VENDOR_RECEIPT
    entity_id = Column(Integer, nullable=True)
    reference_number = Column(String(100), nullable=True)
    action = Column(String(20), nullable=False)       # CREATE, UPDATE, DELETE
    changes_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProcessedSyncMutation(Base):
    __tablename__ = "processed_sync_mutations"

    id = Column(Integer, primary_key=True, index=True)
    client_mutation_id = Column(String(100), unique=True, index=True, nullable=False)
    device_id = Column(String(100), nullable=True)
    table_name = Column(String(50), nullable=False)
    applied_at = Column(DateTime, default=datetime.utcnow)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    jti = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Integer, default=0, nullable=False)  # 0 = active, 1 = revoked
    created_at = Column(DateTime, default=datetime.utcnow)
    replaced_by = Column(String(64), nullable=True)  # JTI of replacement token for rotation



