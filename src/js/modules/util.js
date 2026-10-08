/**
 * Small shared helpers. Kept dependency-free on purpose - the whole script
 * layer of this site is a few kilobytes of plain ES modules.
 */

/** querySelector, scoped. */
export const qs = (selector, scope = document) => scope.querySelector(selector);

/** querySelectorAll as a real array, so map/filter/forEach all work. */
export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/** True when the visitor has asked the OS to reduce motion. */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Trailing-edge debounce. Used for resize handlers, where running the work on
 * every one of the ~60 events a drag emits is pure waste.
 */
export function debounce(fn, wait = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Wrap an index so it always lands inside [0, length).
 * (-1 % 5 is -1 in JavaScript, which is not what a carousel wants.)
 */
export const wrapIndex = (index, length) => ((index % length) + length) % length;

/**
 * Minimal horizontal swipe detection for touch devices.
 * Ignores gestures that are mostly vertical so it never fights page scroll.
 */
export function onSwipe(element, { onLeft, onRight, threshold = 45 } = {}) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  element.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    },
    { passive: true }
  );

  element.addEventListener(
    'touchend',
    (event) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) onLeft?.();
      else onRight?.();
    },
    { passive: true }
  );
}

/**
 * Keeps keyboard focus inside an open dialog or drawer, and restores it to
 * whatever was focused before it opened.
 */
export function createFocusTrap(container) {
  const SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  let previouslyFocused = null;

  function onKeydown(event) {
    if (event.key !== 'Tab') return;
    const focusable = qsa(SELECTOR, container).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return {
    activate() {
      previouslyFocused = document.activeElement;
      document.addEventListener('keydown', onKeydown);
      const focusable = qsa(SELECTOR, container);
      focusable[0]?.focus();
    },
    release() {
      document.removeEventListener('keydown', onKeydown);
      previouslyFocused?.focus?.();
    },
  };
}
