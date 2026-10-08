import { qsa, prefersReducedMotion, debounce } from './util.js';

/**
 * Scroll reveal.
 *
 * One IntersectionObserver for the whole page rather than a scroll listener
 * doing getBoundingClientRect on every element - the observer runs off the
 * main thread and costs nothing while the user is not scrolling.
 *
 * Elements are unobserved as soon as they have revealed, so the work is
 * strictly one-shot.
 */
export function initReveal() {
  const targets = qsa('[data-reveal]');
  if (!targets.length) return;

  // No IntersectionObserver (or reduced motion): show everything immediately.
  if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  targets.forEach((el) => {
    const delay = el.dataset.revealDelay;
    if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    },
    {
      // fire a little before the element reaches the viewport edge so the
      // movement has finished by the time it is properly in view
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.08,
    }
  );

  targets.forEach((el) => observer.observe(el));
}

/**
 * Splits a heading into one masked line per visual line so it can rise into
 * place. The original text is restored into the DOM structure, so the heading
 * still reads as a single string to assistive tech and to crawlers.
 *
 * Re-splits on resize because the number of visual lines changes with width.
 */
export function initSplitHeadings() {
  const headings = qsa('[data-split]');
  if (!headings.length || prefersReducedMotion()) return;

  headings.forEach((heading) => {
    const text = heading.textContent.trim();
    heading.setAttribute('aria-label', text);

    const build = () => {
      // Lay every word out in its own span, let the browser wrap them
      // naturally, then group the words by the vertical offset they landed on.
      // That gives the real line breaks for this exact viewport width.
      const words = text.split(/\s+/);
      heading.innerHTML = words
        .map((word) => `<span data-word>${word}</span>`)
        .join(' ');

      const lines = [];
      qsa('[data-word]', heading).forEach((span) => {
        const top = span.offsetTop;
        const line = lines[lines.length - 1];
        if (line && line.top === top) line.words.push(span.textContent);
        else lines.push({ top, words: [span.textContent] });
      });

      heading.innerHTML = lines
        .map(
          (line, i) =>
            `<span class="split-line" aria-hidden="true"><span class="split-line__inner" style="--line-delay:${
              i * 90
            }ms">${line.words.join(' ')}</span></span>`
        )
        .join('');
    };

    build();

    // The number of visual lines changes with the viewport, so re-split after
    // a resize settles. Re-adding the reveal class keeps them on screen.
    window.addEventListener(
      'resize',
      debounce(() => {
        build();
        heading.classList.add('is-revealed');
      }, 250)
    );
  });
}
