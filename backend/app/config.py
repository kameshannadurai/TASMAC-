"""
Configuration settings for TASMAC Shop No. 11066 Management System
Supports SQLite (Local Offline) and Supabase PostgreSQL (Cloud)
"""

import os
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Shop identity constants
SHOP_NUMBER = "11066"
WELCOME_NAME = "ANNADURAI M"
SHOP_TITLE = "TASMAC SHOP NO. 11066"

# Default Primary Admin Credentials
DEFAULT_USERNAME = "annadurai"
DEFAULT_FULL_NAME = "ANNADURAI M"
DEFAULT_MOBILE = "9842111066"
DEFAULT_PIN = "11066"

# Pre-Authorized View-Only Staff Members
VIEW_ONLY_STAFF = [
    {"username": "prem", "full_name": "PREM", "mobile_number": "9842111001"},
    {"username": "selvakumar", "full_name": "SELVAKUMAR", "mobile_number": "9842111002"},
]

# Environment Mode: 'development' or 'production'
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower().strip()

# Database Configuration (Local offline SQLite file fallback)
DATABASE_FILE = BASE_DIR / "tasmac_shop11066.db"
_raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_FILE.as_posix()}").strip()

# Supabase / Render connection string normalization (postgres:// -> postgresql://)
if _raw_db_url.startswith("postgres://"):
    DATABASE_URL = _raw_db_url.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = _raw_db_url

# Security & Session Management
_env_secret = os.getenv("SECRET_KEY") or os.getenv("TASMAC_SECRET_KEY")
INSECURE_SECRETS = {
    "tasmac_shop_11066_annadurai_m_offline_key_2026",
    "tasmac_shop11066_annadurai_secret_key_2026_secured",
    "changeme",
    "secret",
    "123456",
}

if ENVIRONMENT == "production":
    if not _env_secret or _env_secret in INSECURE_SECRETS:
        raise RuntimeError(
            "CRITICAL SECURITY CONFIGURATION ERROR: In production mode, a strong, random "
            "SECRET_KEY environment variable is strictly required. Please set SECRET_KEY in your hosting environment."
        )
    SECRET_KEY = _env_secret
else:
    SECRET_KEY = _env_secret or "tasmac_shop_11066_annadurai_m_offline_key_2026"

TOKEN_EXPIRY_SECONDS = int(os.getenv("TOKEN_EXPIRY_SECONDS", str(30 * 24 * 3600)))  # 30 days default session

# Production CORS Configuration
_raw_cors = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS = [o.strip() for o in _raw_cors.split(",") if o.strip()]
