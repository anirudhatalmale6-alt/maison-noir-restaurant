import { qs, qsa, prefersReducedMotion, wrapIndex, onSwipe } from './util.js';

/**
 * Hero slideshow.
 *
 * Deliberately generic: it knows about slides and an index, not about food.
 * Point it at any element with `data-slideshow` containing `[data-slide]`
 * children and it works - dishes today, cars or rooms tomorrow.
 *
 * Behaviour notes
 *  - Autoplay pauses on hover, on keyboard focus inside the hero, and when the
 *    browser tab is hidden. A timer that keeps running in a background tab
 *    burns battery and desynchronises the progress bar.
 *  - Autoplay never starts at all under prefers-reduced-motion; the arrows and
 *    pagination still work, so the content remains fully reachable.
 *  - Only one slide is in the accessibility tree at a time (aria-hidden), and
 *    the live region announces the change for screen reader users.
 */
export function initSlideshow(root = qs('[data-slideshow]')) {
  if (!root) return;

  const slides = qsa('[data-slide]', root);
  if (slides.length < 2) return;

  const dots = qsa('[data-slide-dot]', root);
  const currentLabel = qs('[data-slide-current]', root);
  const live = qs('[data-slide-live]', root);
  const delay = Number(root.dataset.interval || 6000);

  let index = slides.findIndex((slide) => slide.classList.contains('is-active'));
  if (index < 0) index = 0;
  let timer = null;
  let paused = false;

  function paint() {
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      // keep links on the off-screen slides out of the tab order
      qsa('a, button', slide).forEach((el) => {
        if (active) el.removeAttribute('tabindex');
        else el.setAttribute('tabindex', '-1');
      });
    });

    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
      // restart the progress animation by re-adding the class
      if (active) {
        dot.classList.remove('is-active');
        // reading offsetWidth forces the style recalculation that makes the
        // removal take effect before the class goes back on
        void dot.offsetWidth;
        dot.classList.add('is-active');
      }
      dot.classList.toggle('is-paused', active && paused);
    });

    if (currentLabel) currentLabel.textContent = String(index + 1).padStart(2, '0');
    if (live) live.textContent = `Slide ${index + 1} of ${slides.length}`;
  }

  function goTo(next, { restart = true } = {}) {
    index = wrapIndex(next, slides.length);
    paint();
    if (restart) schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (paused || prefersReducedMotion()) return;
    timer = setTimeout(() => goTo(index + 1), delay);
  }

  function setPaused(value) {
    paused = value;
    dots.forEach((dot) => dot.classList.toggle('is-paused', dot.classList.contains('is-active') && paused));
    if (paused) clearTimeout(timer);
    else schedule();
  }

  // Controls ---------------------------------------------------------------

  qs('[data-slide-prev]', root)?.addEventListener('click', () => goTo(index - 1));
  qs('[data-slide-next]', root)?.addEventListener('click', () => goTo(index + 1));

  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  root.addEventListener('mouseenter', () => setPaused(true));
  root.addEventListener('mouseleave', () => setPaused(false));
  root.addEventListener('focusin', () => setPaused(true));
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) setPaused(false);
  });

  document.addEventListener('visibilitychange', () => setPaused(document.hidden));

  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(index + 1);
    }
  });

  onSwipe(root, { onLeft: () => goTo(index + 1), onRight: () => goTo(index - 1) });

  // Once the first slide's image has decoded, the later ones can be fetched
  // quietly in the background so the second advance is not a blank frame.
  const preload = () => {
    slides.slice(1).forEach((slide) => {
      qsa('img[loading="lazy"]', slide).forEach((img) => img.setAttribute('loading', 'eager'));
    });
  };
  if (document.readyState === 'complete') preload();
  else window.addEventListener('load', preload, { once: true });

  root.dataset.slideshowReady = 'true';
  paint();
  schedule();
}
