/**
 * StreetUI Stress App — browser entry.
 *
 * Mounts the app into #app. If the element already contains server-rendered
 * markup (data-ssr) it hydrates in place; otherwise it mounts fresh. Uses the
 * default browser history.
 */

import { mountApp } from './app.js';

export function start(): void {
  const el = document.getElementById('app');
  if (el === null) throw new Error('#app mount node not found');
  const hydrate = el.hasAttribute('data-ssr');
  mountApp(el, { hydrate });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => start());
  } else {
    start();
  }
}
