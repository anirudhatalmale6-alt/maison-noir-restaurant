import { qsa, prefersReducedMotion } from './util.js';

/**
 * A restrained parallax on full-bleed background images.
 *
 * Writes a single CSS custom property that the stylesheet turns into a
 * translate3d, and only while the element is actually on screen - an
 * IntersectionObserver gates the rAF loop so nothing is computed for sections
 * the visitor has already scrolled past.
 *
 * Skipped entirely on touch, on narrow screens, and under reduced motion.
 */
export function initParallax() {
  const targets = qsa('[data-parallax]');
  if (!targets.length) return;
  if (prefersReducedMotion()) return;
  if (!window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) return;

  const visible = new Set();
  let ticking = false;

  const update = () => {
    const viewportHeight = window.innerHeight;
    visible.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // -1 when the element is just below the fold, +1 when just above it
      const progress = (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;
      const strength = Number(el.dataset.parallax) || 40;
      el.style.setProperty('--parallax', `${(progress * strength).toFixed(1)}px`);
    });
    ticking = false;
  };

  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      if (visible.size) request();
    },
    { rootMargin: '10% 0px' }
  );

  targets.forEach((el) => observer.observe(el));
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  request();
}
