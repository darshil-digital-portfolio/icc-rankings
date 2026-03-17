#!/usr/bin/env python3
"""
One-time script to download cricket team flags into apps/web/public/flags/.

Sources:
  - flagcdn.com  : national teams (ISO 2-letter codes, w160 = 160px wide PNG)
  - Wikimedia Commons : West Indies cricket flag, England (St George's Cross), Scotland (Saltire)

Run from the project root:
    python3 scripts/download-flags.py
"""

import os
import sys
import time
import urllib.request
import urllib.error

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "flags")

# (slug, url)
TEAMS = [
    # ── National teams via flagcdn.com ──────────────────────────────────────
    ("india",            "https://flagcdn.com/w160/in.png"),
    ("australia",        "https://flagcdn.com/w160/au.png"),
    ("pakistan",         "https://flagcdn.com/w160/pk.png"),
    ("south-africa",     "https://flagcdn.com/w160/za.png"),
    ("new-zealand",      "https://flagcdn.com/w160/nz.png"),
    ("sri-lanka",        "https://flagcdn.com/w160/lk.png"),
    ("bangladesh",       "https://flagcdn.com/w160/bd.png"),
    ("zimbabwe",         "https://flagcdn.com/w160/zw.png"),
    ("afghanistan",      "https://flagcdn.com/w160/af.png"),
    ("ireland",          "https://flagcdn.com/w160/ie.png"),
    ("netherlands",      "https://flagcdn.com/w160/nl.png"),
    ("kenya",            "https://flagcdn.com/w160/ke.png"),
    ("namibia",          "https://flagcdn.com/w160/na.png"),
    ("nepal",            "https://flagcdn.com/w160/np.png"),
    ("oman",             "https://flagcdn.com/w160/om.png"),
    ("uae",              "https://flagcdn.com/w160/ae.png"),
    ("usa",              "https://flagcdn.com/w160/us.png"),
    ("canada",           "https://flagcdn.com/w160/ca.png"),
    ("papua-new-guinea", "https://flagcdn.com/w160/pg.png"),
    ("bermuda",          "https://flagcdn.com/w160/bm.png"),
    ("uganda",           "https://flagcdn.com/w160/ug.png"),
    ("trinidad-tobago",  "https://flagcdn.com/w160/tt.png"),
    ("hong-kong",        "https://flagcdn.com/w160/hk.png"),
    ("denmark",          "https://flagcdn.com/w160/dk.png"),
    ("thailand",         "https://flagcdn.com/w160/th.png"),
    ("nigeria",          "https://flagcdn.com/w160/ng.png"),
    ("indonesia",        "https://flagcdn.com/w160/id.png"),
    ("rwanda",           "https://flagcdn.com/w160/rw.png"),
    # East Africa: historical combined team, no official flag — using Kenya as proxy
    ("east-africa",      "https://flagcdn.com/w160/ke.png"),

    # ── Regional / subdivision flags ─────────────────────────────────────────
    # England: St George's Cross via flagcdn.com subdivision code
    ("england",          "https://flagcdn.com/w160/gb-eng.png"),
    # Scotland: Saltire via flagcdn.com subdivision code
    ("scotland",         "https://flagcdn.com/w160/gb-sct.png"),
    # West Indies cricket flag (maroon with traditional crest) via Wikimedia thumb API
    ("west-indies",      "https://commons.wikimedia.org/w/thumb.php?f=WestIndiesCricketFlagPre1999.svg&w=320"),
]


def download(slug: str, url: str) -> bool:
    dest = os.path.join(OUTPUT_DIR, f"{slug}.png")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as response:
            data = response.read()
        with open(dest, "wb") as f:
            f.write(data)
        size_kb = len(data) / 1024
        print(f"  OK  {slug:25s}  {size_kb:6.1f} KB")
        return True
    except urllib.error.HTTPError as e:
        print(f"  ERR {slug:25s}  HTTP {e.code} — {url}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  ERR {slug:25s}  {e} — {url}", file=sys.stderr)
        return False


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Downloading {len(TEAMS)} flags into {OUTPUT_DIR}/\n")

    ok, fail = 0, []
    for slug, url in TEAMS:
        if download(slug, url):
            ok += 1
        else:
            fail.append(slug)
        time.sleep(0.1)   # be polite to CDNs

    print(f"\n{ok}/{len(TEAMS)} downloaded successfully.")
    if fail:
        print(f"\nFailed ({len(fail)}): {', '.join(fail)}")
        print("Update the URLs for failed teams in this script and re-run.")
        sys.exit(1)


if __name__ == "__main__":
    main()
