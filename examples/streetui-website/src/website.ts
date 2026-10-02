/**
 * StreetUI Website — application wiring.
 *
 * Composes the real public API into one mountable / SSR-able app:
 *   • createRouter + mountRouter + routerOutlet  (the route tree in routes.ts)
 *   • createTheme                                 (light/dark/system, persisted)
 *   • createSearchState                           (bound query → derived results)
 *   • createPlaygroundState                       (live demo signals)
 *
 * SSR follows the same pattern the account example uses: mount into a server
 * container to obtain HTML, then re-mount with { hydrate: true } to adopt it.
 * There is no second render path — the shell + each route are ordinary compiled
 * StreetUI trees.
 */

import { signal, createRouter, mountRouter } from 'streetui';
import { renderStyles, adoptServerStyles, styleRegistry, BrowserDOMAdapter } from 'streetui';
import type { Router, RouterHistory, Signal } from 'streetui';
import { websiteShell, createSearchState, type SearchState } from './shell.js';
import { createTheme, type ThemeController, type ThemeStorage } from './theme.js';
import { createPlaygroundState, type PlaygroundState } from './playground.js';
import { buildRoutes } from './routes.js';
// Side-effect import: registers every design-system style identity into the
// shared styleRegistry at module load, so the client stylesheet is complete
// before the first mount (SSR determinism carried to the client, §15/§17).
import './design-system.js';

/** Marker on the single framework-managed stylesheet block. */
const CSS_MARKER = 'data-streetui-css';

/**
 * Make the design-system stylesheet live in the document the website mounts
 * into. The framework intentionally ships NO client-side style injector — a
 * stylesheet is global, cascading document state, not per-render DOM — so a
 * client-only mount is the application's job (a real dogfooding finding, see
 * V2.7.0 website report). Two cases, mirroring head adoption:
 *
 *   • hydrate  — the server already placed the sheet in <head>; we only adopt
 *     its identities into the registry (adoptServerStyles) so client-side
 *     style() calls for the same identities emit no duplicate rule (§17).
 *   • fresh    — no server sheet exists, so we serialize the registry once
 *     (renderStyles) and inject that single <style> block into <head>. Guarded
 *     to run at most once per document (idempotent across re-mounts).
 */
function installClientStyles(container: Element, hydrate: boolean): void {
  const doc = container.ownerDocument;
  if (doc === null) return;
  if (hydrate) {
    // Server sheet is already in the DOM; seed registry identities from it.
    adoptServerStyles(new BrowserDOMAdapter(), null, { registry: styleRegistry });
    return;
  }
  const head = doc.head;
  if (head === null || head === undefined) return;
  if (head.querySelector(`[${CSS_MARKER}]`) !== null) return; // already installed
  const sheet = renderStyles({ registry: styleRegistry });
  if (sheet.length === 0) return; // empty registry → nothing to inject (§16)
  head.insertAdjacentHTML('beforeend', sheet);
}

export interface WebsiteOptions {
  /** Navigation source. Defaults to the browser history. Pass memory for tests/SSR. */
  readonly history?: RouterHistory;
  /** Adopt server-rendered markup instead of mounting fresh. */
  readonly hydrate?: boolean;
  /** Theme persistence seam (defaults to guarded localStorage). */
  readonly themeStorage?: ThemeStorage;
}

export interface Website {
  readonly router: Router;
  readonly theme: ThemeController;
  readonly search: SearchState;
  readonly playground: PlaygroundState;
  /** Two-way bound examples filter (also seeded from ?q=). */
  readonly examplesFilter: Signal<string>;
}

export interface MountedWebsite extends Website {
  unmount(): void;
}

/** Build the website's state + router without touching the DOM. */
export function createWebsite(options: WebsiteOptions = {}): Website {
  const examplesFilter = signal('');
  const playground = createPlaygroundState();
  const search = createSearchState(signal(''));
  const theme = createTheme(
    options.themeStorage !== undefined ? { storage: options.themeStorage } : {},
  );

  const routes = buildRoutes({ examplesFilter, playground });
  const router = createRouter(
    options.history !== undefined ? { routes, history: options.history } : { routes },
  );

  return { router, theme, search, playground, examplesFilter };
}

/** Mount the website into `container`. */
export function mountWebsite(container: Element, options: WebsiteOptions = {}): MountedWebsite {
  const site = createWebsite(options);
  const hydrate = options.hydrate ?? false;
  // Ensure the design-system stylesheet is live in the document before/at mount.
  installClientStyles(container, hydrate);
  const mounted = mountRouter(site.router, {
    container,
    outletId: 'page-outlet',
    hydrate,
    shell: (shell) =>
      websiteShell(shell, { router: site.router, theme: site.theme, search: site.search }),
  });
  return {
    ...site,
    unmount: () => {
      mounted.unmount(); // tears down route, shell, link interception and router
      site.theme.dispose();
    },
  };
}
