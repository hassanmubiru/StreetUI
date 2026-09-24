/**
 * Browser entry. Runs after the server HTML has painted: it reads the embedded
 * state snapshot, rebuilds the identical reactive state, and HYDRATES the
 * existing markup — adopting the server DOM instead of re-rendering it.
 */

import { createRenderer, readState } from 'streetui';
import { BrowserDOMAdapter } from 'streetui';
import { createState, compileApp, viewForPath, STATE_KEY, type AppSnapshot, type AppState } from './app.js';

export interface HydrateResult {
  readonly state: AppState;
  unmount(): void;
}

/** Hydrate the app inside `appContainer`, seeded from the SSR state island. */
export function hydrateApp(appContainer: Element, stateRoot?: Element | Document): HydrateResult {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, stateRoot ?? appContainer);
  const seed = transferred[STATE_KEY] as AppSnapshot | undefined;

  const state = createState(seed);
  const compiled = compileApp(state);

  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, appContainer);

  // Keep the view in sync with browser back/forward navigation.
  const onPop = (): void => state.view.set(viewForPath(location.pathname));
  window.addEventListener('popstate', onPop);

  return {
    state,
    unmount: () => {
      window.removeEventListener('popstate', onPop);
      handle.unmount();
    },
  };
}

// Auto-boot in a real browser; guarded so importing in a non-DOM environment
// (e.g. a test) does nothing.
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
