#!/usr/bin/env python3
"""Functional checks against the built site.

Covers the behaviour that is easy to break and hard to notice: the slideshow
advancing and pausing, the reviews carousel, the mobile drawer, the menu
filter, form validation, and the no-JavaScript fallback.

    python3 tools/test.py          (needs the dev server on :4173)
"""
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4173"
results = []


def check(name, condition, detail=""):
    results.append((bool(condition), name, detail))
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' - ' + detail) if detail else ''}")


def run(browser):
    # --- hero slideshow ---------------------------------------------------
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(f"{BASE}/index.html", wait_until="networkidle")
    page.wait_for_timeout(400)

    first = page.get_attribute(".hero__slide:nth-child(1)", "class")
    check("slideshow starts on slide 1", "is-active" in first)

    page.click("[data-slide-next]")
    page.wait_for_timeout(1000)
    check(
        "next arrow advances to slide 2",
        "is-active" in page.get_attribute(".hero__slide:nth-child(2)", "class"),
    )
    check("counter follows the slide", page.inner_text("[data-slide-current]") == "02")

    page.click("[data-slide-prev]")
    page.wait_for_timeout(1000)
    check(
        "prev arrow wraps back to slide 1",
        "is-active" in page.get_attribute(".hero__slide:nth-child(1)", "class"),
    )

    page.click(".hero__dot:nth-child(4)")
    page.wait_for_timeout(1000)
    check("pagination jumps to slide 4", page.inner_text("[data-slide-current]") == "04")

    check(
        "off-screen slides are hidden from assistive tech",
        page.get_attribute(".hero__slide:nth-child(1)", "aria-hidden") == "true",
    )
    check(
        "links on off-screen slides leave the tab order",
        page.get_attribute(".hero__slide:nth-child(1) .hero__actions a", "tabindex") == "-1",
    )

    # autoplay should not advance while the pointer is over the hero
    page.hover(".hero")
    current = page.inner_text("[data-slide-current]")
    page.wait_for_timeout(8000)
    check("autoplay pauses on hover", page.inner_text("[data-slide-current]") == current)

    # and should advance again once the pointer leaves
    page.mouse.move(10, 10)
    page.hover(".footer")
    page.wait_for_timeout(8200)
    check("autoplay resumes after hover", page.inner_text("[data-slide-current]") != current)

    # --- reviews carousel -------------------------------------------------
    page.goto(f"{BASE}/index.html", wait_until="networkidle")
    page.wait_for_timeout(400)
    viewport_h = page.eval_on_selector("[data-carousel-viewport]", "el => el.getBoundingClientRect().height")
    tallest = page.eval_on_selector_all(
        "[data-carousel-slide]",
        "els => Math.max(...els.map(e => e.scrollHeight))",
    )
    check(
        "carousel viewport is as tall as the longest quote",
        viewport_h >= tallest - 2,
        f"viewport {viewport_h:.0f}px vs tallest slide {tallest:.0f}px",
    )

    page.click("[data-carousel-next]")
    page.wait_for_timeout(700)
    check(
        "review carousel advances",
        "is-active" in page.get_attribute("[data-carousel-slide]:nth-of-type(2)", "class"),
    )

    # --- mobile drawer ----------------------------------------------------
    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(f"{BASE}/index.html", wait_until="networkidle")
    mobile.wait_for_timeout(300)
    check("drawer starts closed", "is-open" not in (mobile.get_attribute("[data-drawer]", "class") or ""))
    mobile.click("[data-burger]")
    mobile.wait_for_timeout(500)
    check("burger opens the drawer", "is-open" in mobile.get_attribute("[data-drawer]", "class"))
    check("burger reports its state", mobile.get_attribute("[data-burger]", "aria-expanded") == "true")
    check("body scroll is locked while open", "is-locked" in mobile.get_attribute("body", "class"))
    mobile.keyboard.press("Escape")
    mobile.wait_for_timeout(500)
    check("escape closes the drawer", "is-open" not in (mobile.get_attribute("[data-drawer]", "class") or ""))
    check("body scroll is released", "is-locked" not in (mobile.get_attribute("body", "class") or ""))

    # --- menu filter ------------------------------------------------------
    page.goto(f"{BASE}/menu.html", wait_until="networkidle")
    page.wait_for_timeout(300)
    total = len(page.query_selector_all("[data-course]"))
    check("every course renders", total == 5, f"{total} courses")
    page.click('[data-filter="desserts"]')
    page.wait_for_timeout(300)
    visible = page.eval_on_selector_all("[data-course]", "els => els.filter(e => !e.hidden).length")
    check("filter narrows to one course", visible == 1, f"{visible} visible")
    check("filter writes a linkable hash", page.evaluate("location.hash") == "#desserts")
    page.click('[data-filter="all"]')
    page.wait_for_timeout(300)
    visible = page.eval_on_selector_all("[data-course]", "els => els.filter(e => !e.hidden).length")
    check("'All' restores every course", visible == total)

    # A direct link to a filtered view is honoured on load. This needs a fresh
    # page: navigating from menu.html to menu.html#mains in the same tab is a
    # same-document hash change, so the script would never re-run.
    hashed = browser.new_page(viewport={"width": 1440, "height": 900})
    hashed.goto(f"{BASE}/menu.html#mains", wait_until="networkidle")
    hashed.wait_for_timeout(400)
    visible = hashed.eval_on_selector_all("[data-course]", "els => els.filter(e => !e.hidden).length")
    check("a #hash link opens pre-filtered", visible == 1, f"{visible} visible")
    hashed.close()

    # --- reservation form -------------------------------------------------
    page.goto(f"{BASE}/contact.html", wait_until="networkidle")
    page.wait_for_timeout(300)
    page.click('[data-reservation] [type="submit"]')
    page.wait_for_timeout(300)
    invalid = len(page.query_selector_all(".field.is-invalid"))
    check("empty submit is blocked and flagged", invalid >= 4, f"{invalid} fields flagged")
    check("the form is still on screen", page.is_visible("[data-reservation]"))

    page.fill("#name", "Ana Pereira")
    page.fill("#email", "ana@example.com")
    page.fill("#phone", "+351 912 345 678")
    page.fill("#date", "2027-03-14")
    page.fill("#guests", "2")
    page.check('input[name="consent"]')
    page.click('[data-reservation] [type="submit"]')
    page.wait_for_timeout(1200)
    check("a valid submit shows the confirmation", page.is_visible("[data-reservation-success]"))

    # Honeypot, on its own page so the previous submission cannot colour it.
    bot = browser.new_page(viewport={"width": 1440, "height": 900})
    bot.goto(f"{BASE}/contact.html", wait_until="networkidle")
    bot.wait_for_timeout(300)
    bot.eval_on_selector('input[name="company"]', "el => el.value = 'spam-bot'")
    bot.click('[data-reservation] [type="submit"]')
    bot.wait_for_timeout(600)
    check("honeypot swallows a bot submission", bot.eval_on_selector("[data-reservation]", "el => el.hidden"))
    check(
        "honeypot gives the bot no clue it was caught",
        len(bot.query_selector_all(".field.is-invalid")) == 0,
    )
    bot.close()

    # --- no JavaScript ----------------------------------------------------
    nojs_ctx = browser.new_context(java_script_enabled=False, viewport={"width": 1440, "height": 900})
    nojs = nojs_ctx.new_page()
    nojs.goto(f"{BASE}/index.html", wait_until="load")
    check("headline is readable without JS", nojs.is_visible(".hero__title"))
    check("hero buttons are reachable without JS", nojs.is_visible(".hero__actions .btn"))
    check("specials still render without JS", len(nojs.query_selector_all(".card")) == 3)
    check("every review is readable without JS", len(nojs.query_selector_all(".review")) == 5)
    check("dead slideshow controls stay hidden", nojs.is_hidden(".hero__controls"))
    nojs.goto(f"{BASE}/menu.html", wait_until="load")
    shown = nojs.eval_on_selector_all("[data-course]", "els => els.filter(e => !e.hidden).length")
    check("whole menu is visible without JS", shown == 5, f"{shown} courses")
    check("dead filter bar stays hidden", nojs.is_hidden("[data-menu-filters]"))
    nojs_ctx.close()

    check("no console or page errors", not errors, "; ".join(errors[:3]))


with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        run(browser)
    finally:
        browser.close()

failed = [r for r in results if not r[0]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
if failed:
    print("failing:")
    for _, name, detail in failed:
        print(f"  - {name} {detail}")
sys.exit(1 if failed else 0)
