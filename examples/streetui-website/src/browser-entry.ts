/**
 * StreetUI Website — browser entry.
 *
 * Mounts the website into #app. If the element already contains server-rendered
 * markup (data-ssr), it hydrates in place; otherwise it mounts fresh. Uses the
 * default browser history.
 */

import { mountWebsite } from './website.js';

export function start(): void {
  const el = document.getElementById('app');
  if (el === null) throw new Error('#app mount node not found');
  const hydrate = el.hasAttribute('data-ssr');
  mountWebsite(el, { hydrate });
}

// Auto-start when loaded in a browser document.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => start());
  } else {
    start();
  }
}
