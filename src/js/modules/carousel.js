import { qs, qsa, prefersReducedMotion, wrapIndex, onSwipe, debounce } from './util.js';

/**
 * Reviews carousel.
 *
 * Same contract as the slideshow but tuned for text: the viewport is given an
 * explicit height equal to the tallest quote, measured after the fonts have
 * loaded. Without that, the section grows and shrinks as it advances and the
 * whole page below it jumps - the classic testimonial-slider bug.
 */
export function initCarousel(root = qs('[data-carousel]')) {
  if (!root) return;

  const viewport = qs('[data-carousel-viewport]', root);
  const slides = qsa('[data-carousel-slide]', root);
  if (!viewport || slides.length < 2) return;

  const dots = qsa('[data-carousel-dot]', root);
  const live = qs('[data-carousel-live]', root);
  const delay = Number(root.dataset.interval || 7000);

  let index = 0;
  let timer = null;
  let paused = false;

  /** Measure every slide at its natural height, then lock the tallest in. */
  function lockHeight() {
    const previous = slides.map((slide) => slide.getAttribute('style') || '');
    viewport.style.height = 'auto';
    let tallest = 0;

    slides.forEach((slide) => {
      // The stylesheet pins inactive slides with `inset: 0`, which ties their
      // height to the viewport we are trying to measure. Release the bottom
      // edge first or every slide measures as zero.
      slide.style.cssText =
        'position:absolute;top:0;left:0;right:0;bottom:auto;height:auto;' +
        'visibility:hidden;opacity:0;transform:none;transition:none;';
      tallest = Math.max(tallest, slide.offsetHeight);
    });

    slides.forEach((slide, i) => {
      if (previous[i]) slide.setAttribute('style', previous[i]);
      else slide.removeAttribute('style');
    });
    viewport.style.height = `${Math.ceil(tallest)}px`;
  }

  function paint() {
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    if (live) live.textContent = `Review ${index + 1} of ${slides.length}`;
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
    if (paused) clearTimeout(timer);
    else schedule();
  }

  qs('[data-carousel-prev]', root)?.addEventListener('click', () => goTo(index - 1));
  qs('[data-carousel-next]', root)?.addEventListener('click', () => goTo(index + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  root.addEventListener('mouseenter', () => setPaused(true));
  root.addEventListener('mouseleave', () => setPaused(false));
  root.addEventListener('focusin', () => setPaused(true));
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) setPaused(false);
  });
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));

  onSwipe(viewport, { onLeft: () => goTo(index + 1), onRight: () => goTo(index - 1) });

  window.addEventListener('resize', debounce(lockHeight, 200));
  // Fonts change the measurement, so re-run once they are actually in use.
  if (document.fonts?.ready) document.fonts.ready.then(lockHeight);

  paint();
  lockHeight();
  schedule();
}
