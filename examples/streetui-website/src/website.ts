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
import type { Router, RouterHistory, Signal } from 'streetui';
import { websiteShell, createSearchState, type SearchState } from './shell.js';
import { createTheme, type ThemeController, type ThemeStorage } from './theme.js';
import { createPlaygroundState, type PlaygroundState } from './playground.js';
import { buildRoutes } from './routes.js';

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
  const mounted = mountRouter(site.router, {
    container,
    outletId: 'page-outlet',
    hydrate: options.hydrate ?? false,
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
