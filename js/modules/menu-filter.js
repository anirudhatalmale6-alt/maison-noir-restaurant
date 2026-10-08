import { qs, qsa } from './util.js';

/**
 * Menu course filter.
 *
 * Progressive enhancement: the bar itself is hidden until this runs (see
 * `.menu-filters` in the stylesheet), so with JavaScript off the page is a
 * complete menu with every course on it rather than a set of dead buttons.
 *
 * The chosen course is written to the URL hash so a filtered view can be
 * linked to or reloaded, and any hash already in the URL is honoured on load.
 */
export function initMenuFilter() {
  const bar = qs('[data-menu-filters]');
  if (!bar) return;

  const buttons = qsa('[data-filter]', bar);
  const courses = qsa('[data-course]');
  if (!buttons.length || !courses.length) return;

  function apply(value, { updateHash = true } = {}) {
    courses.forEach((course) => {
      const match = value === 'all' || course.dataset.course === value;
      course.hidden = !match;
    });
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.filter === value ? 'true' : 'false');
    });

    if (!updateHash) return;
    // replaceState rather than a hash assignment: changing location.hash would
    // scroll the page to the matching id and lose the user's place.
    const url = value === 'all' ? window.location.pathname : `#${value}`;
    window.history.replaceState(null, '', url);
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => apply(button.dataset.filter));
  });

  const fromHash = window.location.hash.replace('#', '');
  const known = buttons.some((button) => button.dataset.filter === fromHash);
  apply(known ? fromHash : 'all', { updateHash: false });
}
