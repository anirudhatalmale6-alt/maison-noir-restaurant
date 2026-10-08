#!/usr/bin/env python3
"""Screenshot the built site at a few viewports for review."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4173"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots")
OUT.mkdir(parents=True, exist_ok=True)

SHOTS = [
    ("home-hero", "/index.html", 1440, 900, 0),
    ("home-specials", "/index.html", 1440, 900, 1000),
    ("home-reviews", "/index.html", 1440, 900, 2050),
    ("home-story", "/index.html", 1440, 900, 3100),
    ("home-cta", "/index.html", 1440, 900, 4300),
    ("menu", "/menu.html", 1440, 900, 700),
    ("menu-top", "/menu.html", 1440, 900, 0),
    ("about", "/about.html", 1440, 900, 800),
    ("about-gallery", "/about.html", 1440, 900, 1900),
    ("contact", "/contact.html", 1440, 900, 700),
    ("mobile-hero", "/index.html", 390, 844, 0),
    ("mobile-specials", "/index.html", 390, 844, 900),
    ("mobile-menu", "/menu.html", 390, 844, 700),
    ("tablet-home", "/index.html", 820, 1000, 900),
]


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, path, w, h, scroll in SHOTS:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.on("console", lambda m: errors.append(f"{name}: {m.type}: {m.text}")
                    if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"{name}: pageerror: {e}"))
            page.goto(BASE + path, wait_until="networkidle")
            page.wait_for_timeout(400)
            if scroll:
                page.evaluate(f"window.scrollTo(0, {scroll})")
                page.wait_for_timeout(1200)
            page.screenshot(path=str(OUT / f"{name}.png"))
            page.close()
        browser.close()

    if errors:
        print("CONSOLE ERRORS:")
        for e in errors:
            print(" ", e)
    else:
        print("no console errors")
    print(f"wrote {len(SHOTS)} screenshots to {OUT}")


if __name__ == "__main__":
    main()
