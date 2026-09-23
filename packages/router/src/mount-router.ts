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

import { streetui, type PageDSL, type ContainerDSL } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { createRuntime, type MountedApplication, type StreetRenderer } from '@streetui/runtime';
import { createRenderer } from '@streetui/renderer';
import { CleanupRegistry } from '@streetui/core';
import type { Router } from './router.js';
import type { RouteContext, RouteMatch } from './types.js';

/** Default id used for the route outlet element inside a shell. */
export const ROUTER_OUTLET_ID = 'streetui-router-outlet';

/**
 * Declare the route outlet inside a shell builder. The router replaces this
 * element's contents on every navigation.
 */
export function routerOutlet(scope: ContainerDSL, id: string = ROUTER_OUTLET_ID): void {
  scope.container('router-outlet', () => { /* filled by the router at runtime */ }, { id });
}

export type ShellBuilder = (shell: PageDSL, router: Router) => void;

export interface MountRouterOptions {
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
}

export interface MountedRouter {
  /** The element route content is rendered into. */
  readonly outlet: Element;
  /** Tear down the current route, the shell, link interception and the router. */
  unmount(): void;
}

/** A URL is external when it targets another origin or a non-navigational scheme. */
function isExternalHref(href: string): boolean {
  return (
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href) || // scheme: http:, https:, mailto:, tel:
    href.startsWith('//') // protocol-relative
  );
}

export function mountRouter(router: Router, options: MountRouterOptions): MountedRouter {
  const { container } = options;
  const renderer = options.renderer ?? createRenderer();
  const outletId = options.outletId ?? ROUTER_OUTLET_ID;
  const interceptLinks = options.interceptLinks ?? true;

  // ── 1. Mount the shell once (if any) and resolve the outlet ──────────────────
  let shellMounted: MountedApplication | null = null;
  let outlet: Element;

  if (options.shell !== undefined) {
    const shellApp = streetui.app({ name: 'router-shell' });
    const shellBuilder = options.shell;
    shellApp.page('shell', (page) => shellBuilder(page, router));
    const shellRuntime = createRuntime({ renderer });
    shellMounted = shellRuntime.mount(compile(shellApp), container);

    const found = container.querySelector(`[id="${outletId}"]`);
    if (found === null) {
      throw new Error(
        `[Router] The shell must contain a route outlet. Call routerOutlet(scope) ` +
          `(or add a container with id="${outletId}") inside your shell builder.`,
      );
    }
    outlet = found;
  } else {
    outlet = container;
  }

  // ── 2. Route mounting / disposal ─────────────────────────────────────────────
  interface ActiveRoute {
    readonly registry: CleanupRegistry;
    readonly mounted: MountedApplication;
  }
  let active: ActiveRoute | null = null;

  const disposeActive = (): void => {
    if (active === null) return;
    // Run user-registered cleanup (effects, subscriptions) FIRST, then tear down
    // the DOM + runtime signal bindings. Both reuse existing machinery.
    active.registry.run();
    active.mounted.unmount();
    active = null;
  };

  const renderRoute = (match: RouteMatch): void => {
    disposeActive();

    const registry = new CleanupRegistry();
    const ctx: RouteContext = {
      path: match.path,
      pattern: match.pattern,
      params: match.params,
      query: match.query,
      onCleanup: (fn) => registry.add(fn),
    };

    const routeApp = streetui.app({ name: `route:${match.pattern}` });
    routeApp.page('route', (page) => match.route.builder(page, ctx));
    const runtime = createRuntime({ renderer });
    const mounted = runtime.mount(compile(routeApp), outlet);

    active = { registry, mounted };
  };

  // Initial render, then react to every route change.
  renderRoute(router.currentRoute.peek());
  const stopRouteSub = router.currentRoute.subscribe((match) => renderRoute(match));

  // ── 3. Client-side link interception ─────────────────────────────────────────
  const onClick = (event: Event): void => {
    if (event.defaultPrevented) return;
    const mouse = event as MouseEvent;
    if (typeof mouse.button === 'number' && mouse.button !== 0) return;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;

    const target = event.target as Element | null;
    const anchor = target?.closest?.('a') ?? null;
    if (anchor === null) return;

    const targetAttr = anchor.getAttribute('target');
    if (targetAttr !== null && targetAttr !== '_self') return; // _blank etc.

    const href = anchor.getAttribute('href');
    if (href === null || href === '' || href.startsWith('#')) return;
    if (isExternalHref(href)) return;

    event.preventDefault();
    router.navigate(href);
  };

  if (interceptLinks) {
    container.addEventListener('click', onClick);
  }

  // ── Teardown ─────────────────────────────────────────────────────────────────
  return {
    outlet,
    unmount() {
      if (interceptLinks) container.removeEventListener('click', onClick);
      stopRouteSub();
      disposeActive();
      shellMounted?.unmount();
      router.destroy();
    },
  };
}
