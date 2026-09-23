/**
 * Browser entry (#24). Runs in the browser after the server HTML has already
 * painted. It reads the embedded state island, rebuilds the exact reactive state
 * the server used, and HYDRATES the existing `#app` markup — adopting the server
 * DOM rather than throwing it away and re-rendering.
 *
 * After this returns, the app is fully live: the increment button mutates a
 * signal, the name input is two-way bound, the details toggle flips a `when()`
 * branch, and the todo list is keyed — all driving the server-produced DOM in
 * place.
 */

import { createRenderer, readState } from '@streetui/renderer';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createState, compileApp, STATE_KEY, type AppSnapshot, type AppState } from './app.js';

export interface HydrateResult {
  readonly state: AppState;
  unmount(): void;
}

/**
 * Hydrate the app inside `appContainer`, seeding its state from the island found
 * under `stateRoot` (defaults to the app container itself).
 */
export function hydrateApp(appContainer: Element, stateRoot?: Element | Document): HydrateResult {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, stateRoot ?? appContainer);
  const seed = transferred[STATE_KEY] as AppSnapshot | undefined;

  const state = createState(seed);
  const compiled = compileApp(state);

  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, appContainer);

  return {
    state,
    unmount: () => handle.unmount(),
  };
}

// Auto-boot in a real browser. Guarded so importing this module in a non-DOM
// environment does nothing (`typeof` on a missing global is safe and never
// throws); `hydrateApp` can still be called explicitly, e.g. from a test.
if (typeof document !== 'undefined') {
  const boot = (): void => {
    const app = document.getElementById('app');
    if (app !== null) hydrateApp(app, document);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
