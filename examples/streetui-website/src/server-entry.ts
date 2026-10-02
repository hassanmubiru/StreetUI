/**
 * StreetUI Website — server entry.
 *
 * `renderWebsite(path)` produces the server HTML for a route: the persistent
 * shell with the active route already rendered inside the `#page-outlet`
 * element, exactly where the client router will later hydrate it. It composes
 * the shell + route into ONE compiled StreetUI app and runs the normal
 * `renderToString` pipeline — no SSR-specific renderer.
 *
 * Route matching reuses the real router (memory history) so the same patterns,
 * params and query parsing drive SSR and the client. State is embedded with
 * `serializeState` so the client can resume without recomputation.
 */

import { streetui, compile, renderToString, renderHead, serializeState, signal } from 'streetui';
import { renderStyles, styleRegistry } from 'streetui';
import { createRouter, createMemoryHistory } from 'streetui';
import type { RouteContext } from 'streetui';
import { websiteShell, createSearchState } from './shell.js';
import { createTheme } from './theme.js';
import { createPlaygroundState } from './playground.js';
import { buildRoutes } from './routes.js';
// Importing the design system registers every website style token into the
// shared styleRegistry at module load (SSR determinism, §15/§16), so the
// serialized stylesheet below is complete and identical for every route.
import './design-system.js';

export const STATE_KEY = 'streetui-website';

export interface RenderResult {
  /** The app body HTML (shell + active route), to place inside the mount node. */
  readonly html: string;
  /**
   * The merged document metadata for this route, serialized for `<head>`
   * (title + meta + link + canonical + Open Graph + Twitter). Each tag carries
   * the `data-streetui-head` marker so the client adopts it on hydration
   * without duplicating. Empty string only if the app declares no metadata.
   */
  readonly head: string;
  /** A <script> island embedding serialized state for client resume. */
  readonly stateScript: string;
}

/** Render the website at `path` (may include a query string) to HTML. */
export function renderWebsite(path: string): RenderResult {
  const examplesFilter = signal('');
  const playground = createPlaygroundState();
  const search = createSearchState(signal(''));
  // SSR: no DOM, so the theme controller attaches to nothing (data-theme lives
  // on <html>, outside the app container — never a hydration mismatch).
  const theme = createTheme({ storage: { read: () => null, write: () => {} } });

  const routes = buildRoutes({ examplesFilter, playground });
  const router = createRouter({ routes, history: createMemoryHistory(path) });
  const match = router.currentRoute.get();

  const ctx: RouteContext = {
    path: match.path,
    pattern: match.pattern,
    params: match.params,
    query: match.query,
    onCleanup: () => { /* SSR: render lifecycle only */ },
  };

  const app = streetui.app({ name: 'streetui-website', version: '2.5.0' });
  app.page('website', (page) => {
    websiteShell(page, {
      router,
      theme,
      search,
      renderOutlet: (content) => {
        // Route builders expect a PageDSL; ContainerDSL is structurally
        // compatible (PageDSL extends ContainerDSL with no additions).
        match.route.builder(content as unknown as import('streetui').PageDSL, ctx);
      },
    });
  });

  const compiled = compile(app);
  const html = renderToString(compiled);
  const head = renderHead(compiled);
  const themeChoice = theme.choice.get();
  theme.dispose();
  router.destroy();

  const stateScript = serializeState({
    [STATE_KEY]: { path, themeChoice },
  });

  return { html, head, stateScript };
}
