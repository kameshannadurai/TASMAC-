"""
TASMAC SHOP NO. 11066 – ANNADURAI M
SQLite to Supabase PostgreSQL Migration Script
Migrates all local SQLite data to Supabase PostgreSQL or Cloud Database with duplicate prevention.
"""

import os
import sys
import sqlite3
import argparse
import json
from datetime import datetime

# Add app to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def migrate_sqlite_to_supabase(sqlite_path: str, supabase_url: str, supabase_key: str):
    import httpx

    if not os.path.exists(sqlite_path):
        print(f"❌ Error: SQLite database not found at {sqlite_path}")
        return

    print(f"📦 Connecting to local SQLite database: {sqlite_path}")
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    base_rest = supabase_url.rstrip("/") + "/rest/v1"

    with httpx.Client(timeout=30.0) as client:
        # 1. Migrate Users
        print("\n[1/4] Migrating Users...")
        cursor.execute("SELECT * FROM users")
        users = [dict(row) for row in cursor.fetchall()]
        if users:
            res = client.post(f"{base_rest}/users", headers=headers, json=users)
            print(f"  ✅ Users migrated: {len(users)} (Status: {res.status_code})")
        else:
            print("  ℹ️ No users to migrate.")

        # 2. Migrate Daily Remittances
        print("\n[2/4] Migrating Daily Remittances...")
        cursor.execute("SELECT * FROM daily_remittances")
        remittances = [dict(row) for row in cursor.fetchall()]
        if remittances:
            # Clean boolean / float formatting if needed
            res = client.post(f"{base_rest}/daily_remittances", headers=headers, json=remittances)
            print(f"  ✅ Remittances migrated: {len(remittances)} (Status: {res.status_code})")
        else:
            print("  ℹ️ No remittances found.")

        # 3. Migrate Vendor Receipts
        print("\n[3/4] Migrating Vendor Receipts...")
        cursor.execute("SELECT * FROM vendor_receipts")
        receipts = [dict(row) for row in cursor.fetchall()]
        if receipts:
            res = client.post(f"{base_rest}/vendor_receipts", headers=headers, json=receipts)
            print(f"  ✅ Vendor receipts migrated: {len(receipts)} (Status: {res.status_code})")

            # Receipt items
            cursor.execute("SELECT * FROM vendor_receipt_items")
            items = [dict(row) for row in cursor.fetchall()]
            if items:
                res_items = client.post(f"{base_rest}/vendor_receipt_items", headers=headers, json=items)
                print(f"  ✅ Receipt items migrated: {len(items)} (Status: {res_items.status_code})")
        else:
            print("  ℹ️ No vendor receipts found.")

        # 4. Migrate Audit History
        print("\n[4/4] Migrating Audit History...")
        cursor.execute("SELECT * FROM audit_history")
        audits = [dict(row) for row in cursor.fetchall()]
        if audits:
            res = client.post(f"{base_rest}/audit_history", headers=headers, json=audits)
            print(f"  ✅ Audit history records migrated: {len(audits)} (Status: {res.status_code})")
        else:
            print("  ℹ️ No audit history records found.")

    conn.close()
    print("\n🎉 Migration to Supabase completed successfully!")


def main():
    parser = argparse.ArgumentParser(description="Migrate TASMAC 11066 SQLite database to Supabase PostgreSQL.")
    parser.add_argument("--sqlite", default="tasmac_shop11066.db", help="Path to local SQLite DB file")
    parser.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL"), help="Supabase Project REST URL (e.g. https://xyz.supabase.co)")
    parser.add_argument("--supabase-key", default=os.getenv("SUPABASE_SERVICE_ROLE_KEY"), help="Supabase Service Role Key")

    args = parser.parse_args()

    if not args.supabase_url or not args.supabase_key:
        print("💡 Usage:")
        print("  python backend/scripts/migrate_to_supabase.py --supabase-url <URL> --supabase-key <SERVICE_ROLE_KEY>")
        print("Or set environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
        sys.exit(1)

    migrate_sqlite_to_supabase(args.sqlite, args.supabase_url, args.supabase_key)


if __name__ == "__main__":
    main()

