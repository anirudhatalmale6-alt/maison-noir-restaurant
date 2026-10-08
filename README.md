# Maison Noir — premium restaurant website

A four page, fully responsive restaurant site built from semantic HTML5, SCSS
and vanilla JavaScript. No framework, no jQuery, no CSS library, no runtime
dependency of any kind.

Everything a non-developer is likely to want to change — dishes, prices,
reviews, opening hours, the restaurant's name — lives in plain JSON files in
`/data`. Run one command and the HTML regenerates.

---

## Quick start

```bash
npm install        # installs Dart Sass, the only dependency
npm run build      # writes a deploy-ready /dist
npm start          # build, then serve it at http://localhost:4173
npm run dev        # rebuild automatically while you edit
```

`dist/` is the whole site. Upload its contents to any static host and you are
live. There is no server-side code to configure.

---

## What is where

```
data/            Content. Plain JSON. This is the part you edit.
  site.json        name, address, phone, hours, nav, footer
  hero.json        the homepage slideshow
  specials.json    the Chef's Special cards
  reviews.json     the customer reviews carousel
  menu.json        the full menu, by course
  about.json       the story page, gallery and team
  contact.json     reservation form options and the notes panel

src/
  pages/         one template per page, with its <title> and meta in a
                 comment at the top
  partials/      header, footer, <head>, and the blocks reused across pages
  scss/
    abstracts/   design tokens and mixins   <- rebrand starts here
    base/        reset, fonts, typography, layout
    components/  one file per component
  js/
    main.js      entry point
    modules/     slideshow, carousel, header/drawer, reveal, menu filter,
                 reservation form, parallax

assets/          fonts and images, copied into dist as-is
tools/
  build.js       the build. Templating + Sass + asset copy + sitemap
  resize.py      regenerates the responsive image variants
  test.py        35 functional checks against the built site
  contrast.py    measures real text-over-photo contrast
  genimg.py      generates the placeholder photography

dist/            generated. Never edit by hand, it is wiped on every build.
```

---

## Changing the content

### A dish, a price, a review

Open the matching file in `/data`, edit, run `npm run build`. For example, to
change what is in the Chef's Special section, edit `data/specials.json`:

```json
{
  "name": "Scallop, cauliflower, caviar",
  "course": "First course",
  "note": "Hand-dived scallop, browned butter cauliflower, oscietra",
  "price": "24",
  "image": "special-1",
  "alt": "Roasted scallops with cauliflower puree and caviar on a slate plate",
  "badge": "New this week"
}
```

Add a fourth object to the `items` array and a fourth card appears. Remove one
and it goes. Nothing in the HTML or the CSS needs touching.

`image` is a filename stem in `assets/img`, without the extension. Drop
`special-4.jpg` in there, reference `"image": "special-4"`, and the build wires
up both the JPEG and the WebP.

> Always fill in `alt`. It is what a screen reader announces and what Google
> reads. One honest sentence describing the photograph.

### The restaurant's name

`data/site.json`, the `brand` block. It propagates to the logo, the page
titles, the footer, the structured data and the consent line on the booking
form.

---

## Reusing this for something other than a restaurant

This was asked for up front, so the three "content" components were built
without any knowledge of food in them. The slideshow knows about slides. The
card knows about an image, a kicker, a title, a note and a price. The carousel
knows about a quote and an attribution.

To sell cars instead of dinners:

1. Replace the images in `assets/img`.
2. Rewrite `data/hero.json` and `data/specials.json` with the new copy —
   `"course": "First course"` becomes `"course": "2.0 TDI"`, `"price": "24"`
   becomes `"price": "48,500"`, and so on.
3. Change the currency symbol in `src/scss/components/_menu.scss`
   (`.dish__price::before`) and in `src/pages/index.html` (`card__currency`).
4. Repaint from `src/scss/abstracts/_tokens.scss` (below).
5. `npm run build`.

No component file changes. That was the design goal.

### Repainting

`src/scss/abstracts/_tokens.scss` holds every colour, type size, spacing step
and animation timing used anywhere in the build. Change `$brass` and the
buttons, rules, underlines, badges, prices and focus rings all follow. Change
the two `$font-*` variables and the whole typographic system moves with them.

The palette is deliberately short: three neutrals and one accent. A fifth
colour is almost always what makes a premium layout start to look ordinary.

---

## Wiring up the reservation form

The form validates in the browser and then shows a confirmation panel. It does
not send anything anywhere yet, because that needs a destination.

Open `src/js/modules/reservation.js` and set:

```js
const ENDPOINT = 'https://formspree.io/f/xxxxxxx';   // or your own handler
```

