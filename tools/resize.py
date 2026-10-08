#!/usr/bin/env python3
"""Produce the responsive variants referenced by the srcset attributes.

A phone should not download a 1920px hero. Each full-bleed source gets a 760w
and a 1200w sibling in both JPEG and WebP; the browser picks one using the
`sizes` hint in the markup.

Run after adding or replacing anything in assets/img:

    python3 tools/resize.py
"""
from pathlib import Path

from PIL import Image

IMG = Path(__file__).resolve().parent.parent / "assets" / "img"

# slug -> widths to emit (the original stays as the largest step)
TARGETS = {
    "hero-1": [760, 1200],
    "hero-2": [760, 1200],
    "hero-3": [760, 1200],
    "hero-4": [760, 1200],
    "about-room": [600],
    "gallery-1": [600],
    "og-card": [],
}


def main():
    made = 0
    for slug, widths in TARGETS.items():
        source = IMG / f"{slug}.jpg"
        if not source.exists():
            print(f"  missing {source.name}")
            continue
        original = Image.open(source).convert("RGB")
        for width in widths:
            if width >= original.width:
                continue
            height = round(original.height * width / original.width)
            resized = original.resize((width, height), Image.LANCZOS)
            resized.save(IMG / f"{slug}-{width}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
            resized.save(IMG / f"{slug}-{width}.webp", "WEBP", quality=78, method=6)
            made += 2
            print(f"  {slug}-{width} {width}x{height}")
    print(f"wrote {made} files")


if __name__ == "__main__":
    main()
