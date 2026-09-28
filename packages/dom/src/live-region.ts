/**
 * ARIA live-region announcer (§15).
 *
 * Screen readers announce text that appears inside an `aria-live` region. The
 * naive approach — append a fresh `<div aria-live>` per message — leaks a
 * growing pile of stale nodes and (because a node inserted *already carrying*
 * its text is often not re-announced) is unreliable. This announcer instead
 * keeps exactly TWO persistent regions on `<body>` — one `polite`, one
 * `assertive` — and mutates their text to speak. Announcing clears the region
 * first and writes on a microtask so that repeating the same string still
 * triggers a DOM mutation the AT will pick up.
 *
 * Built entirely on the {@link DOMAdapter}, so it is server-safe: when
 * `dom.body()` is null (SSR / headless) construction returns an inert announcer
 * whose `announce`/`clear`/`destroy` are no-ops. There is never any SSR markup
 * for a live region — announcements are a runtime-only concept.
 */

import type { DOMAdapter } from './adapter.js';

export interface Announcer {
  /**
   * Announce `message`. `assertive` (default false) routes to the assertive
   * region (interrupts the user) instead of the polite one (waits for a pause).
   */
  announce(message: string, options?: { assertive?: boolean }): void;
  /** Clear both regions without announcing anything. */
  clear(): void;
  /** Remove both regions from the DOM. Idempotent. */
  destroy(): void;
}

/** Build the hidden, visually-clipped style shared by both regions. */
const VISUALLY_HIDDEN =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';

function makeRegion(dom: DOMAdapter, politeness: 'polite' | 'assertive'): Element {
  const el = dom.createElement('div');
  dom.setAttribute(el, 'aria-live', politeness);
  // `aria-atomic=true` makes the AT read the whole region on each change, so a
  // replaced message is spoken in full rather than diffed.
  dom.setAttribute(el, 'aria-atomic', 'true');
  dom.setAttribute(el, 'role', politeness === 'assertive' ? 'alert' : 'status');
  dom.setAttribute(el, 'data-streetui-live', politeness);
  dom.setAttribute(el, 'style', VISUALLY_HIDDEN);
  return el;
}

/**
 * Create a live-region announcer bound to `dom`. Idempotent per call — each
 * call owns its own pair of regions, so an app that wants a single shared
 * announcer should create one and reuse it (and `destroy()` it on teardown).
 */
export function createAnnouncer(dom: DOMAdapter): Announcer {
  const body = dom.body();
  if (body === null) {
    // Server / headless: nothing to announce into.
    return { announce() {}, clear() {}, destroy() {} };
  }

  const polite = makeRegion(dom, 'polite');
  const assertive = makeRegion(dom, 'assertive');
  dom.appendChild(body, polite);
  dom.appendChild(body, assertive);
  let destroyed = false;

  const write = (region: Element, message: string): void => {
    // Clear first so an identical repeat message still mutates the region (and
    // is therefore re-announced); set on a microtask so the empty→text change
    // is observed as a distinct mutation.
    dom.setTextContent(region, '');
    void Promise.resolve().then(() => {
      if (!destroyed) dom.setTextContent(region, message);
    });
  };

  return {
    announce(message, options): void {
      if (destroyed) return;
      write(options?.assertive === true ? assertive : polite, message);
    },
    clear(): void {
      if (destroyed) return;
      dom.setTextContent(polite, '');
      dom.setTextContent(assertive, '');
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const region of [polite, assertive]) {
        const parent = dom.parentNode(region);
        if (parent !== null) dom.removeChild(parent, region);
      }
    },
  };
}
