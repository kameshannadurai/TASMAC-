"""
Database connection and session handling for TASMAC Shop No. 11066
Seamlessly supports both local SQLite (offline) and Supabase PostgreSQL (cloud)
"""

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool
from .config import DATABASE_URL

# Engine configuration tailored to database dialect
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    poolclass = StaticPool if ":memory:" in DATABASE_URL else None
    engine = create_engine(DATABASE_URL, connect_args=connect_args, poolclass=poolclass)

    # Enable SQLite foreign keys and WAL mode for high reliability
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
        except Exception:
            pass
        cursor.close()
else:
    # PostgreSQL / Supabase connection pool configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Automatically tests connection freshness
        pool_size=10,
        max_overflow=20,
        pool_recycle=300,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def migrate_db_columns():
    """
    Safely adds newly required columns to existing SQLite and PostgreSQL database tables.
    Never deletes tables or drops existing data.
    Preserves all Shop No. 11066 transaction history.
    """
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    is_sqlite = DATABASE_URL.startswith("sqlite")

    with engine.begin() as conn:
        # 1. Check users table columns
        if "users" in table_names:
            cols = {c["name"] for c in inspector.get_columns("users")}
            user_cols_to_add = {
                "mobile_number": "VARCHAR(20)",
                "role": "VARCHAR(20) DEFAULT 'VIEW_ONLY'",
                "password_hash": "VARCHAR(255)",
                "is_active": "INTEGER DEFAULT 1",
                "last_login": "DATETIME" if is_sqlite else "TIMESTAMP",
            }
            for col, col_type in user_cols_to_add.items():
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))

            # Guarantee primary Admin ANNADURAI M with mobile 9443626183
            conn.execute(
                text("UPDATE users SET mobile_number = '9443626183', role = 'ADMIN', full_name = 'ANNADURAI M' WHERE username = 'annadurai'")
            )

        # 1b. Ensure refresh_tokens table exists
        if "refresh_tokens" not in table_names:
            if is_sqlite:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS refresh_tokens (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        token_hash VARCHAR(128) NOT NULL UNIQUE,
                        jti VARCHAR(64) NOT NULL UNIQUE,
                        expires_at DATETIME NOT NULL,
                        revoked INTEGER NOT NULL DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        replaced_by VARCHAR(64),
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);
                    CREATE INDEX IF NOT EXISTS ix_refresh_tokens_jti ON refresh_tokens (jti);
                    CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id);
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS refresh_tokens (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        token_hash VARCHAR(128) NOT NULL UNIQUE,
                        jti VARCHAR(64) NOT NULL UNIQUE,
                        expires_at TIMESTAMP NOT NULL,
                        revoked INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        replaced_by VARCHAR(64)
                    );
                    CREATE INDEX IF NOT EXISTS ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);
                    CREATE INDEX IF NOT EXISTS ix_refresh_tokens_jti ON refresh_tokens (jti);
                    CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id);
                """))

        # 2. Check daily_remittances columns
        if "daily_remittances" in table_names:
            cols = {c["name"] for c in inspector.get_columns("daily_remittances")}
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
            for col, col_type in rem_cols_to_add.items():
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE daily_remittances ADD COLUMN {col} {col_type}"))

        # 3. Check audit_history columns
        if "audit_history" in table_names:
            cols = {c["name"] for c in inspector.get_columns("audit_history")}
            audit_cols_to_add = {
                "user_name": "VARCHAR(100) DEFAULT 'ANNADURAI M'",
                "user_role": "VARCHAR(20) DEFAULT 'ADMIN'",
                "device_id": "VARCHAR(100)",
                "reference_number": "VARCHAR(100)",
            }
            for col, col_type in audit_cols_to_add.items():
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE audit_history ADD COLUMN {col} {col_type}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
