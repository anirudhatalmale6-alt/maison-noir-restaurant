import { qs, qsa, createFocusTrap } from './util.js';

/**
 * Sticky header behaviour and the mobile drawer.
 *
 * The scroll handler is throttled with requestAnimationFrame rather than
 * running on every scroll event - scroll fires far faster than the screen
 * refreshes, and doing layout work in it is the usual cause of a janky header.
 */
export function initHeader() {
  const header = qs('[data-header]');
  if (!header) return;

  const STUCK_AFTER = 40; // px
  const HIDE_AFTER = 320; // only start auto-hiding well below the fold
  let lastY = window.scrollY;
  let ticking = false;

  function update() {
    const y = window.scrollY;
    header.classList.toggle('is-stuck', y > STUCK_AFTER);

    // hide on the way down, reveal on the way up
    const goingDown = y > lastY;
    if (y > HIDE_AFTER && goingDown && !header.dataset.locked) header.classList.add('is-hidden');
    else header.classList.remove('is-hidden');

    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
  update();

  // Drawer -----------------------------------------------------------------

  const drawer = qs('[data-drawer]');
  const burger = qs('[data-burger]');
  if (!drawer || !burger) return;

  const trap = createFocusTrap(drawer);

  function open() {
    drawer.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-locked');
    header.dataset.locked = 'true';
    header.classList.remove('is-hidden');
    trap.activate();
  }

  function close() {
    drawer.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
    delete header.dataset.locked;
    trap.release();
  }

  burger.addEventListener('click', () => {
    if (drawer.classList.contains('is-open')) close();
    else open();
  });

  qs('[data-drawer-close]', drawer)?.addEventListener('click', close);
  qsa('a', drawer).forEach((link) => link.addEventListener('click', close));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) close();
  });

  // If the viewport grows past the breakpoint while the drawer is open, the
  // drawer is display:none but the body would stay locked.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
    if (event.matches && drawer.classList.contains('is-open')) close();
  });
}

/** The floating back-to-top button. */
export function initToTop() {
  const button = qs('[data-to-top]');
  if (!button) return;

  let ticking = false;
  const update = () => {
    button.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.9);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );

  button.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  update();
}
