"""
TASMAC Shop No. 11066 - Annadurai M
Desktop Application Launcher (Offline Local Server + Browser)
"""

import sys
import os
import webbrowser
import threading
import time
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import uvicorn
from backend.app.main import app

PORT = 8000
HOST = "127.0.0.1"
URL = f"http://{HOST}:{PORT}"


def open_browser():
    time.sleep(1.2)
    print(f"\nOpening TASMAC Shop No. 11066 in your browser: {URL}")
    webbrowser.open(URL)


def main():
    print("=" * 65)
    print("  TASMAC SHOP MANAGEMENT SYSTEM - SHOP NO. 11066")
    print("  IN-CHARGE / WELCOME: ANNADURAI M")
    print("  100% OFFLINE LOCAL MODE - ZERO INTERNET REQUIRED")
    print("=" * 65)
    print(f"Server starting on {URL} ...")
    print("Press Ctrl+C to close the application.\n")

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()

