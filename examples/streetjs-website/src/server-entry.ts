/**
 * StreetJS website — server entry.
 *
 * renderWebsite(path) composes the persistent shell and the matched route into
 * ONE compiled StreetUI app and runs the normal renderToString pipeline. The
 * route is matched by the same router the client uses (memory history), so SSR
 * and the browser agree on patterns, params and query parsing.
 */

import {
  compile, createMemoryHistory, createRouter, renderHead, renderStyles, renderToString, serializeState,
  signal, streetui, styleRegistry,
} from 'streetui';
import type { PageDSL, RouteContext } from 'streetui';
import { createBackendPanel } from './backend.js';
import { configureSite } from './metadata.js';
import { createPlayground } from './playground.js';
import { buildRoutes, isKnownPath } from './routes.js';
import { createSearchState } from './search.js';
import { websiteShell } from './shell.js';
import { createTheme } from './theme.js';
import './design-system.js';

export const STATE_KEY = 'streetjs-website';

export interface RenderResult {
  /** Shell + active route, for the #app mount node. */
  readonly html: string;
  /** Complete head for this route (title, description, canonical, robots, OG, Twitter). */
  readonly head: string;
  readonly stateScript: string;
  /** The single design-system stylesheet; byte-identical for every route. */
  readonly styles: string;
  /** 200 for a real page, 404 for the wildcard / unknown slug. */
  readonly status: 200 | 404;
}

export interface RenderOptions {
  /** Absolute origin for canonical and Open Graph URLs, e.g. https://example.org */
  readonly siteUrl?: string;
}

export function renderWebsite(path: string, options: RenderOptions = {}): RenderResult {
  if (options.siteUrl !== undefined) configureSite({ baseUrl: options.siteUrl });

  const playground = createPlayground();
  const backend = createBackendPanel();
  const search = createSearchState();
  const theme = createTheme({ storage: { read: () => null, write: () => {} } });
  const menuOpen = signal(false);

  let routerRef: ReturnType<typeof createRouter> | undefined;
  const routes = buildRoutes({
    getRouter: () => {
      if (routerRef === undefined) throw new Error('router accessed before it was created');
      return routerRef;
    },
    playground,
    backend,
  });
  const router = createRouter({ routes, history: createMemoryHistory(path) });
  routerRef = router;
  const match = router.currentRoute.get();

  const ctx: RouteContext = {
    path: match.path,
    pattern: match.pattern,
    params: match.params,
    query: match.query,
    onCleanup: () => { /* server render has no lifecycle */ },
  };

  const app = streetui.app({ name: 'streetjs-website', version: '1.0.0' });
  app.page('website', (page) => {
    websiteShell(page, {
      router, theme, search, menuOpen,
      renderOutlet: (content) => { match.route.builder(content as unknown as PageDSL, ctx); },
    });
  });

  const compiled = compile(app);
  const html = renderToString(compiled);
  const head = renderHead(compiled);
  const themeChoice = theme.choice.get();
  theme.dispose();
  router.destroy();

  return {
    html,
    head,
    stateScript: serializeState({ [STATE_KEY]: { path, themeChoice } }),
    styles: renderStyles({ registry: styleRegistry }),
    status: isKnownPath(match.path) ? 200 : 404,
  };
}
