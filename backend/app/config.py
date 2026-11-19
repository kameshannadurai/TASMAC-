"""
Configuration settings for TASMAC Shop No. 11066 Management System
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Shop identity constants
SHOP_NUMBER = "11066"
WELCOME_NAME = "ANNADURAI M"
SHOP_TITLE = "TASMAC SHOP NO. 11066"

# Database Configuration (Local offline SQLite file)
DATABASE_FILE = BASE_DIR / "tasmac_shop11066.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_FILE.as_posix()}")

# Security & Session
SECRET_KEY = os.getenv("SECRET_KEY", "tasmac_shop_11066_annadurai_m_offline_key_2026")
DEFAULT_PIN = "11066"
DEFAULT_USERNAME = "annadurai"
DEFAULT_FULL_NAME = "ANNADURAI M"

