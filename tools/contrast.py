#!/usr/bin/env python3
"""Measure the real contrast of text that sits over photography.

The copy is hidden before the screenshot is taken - sampling with the text
still on screen measures the glyphs, not the background they have to beat.
Reports the WCAG ratio for the darkest-needed case: the brightest pixel found
anywhere inside each text block's box.
"""
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4173"
TMP = Path("/tmp/claude-1007/-home-freelancer/b49a8596-a4e5-4c11-8e01-184455a1d5b5/scratchpad")

# page path, viewport, selectors whose boxes we test, text colour
CHECKS = [
    # every hero slide, not just the first: slide 2 is a bright room and would
    # pass or fail on its own merits
    ("/index.html#slide1", 1440, 900, [".hero__slide.is-active .hero__copy"], "#f2ede4"),
    ("/index.html#slide2", 1440, 900, [".hero__slide.is-active .hero__copy"], "#f2ede4"),
    ("/index.html#slide3", 1440, 900, [".hero__slide.is-active .hero__copy"], "#f2ede4"),
    ("/index.html#slide4", 1440, 900, [".hero__slide.is-active .hero__copy"], "#f2ede4"),
    ("/index.html#slide1", 390, 844, [".hero__slide.is-active .hero__copy"], "#f2ede4"),
    ("/menu.html", 1440, 900, [".page-head__inner"], "#f2ede4"),
    ("/about.html", 1440, 900, [".page-head__inner"], "#f2ede4"),
    ("/contact.html", 1440, 900, [".page-head__inner"], "#f2ede4"),
]


def luminance(rgb):
    def channel(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(v) for v in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i: i + 2], 16) for i in (0, 2, 4))


def main():
    failures = 0
    checked = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for path, w, h, selectors, fg in CHECKS:
            page = browser.new_page(viewport={"width": w, "height": h})
            slide = 0
            if "#slide" in path:
                path, _, suffix = path.partition("#slide")
                slide = int(suffix) - 1
            page.goto(BASE + path, wait_until="networkidle")
            page.wait_for_timeout(500)
            if slide:
                # advance to the slide under test and let the crossfade finish
                for _ in range(slide):
                    page.click("[data-slide-next]")
                    page.wait_for_timeout(1100)

            boxes = []
            for selector in selectors:
                el = page.query_selector(selector)
                if not el:
                    print(f"  MISSING {selector} on {path} @{w}")
                    continue
                boxes.append((selector, el.bounding_box()))

            # hide the copy, keep the photograph and the scrim
            page.add_style_tag(
                content=".hero__copy, .page-head__inner { visibility: hidden !important; }"
            )
            page.wait_for_timeout(200)
            shot = TMP / f"contrast-{path.strip('/').replace('.html','')}-{w}.png"
            page.screenshot(path=str(shot))
            page.close()

            image = Image.open(shot).convert("RGB")
            for selector, box in boxes:
                if not box:
                    continue
                left = max(0, int(box["x"]))
                top = max(0, int(box["y"]))
                right = min(image.width, int(box["x"] + box["width"]))
                bottom = min(image.height, int(box["y"] + box["height"]))
                if right <= left or bottom <= top:
                    continue
                region = image.crop((left, top, right, bottom))
                # the worst case is the brightest background pixel under the text
                brightest = max(region.getdata(), key=luminance)
                value = ratio(brightest, hex_rgb(fg))
                checked += 1
                ok = value >= 4.5
                if not ok:
                    failures += 1
                print(
                    f"  {'PASS' if ok else 'FAIL'} {path} @{w}px {selector} "
                    f"worst pixel rgb{brightest} ratio {value:.2f}:1"
                )
        browser.close()

    print(f"\n{checked} regions checked, {failures} below 4.5:1")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
