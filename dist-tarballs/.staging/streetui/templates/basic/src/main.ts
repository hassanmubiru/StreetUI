/**
 * Browser entry. Reads the SSR state snapshot, rebuilds identical state, and
 * hydrates the server-rendered markup in place.
 */

import { createRenderer, readState } from 'streetui';
import { BrowserDOMAdapter } from 'streetui';
import { createState, compileApp, STATE_KEY, type AppSnapshot, type AppState } from './app.js';

export interface HydrateResult {
  readonly state: AppState;
  unmount(): void;
}

export function hydrateApp(appContainer: Element, stateRoot?: Element | Document): HydrateResult {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, stateRoot ?? appContainer);
  const seed = transferred[STATE_KEY] as AppSnapshot | undefined;

  const state = createState(seed);
  const compiled = compileApp(state);

  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, appContainer);

  return { state, unmount: () => handle.unmount() };
}

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
