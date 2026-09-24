/**
 * Browser entry — read the SSR island, rebuild the same deps, hydrate the
 * server DOM in place. Auto-boots in a real browser; callable from tests.
 */
import { createRenderer, readState } from 'streetui';
import { BrowserDOMAdapter } from 'streetui';
import { compileApp } from './index.js';
import { createDeps, STATE_KEY, type AppDeps, type AppSnapshot, type Theme } from './deps.js';

export interface HydrateResult {
  readonly deps: AppDeps;
  unmount(): void;
}

export function hydrateApp(container: Element, stateRoot?: Element | Document, theme?: Theme): HydrateResult {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, stateRoot ?? container);
  const seed = transferred[STATE_KEY] as AppSnapshot | undefined;

  const deps = createDeps(seed !== undefined ? { seed } : {});
  const compiled = compileApp(deps, theme);
  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, container);

  return { deps, unmount: () => handle.unmount() };
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
