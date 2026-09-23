/**
 * StreetUI Router core — renderer-agnostic.
 *
 * Holds the route table, resolves the current location into a `RouteMatch`,
 * and exposes that match as a StreetUI `signal`. Navigation is delegated to a
 * `RouterHistory`; when the location changes (via `navigate`, `back`, `forward`,
 * or a browser `popstate`) the router recomputes the match and updates the
 * signal, which is how every consumer (`isActive`, the mount integration, any
 * `derived` the app builds) stays in sync. No second reactive system.
 */

import { signal, derived, type ReadonlySignal } from '@streetui/state';
import type { RouterHistory } from './history.js';
import { createBrowserHistory } from './history.js';
import { matchRoutes, normalizePath, splitTarget } from './matching.js';
import type { RouteDefinition, RouteMatch } from './types.js';

export interface RouterOptions {
  /** The route table. Order matters — the first matching pattern wins. */
  readonly routes: readonly RouteDefinition[];
  /**
   * Navigation source. Defaults to a browser history. Pass a memory history
   * for tests or non-DOM environments.
   */
  readonly history?: RouterHistory;
  /**
   * Fallback route used when nothing else matches and no `*` route is present.
   * Defaults to a built-in 404 page (a normal StreetUI tree — no special path).
   */
  readonly notFound?: RouteDefinition;
}

export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  readonly replace?: boolean;
}

export interface IsActiveOptions {
  /** Require an exact pathname match rather than a prefix match. */
  readonly exact?: boolean;
}

export interface Router {
  /** Reactive current match. Consumers subscribe via StreetUI signals. */
  readonly currentRoute: ReadonlySignal<RouteMatch>;
  /** Navigate to a target path (may include a query string). */
  navigate(to: string, options?: NavigateOptions): void;
  /** Go back one history entry. */
  back(): void;
  /** Go forward one history entry. */
  forward(): void;
  /** Reactive predicate: is `path` the active route (or a prefix of it)? */
  isActive(path: string, options?: IsActiveOptions): ReadonlySignal<boolean>;
  /** Tear down history listeners. */
  destroy(): void;
}

/** Built-in 404 route — a normal StreetUI page tree, overridable via a `*` route. */
const DEFAULT_NOT_FOUND: RouteDefinition = {
  path: '*',
  builder: (page) => {
    page.section('not-found', (s) => {
      s.heading('404 — Page not found', { level: 1, id: 'not-found-title' });
      s.text('The page you were looking for does not exist.', { id: 'not-found-text' });
      s.link('Go home', { href: '/', id: 'not-found-home' });
    }, { id: 'not-found' });
  },
};

export function createRouter(options: RouterOptions): Router {
  const routes = options.routes;
  const history = options.history ?? createBrowserHistory();
  const fallback = options.notFound ?? DEFAULT_NOT_FOUND;

  const resolve = (): RouteMatch => {
    const loc = history.location();
    const pathname = normalizePath(loc.pathname);
    const query = new URLSearchParams(loc.search);
    const matched = matchRoutes(routes, pathname);
    if (matched !== null) {
      return {
        path: pathname,
        pattern: matched.route.path,
        params: matched.params,
        query,
        route: matched.route,
        // A catch-all `*` match is the 404 route whether user-supplied or built-in.
        isFallback: matched.route.path === '*',
      };
    }
    // No explicit route matched — use the fallback (a `*` route if the table
    // has one, otherwise the built-in 404).
    const fallbackParams =
      matchRoutes([fallback], pathname)?.params ?? {};
    return {
      path: pathname,
      pattern: fallback.path,
      params: fallbackParams,
      query,
      route: fallback,
      isFallback: true,
    };
  };

  const current = signal<RouteMatch>(resolve());
  const stopListening = history.listen(() => {
    current.set(resolve());
  });

  const navigate = (to: string, opts: NavigateOptions = {}): void => {
    const { pathname, search } = splitTarget(to);
    if (opts.replace === true) history.replace(pathname, search);
    else history.push(pathname, search);
  };

  const isActive = (path: string, opts: IsActiveOptions = {}): ReadonlySignal<boolean> => {
    const target = normalizePath(path);
    const exact = opts.exact === true;
    return derived(() => {
      const activePath = current.get().path;
      if (activePath === target) return true;
      if (exact || target === '/') return false;
      return activePath.startsWith(`${target}/`);
    });
  };

  return {
    currentRoute: current,
    navigate,
    back: () => history.back(),
    forward: () => history.forward(),
    isActive,
    destroy: () => {
      stopListening();
      history.dispose();
    },
  };
}
