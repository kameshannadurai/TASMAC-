"""
FastAPI Application Entry Point for TASMAC Shop No. 11066
Supports Render Cloud Deployment & Supabase PostgreSQL
"""

from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import Base, engine, SessionLocal, migrate_db_columns, get_db
from .config import (
    SHOP_NUMBER,
    WELCOME_NAME,
    SHOP_TITLE,
    DEFAULT_USERNAME,
    DEFAULT_FULL_NAME,
    DEFAULT_MOBILE,
    DEFAULT_PIN,
    VIEW_ONLY_STAFF,
    CORS_ORIGINS,
    DATABASE_URL,
)
from .models import User
from .security import hash_password
from .routers import remittance, inventory, vendor, reports, backup, auth, sync


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and schema columns are upgraded safely
    Base.metadata.create_all(bind=engine)
    migrate_db_columns()

    # Seed & Protect Primary Administrator (ANNADURAI M)
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == DEFAULT_USERNAME).first()
        if not admin:
            admin = User(
                username=DEFAULT_USERNAME,
                full_name=DEFAULT_FULL_NAME,
                mobile_number=DEFAULT_MOBILE,
                shop_number=SHOP_NUMBER,
                role="ADMIN",
                password_hash=hash_password(DEFAULT_PIN),
                pin=DEFAULT_PIN,
                is_active=1,
            )
            db.add(admin)
            db.commit()
        else:
            # Protect admin credentials: NEVER overwrite existing password_hash
            admin.role = "ADMIN"
            admin.full_name = DEFAULT_FULL_NAME
            admin.shop_number = SHOP_NUMBER
            admin.is_active = 1
            if not admin.password_hash:
                admin.password_hash = hash_password(admin.pin or DEFAULT_PIN)
            db.commit()

        # Seed pre-authorized View-Only Staff (PREM & SELVAKUMAR)
        for staff_info in VIEW_ONLY_STAFF:
            staff = db.query(User).filter(User.username == staff_info["username"]).first()
            if not staff:
                staff = User(
                    username=staff_info["username"],
                    full_name=staff_info["full_name"],
                    mobile_number=staff_info["mobile_number"],
                    shop_number=SHOP_NUMBER,
                    role="VIEW_ONLY",
                    password_hash=hash_password("11066"),
                    pin="11066",
                    is_active=1,
                )
                db.add(staff)
                db.commit()
    finally:
        db.close()

    yield

    # Shutdown: clean up connection pool
    try:
        engine.dispose()
    except Exception:
        pass


app = FastAPI(
    title=SHOP_TITLE,
    description="TASMAC Shop Management System - Shop No. 11066 (Annadurai M)",
    version="1.2.1",
    lifespan=lifespan,
)

# Production-ready CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(remittance.router)
app.include_router(inventory.router)
app.include_router(vendor.router)
app.include_router(reports.router)
app.include_router(backup.router)


@app.get("/api/shop-info")
def get_shop_info():
    """Returns general public shop branding without exposing confidential credentials."""
    return {
        "shop_number": SHOP_NUMBER,
        "welcome_name": WELCOME_NAME,
        "shop_title": SHOP_TITLE,
        "status": "online",
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Production health-check endpoint.
    Performs active database query check without exposing credentials or internal connection strings.
    """
    db_type = "postgresql" if DATABASE_URL.startswith("postgresql") else "sqlite"
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "shop_number": SHOP_NUMBER,
                "database": "disconnected",
                "database_type": db_type,
            },
        )

    return {
        "status": "ok",
        "shop_number": SHOP_NUMBER,
        "database": db_status,
        "database_type": db_type,
    }


# Mount Frontend static files
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
