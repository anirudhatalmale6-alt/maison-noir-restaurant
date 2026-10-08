#!/usr/bin/env python3
"""Generate placeholder food/interior photography for the demo build.

Images come back with a watermark baked into the bottom edge, so every image is
requested ~13% taller than needed and the bottom strip is cropped away.
Each image is written as a progressive JPEG plus a WebP sibling.
"""
import subprocess
import time
import sys
import urllib.parse
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "assets" / "img"
TMP = Path("/tmp/claude-1007/-home-freelancer/b49a8596-a4e5-4c11-8e01-184455a1d5b5/scratchpad/raw")
OVERSCAN = 1.14  # extra height requested, cropped off to remove the watermark

LOOK = (
    "professional food photography, fine dining, dark moody chiaroscuro lighting, "
    "deep charcoal background, warm candlelight, shallow depth of field, "
    "editorial magazine quality, no text, no words, no logo"
)


def generate(slug: str, prompt: str, w: int, h: int, seed: int) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    raw = TMP / f"{slug}.jpg"
    req_h = int(h * OVERSCAN)
    url = (
        "https://image.pollinations.ai/prompt/"
        + urllib.parse.quote(f"{prompt}, {LOOK}")
        + f"?width={w}&height={req_h}&nologo=true&seed={seed}"
    )
    for attempt in range(12):
        res = subprocess.run(
            ["curl", "-s", "--max-time", "180", "-o", str(raw), "-w", "%{http_code}", url],
            capture_output=True,
            text=True,
        )
        if res.stdout.strip() == "200" and raw.stat().st_size > 20000:
            break
        print(f"  retry {slug} ({res.stdout.strip()})", flush=True)
        time.sleep(25)
    else:
        print(f"  FAILED {slug}", flush=True)
        return

    im = Image.open(raw).convert("RGB")
    # crop the watermarked bottom strip, then fit exactly to the target box
    im = im.crop((0, 0, im.width, int(im.height / OVERSCAN)))
    im = im.resize((w, h), Image.LANCZOS)
    im.save(OUT / f"{slug}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
    im.save(OUT / f"{slug}.webp", "WEBP", quality=80, method=6)
    print(f"  ok {slug} {w}x{h}", flush=True)


if __name__ == "__main__":
    slug, prompt, w, h, seed = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
    generate(slug, prompt, w, h, seed)
