"""
Database connection and session handling for TASMAC Shop No. 11066
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import DATABASE_URL

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Enable SQLite foreign keys and WAL mode for reliability
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def migrate_db_columns():
    """Safely adds newly required columns to existing SQLite database tables."""
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        # Check users table columns
        cursor = conn.connection.cursor()
        cursor.execute("PRAGMA table_info(users)")
        user_cols = {row[1] for row in cursor.fetchall()}

        if "mobile_number" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN mobile_number VARCHAR(20)")
        if "role" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'VIEW_ONLY'")
        if "password_hash" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")
        if "is_active" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1")
        if "last_login" not in user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN last_login DATETIME")

        # Guarantee Annadurai M is Admin with mobile number
        cursor.execute("UPDATE users SET mobile_number = '9842111066', role = 'ADMIN' WHERE username = 'annadurai'")

        # Check daily_remittances columns
        cursor.execute("PRAGMA table_info(daily_remittances)")
        rem_cols = {row[1] for row in cursor.fetchall()}
        rem_cols_to_add = {
            "shop_number": "VARCHAR(20) DEFAULT '11066'",
            "serial_number": "VARCHAR(50)",
            "sales_bottle": "INTEGER DEFAULT 0",
            "buyback_opening_balance": "FLOAT DEFAULT 0.0",
            "previous_buyback_remittance": "FLOAT DEFAULT 0.0",
            "total_collection": "FLOAT DEFAULT 0.0",
            "cash_remittance": "FLOAT DEFAULT 0.0",
            "buyback_amount_return_paid": "FLOAT DEFAULT 0.0",
            "buyback_closing_cash_in_hand": "FLOAT DEFAULT 0.0",
            "total_remittance_amount": "FLOAT DEFAULT 0.0",
            "actual_cash_submitted": "FLOAT DEFAULT 0.0",
            "cash_difference": "FLOAT DEFAULT 0.0",
        }
        for col_name, col_type in rem_cols_to_add.items():
            if col_name not in rem_cols:
                cursor.execute(f"ALTER TABLE daily_remittances ADD COLUMN {col_name} {col_type}")

        # Check audit_history columns
        cursor.execute("PRAGMA table_info(audit_history)")
        audit_cols = {row[1] for row in cursor.fetchall()}

        if "user_name" not in audit_cols:
            cursor.execute("ALTER TABLE audit_history ADD COLUMN user_name VARCHAR(100) DEFAULT 'ANNADURAI M'")
        if "user_role" not in audit_cols:
            cursor.execute("ALTER TABLE audit_history ADD COLUMN user_role VARCHAR(20) DEFAULT 'ADMIN'")
        if "device_id" not in audit_cols:
            cursor.execute("ALTER TABLE audit_history ADD COLUMN device_id VARCHAR(100)")
        if "reference_number" not in audit_cols:
            cursor.execute("ALTER TABLE audit_history ADD COLUMN reference_number VARCHAR(100)")

        conn.connection.commit()
        cursor.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

