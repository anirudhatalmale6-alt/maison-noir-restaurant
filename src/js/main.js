/**
 * Entry point.
 *
 * Loaded as `<script type="module" defer>`, so it never blocks the parser and
 * runs after the HTML is in place. Every module below is self-guarding: if the
 * element it looks after is not on this page, it returns immediately. That is
 * what lets one bundle serve all four pages without per-page conditionals.
 *
 * Browsers without ES module support (IE11 and friends) never download this
 * file at all, and never get the `js` class that hides reveal elements - they
 * see the full, static, readable site.
 */

import { initHeader, initToTop } from './modules/header.js';
import { initSlideshow } from './modules/slideshow.js';
import { initCarousel } from './modules/carousel.js';
import { initReveal, initSplitHeadings } from './modules/reveal.js';
import { initMenuFilter } from './modules/menu-filter.js';
import { initReservationForm } from './modules/reservation.js';
import { initParallax } from './modules/parallax.js';
import { initYear } from './modules/misc.js';

/**
 * Run each initialiser in isolation. One component throwing must never take
 * the rest of the page's interactivity down with it.
 */
function run(name, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`[${name}] failed to initialise`, error);
  }
}

function boot() {
  run('header', initHeader);
  run('toTop', initToTop);
  run('splitHeadings', initSplitHeadings);
  run('slideshow', initSlideshow);
  run('carousel', initCarousel);
  run('reveal', initReveal);
  run('menuFilter', initMenuFilter);
  run('reservation', initReservationForm);
  run('parallax', initParallax);
  run('year', initYear);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
