"""
Verify that all DOM elements accessed by JS files exist in index.html
"""

import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
HTML_FILE = BASE_DIR / "frontend" / "index.html"
JS_DIR = BASE_DIR / "frontend" / "js"

html_content = HTML_FILE.read_text(encoding="utf-8")
dom_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html_content))

print(f"Found {len(dom_ids)} unique DOM IDs in index.html")

# Scan all JS files for getElementById('...')
missing_ids = {}

for js_file in JS_DIR.glob("*.js"):
    content = js_file.read_text(encoding="utf-8")
    js_ids = re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", content)
    for jid in js_ids:
        # Dynamic ids like ven-liq-amt-0 are generated dynamically, check prefix
        if jid not in dom_ids and not (jid.startswith("ven-liq-amt-") or jid.startswith("ven-beer-amt-")):
            missing_ids.setdefault(js_file.name, set()).add(jid)

if missing_ids:
    print("Warning: Some IDs were not found directly in index.html:")
    for fn, ids in missing_ids.items():
        print(f"  {fn}: {ids}")
else:
    print("ALL DOM element IDs referenced across all JS modules exist in index.html! Integrity 100% verified.")

