/**
 * StreetJS website — browser entry.
 *
 * Hydrates in place when the server marked #app with data-ssr; otherwise mounts
 * fresh. Uses browser history.
 */

import { mountWebsite } from './website.js';

export function start(): void {
  const el = document.getElementById('app');
  if (el === null) throw new Error('#app mount node not found');
  mountWebsite(el, { hydrate: el.hasAttribute('data-ssr') });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => start());
  } else {
    start();
  }
}
