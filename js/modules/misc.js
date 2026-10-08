import { qsa } from './util.js';

/**
 * Small odds and ends.
 *
 * The copyright year is already stamped at build time, so this only matters
 * for a site that sits unrebuilt across New Year - cheap insurance.
 * External links get rel="noopener" so a target="_blank" page can never reach
 * back into this one through window.opener.
 */
export function initYear() {
  const year = String(new Date().getFullYear());
  qsa('[data-year]').forEach((el) => {
    el.textContent = year;
  });

  qsa('a[target="_blank"]').forEach((link) => {
    const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    link.setAttribute('rel', Array.from(rel).join(' '));
  });
}
