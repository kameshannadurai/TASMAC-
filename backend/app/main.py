"""
FastAPI Application Entry Point for TASMAC Shop No. 11066
"""

from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine, SessionLocal, migrate_db_columns
from .config import SHOP_NUMBER, WELCOME_NAME, SHOP_TITLE, DEFAULT_PIN
from .models import User
from .security import hash_password
from .routers import remittance, inventory, vendor, reports, backup, auth, sync

# Ensure DB tables and upgraded columns exist
Base.metadata.create_all(bind=engine)
migrate_db_columns()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure primary Admin user exists with ADMIN role
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "annadurai").first()
        if not user:
            user = User(
                username="annadurai",
                full_name=WELCOME_NAME,
                mobile_number="9842111066",
                shop_number=SHOP_NUMBER,
                role="ADMIN",  # Primary Administrator
                password_hash=hash_password(DEFAULT_PIN),
                pin=DEFAULT_PIN,
                is_active=1,
            )
            db.add(user)
            db.commit()
        else:
            # Guarantee Admin role and password_hash
            user.role = "ADMIN"
            user.full_name = WELCOME_NAME
            if not user.password_hash:
                user.password_hash = hash_password(user.pin or DEFAULT_PIN)
            db.commit()
    finally:
        db.close()
    yield


app = FastAPI(
    title=SHOP_TITLE,
    description="TASMAC Shop Management System - Shop No. 11066 (Annadurai M)",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local devices & testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    return {
        "shop_number": SHOP_NUMBER,
        "welcome_name": WELCOME_NAME,
        "shop_title": SHOP_TITLE,
        "status": "online",
        "default_pin": DEFAULT_PIN,
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "shop_number": SHOP_NUMBER}


# Mount Frontend static files
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

