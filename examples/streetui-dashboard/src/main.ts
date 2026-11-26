/**
 * Browser entry. Rebuilds identical state from the SSR snapshot, hydrates the
 * server-rendered markup in place (no node recreation), and keeps the theme
 * attribute on the document root in sync with the theme signal.
 */
import { createRenderer, readState } from 'streetui';
import { BrowserDOMAdapter } from 'streetui';
import { effect } from 'streetui';
import { createState, compileApp, STATE_KEY, viewForPath, type AppSnapshot } from './app.js';

export function hydrateDashboard(appContainer: Element, stateRoot?: Element | Document): void {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, stateRoot ?? appContainer);
  const seed = transferred[STATE_KEY] as AppSnapshot | undefined;
  const state = createState(seed);
  const compiled = compileApp(state);
  const renderer = createRenderer({ domAdapter: dom });
  renderer.hydrate(compiled, appContainer);

  // Theme is a document-level concern: keep <html data-theme> in sync.
  effect(() => {
    document.documentElement.dataset.theme = state.theme.get();
  });

  // Client-side route changes via the back/forward buttons.
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      state.view.set(viewForPath(location.pathname));
    });
  }
}

if (typeof document !== 'undefined') {
  const boot = (): void => {
    const app = document.getElementById('app');
    if (app !== null) hydrateDashboard(app, document);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
