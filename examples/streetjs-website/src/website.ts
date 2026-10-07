/**
 * StreetJS website — application wiring (one shell, one router, one theme, one
 * search, one SSR entry, one browser entry).
 *
 * SSR and the client share this composition: the server renders the same shell
 * and the matched route through `renderToString`; the browser re-mounts with
 * `hydrate: true` to adopt that markup node-for-node.
 */

import {
  adoptServerStyles, BrowserDOMAdapter, createRouter, mountRouter, renderStyles, signal, styleRegistry,
} from 'streetui';
import type { Router, RouterHistory, Signal } from 'streetui';
import { createBackendPanel, type BackendPanel, type FetchLike } from './backend.js';
import { createPlayground, type PlaygroundState } from './playground.js';
import { buildRoutes } from './routes.js';
import { createSearchState, type SearchState } from './search.js';
import { installSearchKeys } from './search-keys.js';
import { websiteShell } from './shell.js';
import { createTheme, defaultThemeStorage, type ThemeChoice, type ThemeController, type ThemeStorage } from './theme.js';
// Side-effect import: registers every design-system style identity at module
// load, so the stylesheet is complete and identical for every route.
import './design-system.js';

const CSS_MARKER = 'data-streetui-css';

/**
 * The framework ships no client-side style injector, so a client-only mount
 * installs the stylesheet itself; a hydrating mount only adopts the server's.
 */
function installClientStyles(container: Element, hydrate: boolean): void {
  const doc = container.ownerDocument;
  if (doc === null) return;
  if (hydrate) {
    adoptServerStyles(new BrowserDOMAdapter(), null, { registry: styleRegistry });
    return;
  }
  const head = doc.head;
  if (head === null || head === undefined) return;
  if (head.querySelector(`[${CSS_MARKER}]`) !== null) return;
  const sheet = renderStyles({ registry: styleRegistry });
  if (sheet.length === 0) return;
  head.insertAdjacentHTML('beforeend', sheet);
}

export interface WebsiteOptions {
  readonly history?: RouterHistory;
  readonly hydrate?: boolean;
  readonly themeStorage?: ThemeStorage;
  /** Injectable fetch for the backend probe (tests). */
  readonly fetchImpl?: FetchLike;
  /** Document used for the keyboard/click handlers (defaults to the global one). */
  readonly doc?: Document;
}

export interface Website {
  readonly router: Router;
  readonly theme: ThemeController;
  readonly search: SearchState;
  readonly menuOpen: Signal<boolean>;
  readonly playground: PlaygroundState;
  readonly backend: BackendPanel;
}

export interface MountedWebsite extends Website {
  unmount(): void;
}

export function createWebsite(options: WebsiteOptions = {}): Website {
  const menuOpen = signal(false);
  const playground = createPlayground();
  const backend = createBackendPanel(options.fetchImpl);
  const search = createSearchState();
  // While hydrating, the theme must START as the server rendered it ("System")
  // so the first client render matches the adopted markup; the stored choice
  // is applied right after mount (see mountWebsite). Reading it earlier would
  // make the first render disagree with the server's "Theme: System" label,
  // and hydration adopts text rather than re-patching it.
  const realStorage = options.themeStorage ?? defaultThemeStorage();
  const storage: ThemeStorage = options.hydrate === true
    ? { read: () => null, write: (c: ThemeChoice) => realStorage.write(c) }
    : realStorage;
  const theme = createTheme({ storage });
  let routerRef: Router | undefined;
  const routes = buildRoutes({
    getRouter: () => {
      if (routerRef === undefined) throw new Error('router accessed before it was created');
      return routerRef;
    },
    playground,
    backend,
  });
  const router = createRouter(options.history !== undefined
    ? { routes, history: options.history }
    : { routes });
  routerRef = router;
  return { router, theme, search, menuOpen, playground, backend };
}

export function mountWebsite(container: Element, options: WebsiteOptions = {}): MountedWebsite {
  const site = createWebsite(options);
  const hydrate = options.hydrate ?? false;
  installClientStyles(container, hydrate);

  const mounted = mountRouter(site.router, {
    container,
    outletId: 'page-outlet',
    hydrate,
    shell: (shell) => websiteShell(shell, {
      router: site.router, theme: site.theme, search: site.search, menuOpen: site.menuOpen,
    }),
  });

  if (hydrate) {
    // Apply the visitor's stored theme now that the server markup is adopted.
    const stored = (options.themeStorage ?? defaultThemeStorage()).read();
    if (stored !== null && stored !== site.theme.choice.peek()) site.theme.choice.set(stored);
  }

  const doc = options.doc ?? (typeof document !== 'undefined' ? document : undefined);
  const disposeKeys = installSearchKeys(doc !== undefined
    ? { search: site.search, router: site.router, doc }
    : { search: site.search, router: site.router });

  // A navigation closes the mobile menu and the search dialog.
  const stop = site.router.currentRoute.subscribe(() => {
    if (site.menuOpen.peek()) site.menuOpen.set(false);
    if (site.search.open.peek()) site.search.closeSearch();
  });

  return {
    ...site,
    unmount: () => {
      if (typeof stop === 'function') stop();
      disposeKeys();
      mounted.unmount();
      site.theme.dispose();
    },
  };
}
