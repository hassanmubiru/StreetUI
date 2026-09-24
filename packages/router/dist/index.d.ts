import { PageDSL, ContainerDSL } from '@streetui/dsl';
import { ReadonlySignal } from '@streetui/state';
import { StreetRenderer } from '@streetui/runtime';

/**
 * StreetUI Router — public type surface.
 *
 * The router sits ABOVE the DSL/compiler/runtime/renderer and composes them.
 * It introduces no new rendering path and no second reactive system: route
 * state is a StreetUI `signal`, route cleanup reuses the core `CleanupRegistry`,
 * and each route renders as an ordinary compiled StreetUI application tree.
 */

/**
 * Context handed to a route builder when its route becomes active.
 *
 * `params` are the values captured from dynamic segments (`/users/:id`),
 * `query` is the parsed query string, and `onCleanup` registers work to run
 * when the router navigates away from this route (subscriptions, effects,
 * timers). It is backed by a route-scoped `CleanupRegistry` — there is no
 * separate cleanup mechanism.
 */
interface RouteContext {
    /** Full matched pathname, e.g. `/users/123`. */
    readonly path: string;
    /** The route pattern that matched, e.g. `/users/:id` or `*`. */
    readonly pattern: string;
    /** Dynamic segment values captured from the path. */
    readonly params: Readonly<Record<string, string>>;
    /** Parsed query string (everything after `?`). */
    readonly query: URLSearchParams;
    /** Register a callback to run when navigating away from this route. */
    onCleanup(fn: () => void): void;
}
/** Builds a route's page tree. Receives the page scope and the route context. */
type RouteBuilder = (page: PageDSL, ctx: RouteContext) => void;
/** A single route: a path pattern and the builder that renders it. */
interface RouteDefinition {
    /**
     * Path pattern. Supports:
     *  - static segments:      `/`, `/docs`, `/docs/getting-started`
     *  - dynamic `:param`:     `/users/:id`
     *  - catch-all wildcard:   `*` (matches anything — use for a 404 route)
     */
    readonly path: string;
    readonly builder: RouteBuilder;
}
/** The result of resolving a location against the route table. */
interface RouteMatch {
    /** The active pathname (no query string). */
    readonly path: string;
    /** The pattern of the matched route. */
    readonly pattern: string;
    /** Captured dynamic params. */
    readonly params: Readonly<Record<string, string>>;
    /** Parsed query string. */
    readonly query: URLSearchParams;
    /** The route definition that produced this match. */
    readonly route: RouteDefinition;
    /** True when this match came from the wildcard catch-all (`*`) — i.e. a 404. */
    readonly isFallback: boolean;
}

/**
 * Route matching — pure functions, no DOM, no reactivity.
 *
 * A pattern is matched segment-by-segment against a pathname:
 *  - a literal segment must equal the path segment,
 *  - a `:name` segment captures the path segment into `params.name`,
 *  - a `*` segment (or a whole-pattern `*`) is a catch-all that matches the
 *    remainder of the path and captures it into `params['*']`.
 *
 * Matching is intentionally small: no optional segments, no regex constraints,
 * no nested route trees. Composition of layouts is done in the DSL, not here.
 */
/** Normalize a pathname: ensure a single leading slash, drop a trailing slash. */
declare function normalizePath(path: string): string;
/**
 * Try to match a single pattern against a pathname.
 * Returns the captured params on success, or `null` on no match.
 */
declare function matchPattern(pattern: string, pathname: string): Record<string, string> | null;
interface MatchResult<R> {
    readonly route: R;
    readonly params: Record<string, string>;
}
/**
 * Match a pathname against an ordered list of routes. The first route whose
 * pattern matches wins (definition order), so more specific routes should be
 * listed before a `*` fallback.
 */
declare function matchRoutes<R extends {
    path: string;
}>(routes: readonly R[], pathname: string): MatchResult<R> | null;
/** Split a `to` target into its pathname and (already-stripped) search string. */
declare function splitTarget(to: string): {
    pathname: string;
    search: string;
};

/**
 * Router history — a small abstraction over the navigation source so the router
 * can run both in the browser (real `window.history` + `popstate`) and in tests
 * (an in-memory stack, fully deterministic, no globals).
 *
 * Internal navigation never triggers a full-page reload: the browser history
 * uses `pushState`/`replaceState` and notifies listeners synchronously.
 */