Any endpoint that accepts a `POST` of `FormData` will work — Formspree,
Basin, Netlify Forms, a Google Apps Script, or your own PHP or Node handler.
With `ENDPOINT` empty the form stays in demo mode and logs the payload to the
console.

Two things to keep in mind:

- **Validate again on the server.** Browser validation is for the visitor's
  benefit, not for security. Anyone can post straight to your endpoint.
- The form carries a honeypot field named `company`. It is invisible to people
  and off the tab order, so anything that arrives with it filled in is a bot.
  The client-side code already drops those silently; have your handler do the
  same.

---

## Performance and accessibility

Measured with Lighthouse against the built `dist/`, all four pages:

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Desktop | 100 | 100 | 100 | 100 |
| Mobile  | 97–99 | 100 | 100 | 100 |

Largest Contentful Paint 0.5–0.6s desktop, 2.1–2.5s mobile under Lighthouse's
simulated slow 4G. Cumulative Layout Shift 0. Total Blocking Time 0ms.

How that is held:

- **Fonts are self-hosted**, two variable files covering every weight, subset
  to latin and latin-ext. No Google Fonts request, so no third-party DNS
  lookup, no extra TLS handshake, and nothing to declare under GDPR.
- **Images ship as WebP with a JPEG fallback**, at three widths with a `sizes`
  hint, so a phone never downloads a 1920px hero. Every `<img>` carries
  explicit `width` and `height`, which is why CLS is zero.
- **The hero image is preloaded** at the same widths the markup offers, since
  it is the LCP element on every page.
- **Nothing is fetched at runtime.** The JSON is baked into the HTML at build
  time, so the content is in the first response — good for speed, and the
  reason the SEO score is what it is.
- **No layout work in scroll handlers.** The header and the back-to-top button
  are throttled with `requestAnimationFrame`; reveals and parallax run off an
  `IntersectionObserver`.

On the accessibility side: one visible focus style everywhere, a skip link,
real landmarks, `aria-live` announcements on both carousels, off-screen slides
removed from the tab order and the accessibility tree, 28px touch targets on
controls whose visible mark is smaller, and every text-over-photograph
combination measured rather than eyeballed (`python3 tools/contrast.py` — the
worst case on the site is 7.5:1 against a 4.5:1 requirement).

---

## Graceful degradation

- **No JavaScript**: the first hero slide stays on screen, every review renders
  as a readable stacked list, the whole menu is visible, and the controls that
  would do nothing are hidden rather than left dead. The `js` class that arms
  the reveal animations is only added by browsers that support ES modules, so
  an old browser can never end up with permanently invisible text.
- **`prefers-reduced-motion`**: no autoplay, no Ken Burns, no reveal
  transitions, no marquee, no parallax, no smooth scrolling. Everything stays
  operable by arrow, dot and keyboard.
- **No WebP support**: the `<picture>` element falls through to JPEG.
- **No `backdrop-filter`**: the affected surfaces already carry a solid
  background colour underneath, so they stay legible.

---

## Testing

```bash
npm start                 # in one terminal
python3 tools/test.py     # in another
```

35 checks covering the slideshow (advance, wrap, pagination, pause on hover,
resume, aria state, tab order), the reviews carousel (including the height
lock that stops the page jumping), the mobile drawer (open, escape, scroll
lock, focus), the menu filter (including deep links), the reservation form
(validation, success, honeypot) and the no-JavaScript fallback.

`python3 tools/contrast.py` re-measures every text-over-photo region. Run it
after swapping in real photography — a brighter image can quietly push the
headline under the threshold.

---

## Browser support

Current Chrome, Edge, Firefox and Safari, plus iOS and Android. The layout uses
CSS Grid, custom properties, `clamp()` and `aspect-ratio`; the scripts use ES
modules and `IntersectionObserver`. Older browsers that lack ES modules get the
full static site without the animations, which is the intended floor rather
than an accident.

---

## Deploying

Upload the contents of `dist/` to any static host — Netlify, Vercel, Cloudflare
Pages, GitHub Pages, S3, or ordinary shared hosting over FTP.

Before going live, in `data/site.json` set `brand.url` to the real domain. It
feeds the canonical tags, the Open Graph URLs, `sitemap.xml` and `robots.txt`.

Recommended cache headers: one year immutable on `/img`, `/fonts` and
`/css`; no cache on the HTML.

---

## Placeholder photography

The images in `assets/img` are AI-generated placeholders, there so the demo
reads as a finished site rather than a wireframe. Replace them with the
restaurant's own photography before launch. Keep the same filenames and nothing
else needs to change; then run `python3 tools/resize.py` to regenerate the
responsive variants.
