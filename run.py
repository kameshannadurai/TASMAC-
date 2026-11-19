"""
TASMAC Shop No. 11066 - Annadurai M
Universal Application Launcher
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from desktop.start_desktop import main

if __name__ == "__main__":
    main()

