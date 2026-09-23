/**
 * Browser entry point for the StreetUI showcase.
 *
 * In a real browser, this auto-mounts into `#app` if present. You can also
 * import { mountShowcaseApp } and mount into any container yourself.
 */
import { mountShowcaseApp, createShowcaseApp } from './showcase-app.js';

export { mountShowcaseApp, createShowcaseApp };
export type { Feature, ShowcaseState, ShowcaseActions } from './showcase-app.js';

// Auto-mount when running in a browser with a #app element.
declare const document: { getElementById(id: string): Element | null } | undefined;
if (typeof document !== 'undefined') {
  const container = document.getElementById('app');
  if (container !== null) {
    mountShowcaseApp(container);
  }
}