interface RouterLocation {
    /** Pathname, always normalized with a single leading slash. */
    readonly pathname: string;
    /** Query string without the leading `?`. */
    readonly search: string;
}
interface RouterHistory {
    /** The current location. */
    location(): RouterLocation;
    /** Push a new entry and notify listeners. */
    push(pathname: string, search: string): void;
    /** Replace the current entry and notify listeners. */
    replace(pathname: string, search: string): void;
    /** Go back one entry. */
    back(): void;
    /** Go forward one entry. */
    forward(): void;
    /** Subscribe to location changes. Returns an unsubscribe function. */
    listen(cb: () => void): () => void;
    /** Detach any global listeners (browser only). */
    dispose(): void;
}
/**
 * Browser history backed by `window.history`. `pushState`/`replaceState` do not
 * emit `popstate`, so we notify listeners ourselves after those calls; genuine
 * back/forward navigation arrives via the `popstate` event.
 */
declare function createBrowserHistory(): RouterHistory;
/**
 * In-memory history for tests and non-DOM environments. Maintains an explicit
 * stack and cursor so `back()`/`forward()` are deterministic.
 */
declare function createMemoryHistory(initial?: string): RouterHistory;

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

interface RouterOptions {
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
interface NavigateOptions {
    /** Replace the current history entry instead of pushing a new one. */
    readonly replace?: boolean;
}
interface IsActiveOptions {
    /** Require an exact pathname match rather than a prefix match. */
    readonly exact?: boolean;
}
interface Router {
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
declare function createRouter(options: RouterOptions): Router;

/**
 * StreetUI Router — DOM integration.
 *
 * `mountRouter` wires a `Router` to real DOM:
 *
 *   1. Mounts an optional persistent shell (layout + navigation) ONCE. The shell
 *      declares an outlet element (see `routerOutlet`) into which route content
 *      is rendered.
 *   2. Subscribes to `router.currentRoute`. On every change it disposes the
 *      previous route (route-scoped `CleanupRegistry.run()` + `runtime.unmount()`)
 *      and mounts the new route's compiled application into the outlet.
 *      Only the outlet subtree is re-created — the shell persists.
 *   3. Intercepts clicks on internal `<a>` elements for client-side navigation.
 *      External links (absolute URLs, `target="_blank"`, `mailto:`/`tel:`) keep
 *      their normal browser behaviour, and `link()` is used unchanged.
 *
 * Each route is an ordinary compiled StreetUI application — no special renderer
 * path, no virtual DOM, no full-application rerender on navigation.
 */

/** Default id used for the route outlet element inside a shell. */
declare const ROUTER_OUTLET_ID = "streetui-router-outlet";
/**
 * Declare the route outlet inside a shell builder. The router replaces this
 * element's contents on every navigation.
 */
declare function routerOutlet(scope: ContainerDSL, id?: string): void;
type ShellBuilder = (shell: PageDSL, router: Router) => void;
interface MountRouterOptions {
    /** Element to mount into. With a shell, the shell fills this; otherwise routes do. */
    readonly container: Element;
    /** Optional persistent layout. Must include a `routerOutlet(...)`. */
    readonly shell?: ShellBuilder;
    /** Id of the outlet element within the shell. Defaults to `ROUTER_OUTLET_ID`. */
    readonly outletId?: string;
    /** Override the renderer (e.g. a custom DOM adapter for tests). */
    readonly renderer?: StreetRenderer;
    /** Intercept internal `<a>` clicks for client-side navigation. Defaults to true. */
    readonly interceptLinks?: boolean;
    /**
     * Hydrate server-rendered HTML already present in the container instead of
     * mounting fresh. The shell and the *initial* route adopt the existing DOM;
     * subsequent client-side navigations mount normally. Defaults to false.
     */
    readonly hydrate?: boolean;
}
interface MountedRouter {
    /** The element route content is rendered into. */
    readonly outlet: Element;
    /** Tear down the current route, the shell, link interception and the router. */
    unmount(): void;
}
declare function mountRouter(router: Router, options: MountRouterOptions): MountedRouter;

export { type IsActiveOptions, type MatchResult, type MountRouterOptions, type MountedRouter, type NavigateOptions, ROUTER_OUTLET_ID, type RouteBuilder, type RouteContext, type RouteDefinition, type RouteMatch, type Router, type RouterHistory, type RouterLocation, type RouterOptions, type ShellBuilder, createBrowserHistory, createMemoryHistory, createRouter, matchPattern, matchRoutes, mountRouter, normalizePath, routerOutlet, splitTarget };
