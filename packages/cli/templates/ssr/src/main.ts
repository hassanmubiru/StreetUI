/**
 * Browser entry. Runs after the server HTML has painted: it reads the embedded
 * state snapshot, rebuilds the identical reactive state, and HYDRATES the
 * existing markup — adopting the server DOM instead of re-rendering it.
 *
 * HMR: editing `src/app.ts` re-runs the accepted update boundary below and
 * re-renders with the *same* state signals. Editing this file, or state that
 * cannot be safely preserved, falls back to a full reload.
 */

import { createRenderer, readState } from '@streetui/renderer';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createState, compileApp, viewForPath, STATE_KEY, type AppSnapshot, type AppState } from './app.js';

export interface HydrateResult {
  readonly state: AppState;
  unmount(): void;
}

let activeState: AppState | undefined;
let activeHandle: { unmount(): void } | undefined;

/** Hydrate the app inside `appContainer`, seeded from the SSR state island. */
export function hydrateApp(appContainer: Element, stateRoot?: Element | Document): HydrateResult {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, stateRoot ?? appContainer);
  const seed = transferred[STATE_KEY] as AppSnapshot | undefined;

  const state = createState(seed);
  const compiled = compileApp(state);

  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, appContainer);

  const onPop = (): void => state.view.set(viewForPath(location.pathname));
  window.addEventListener('popstate', onPop);

  activeState = state;
  activeHandle = handle;

  return {
    state,
    unmount: () => {
      window.removeEventListener('popstate', onPop);
      handle.unmount();
      if (activeHandle === handle) activeHandle = undefined;
    },
  };
}

/** Re-render with the existing state after an accepted app update. */
function rerender(): void {
  const app = document.getElementById('app');
  if (app === null || activeState === undefined) {
    location.reload();
    return;
  }
  activeHandle?.unmount();
  app.replaceChildren();
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  activeHandle = renderer.mount(compileApp(activeState), app);
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

  // Accept app.ts updates without losing the current signals.
  if (import.meta.hot) import.meta.hot.accept('./app.js', rerender);
}