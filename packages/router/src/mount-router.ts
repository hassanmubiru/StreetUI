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
import { resolveTransition, type TransitionConfig } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { createRuntime, type MountedApplication, type StreetRenderer } from '@streetui/runtime';
import { createRenderer, runElementTransition } from '@streetui/renderer';
import { BrowserDOMAdapter, type DOMAdapter } from '@streetui/dom';
import { CleanupRegistry } from '@streetui/core';
import type { Router } from './router.js';
import type { RouteContext, RouteMatch } from './types.js';

/** Default id used for the route outlet element inside a shell. */
export const ROUTER_OUTLET_ID = 'streetui-router-outlet';

/**
 * Stable reconciliation KEY of the outlet container `routerOutlet` emits.
 *
 * Hydration adoption is keyed on node identity, so a server render that fills
 * the outlet inline must emit its container with THIS key (and a matching id)
 * for the client to adopt the server node instead of silently recreating the
 * subtree. Exposed so SSR code references one symbol rather than restating the
 * `'router-outlet'` literal — the outlet contract then has a single source of
 * truth for both the key and (via {@link ROUTER_OUTLET_ID}) the default id.
 */
export const ROUTER_OUTLET_KEY = 'router-outlet';

/**
 * Declare the route outlet inside a shell builder. The router replaces this
 * element's contents on every navigation.
 */
export function routerOutlet(scope: ContainerDSL, id: string = ROUTER_OUTLET_ID): void {
  scope.container(ROUTER_OUTLET_KEY, () => { /* filled by the router at runtime */ }, { id });
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
  /**
   * Hydrate server-rendered HTML already present in the container instead of
   * mounting fresh. The shell and the *initial* route adopt the existing DOM;
   * subsequent client-side navigations mount normally. Defaults to false.
   */
  readonly hydrate?: boolean;
  /**
   * Optional enter/leave transition played on client-side navigations (§9). When
   * set, each navigation mounts the incoming route into its own host wrapper,
   * plays the enter animation on it, and defers the outgoing route's disposal
   * (route-scoped cleanup + DOM removal) until its leave animation ends — so
   * resources stay alive exactly as long as the departing DOM. History is
   * untouched (the router already navigated), and the initial mount/hydration is
   * NOT animated (§22-style: the first paint must match the server). Reuses the
   * single CSS-class transition engine — no second animation system.
   */
  readonly transition?: TransitionConfig;
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
  const hydrateMode = options.hydrate ?? false;

  // ── 1. Mount the shell once (if any) and resolve the outlet ──────────────────
  let shellMounted: MountedApplication | null = null;
  let outlet: Element;

  if (options.shell !== undefined) {
    const shellApp = streetui.app({ name: 'router-shell' });
    const shellBuilder = options.shell;
    shellApp.page('shell', (page) => shellBuilder(page, router));
    const shellRuntime = createRuntime({ renderer });
    const shellCompiled = compile(shellApp);
    if (hydrateMode) {
      // The outlet is a slot the router fills. When the shell hydrates, mark the
      // outlet node as a hydration boundary so shell hydration adopts the outlet
      // element itself but preserves the server-rendered route content inside it
      // (instead of stripping it as surplus). The initial route then hydrates
      // that content node-for-node.
      for (const node of shellCompiled.graph.findAll((n) => n.getProp('id') === outletId)) {
        node.setProp('_hydrationBoundary', true);
      }
    }
    shellMounted = hydrateMode
      ? shellRuntime.hydrate(shellCompiled, container)
      : shellRuntime.mount(shellCompiled, container);

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
  const routeTransition =
    options.transition !== undefined ? resolveTransition(options.transition) : undefined;
  // A DOM adapter for the transition host manipulation. Only constructed when a
  // transition is configured (browser-only feature), so SSR/headless router use
  // never touches a browser global. Manipulates the same `class` attribute the
  // reconciler-driven transitions use, via the same engine.
  const txDom: DOMAdapter | undefined =
    routeTransition !== undefined ? new BrowserDOMAdapter() : undefined;

  interface ActiveRoute {
    readonly registry: CleanupRegistry;
    readonly mounted: MountedApplication;
    /** The host wrapper this route's DOM lives in (transition mode only). */
    host: Element | null;
    /** In-flight enter run, cancelled if this host starts leaving (rapid nav). */
    enterRun: { cancel(): void } | null;
  }
  let active: ActiveRoute | null = null;
  // Routes whose leave animation is still running (transition mode). Kept so a
  // hard `unmount()` can settle + tear them down instead of leaking.
  const pendingLeaves = new Map<ActiveRoute, { cancel(): void }>();
  // Only the very first route render hydrates the server HTML in the outlet;
  // client-side navigations after that mount fresh.
  let firstRender = hydrateMode;

  /** Full synchronous teardown of a route (no transition / on leave-end). */
  const teardownRoute = (route: ActiveRoute): void => {
    // Run user-registered cleanup (effects, subscriptions) FIRST, then tear down
    // the DOM + runtime signal bindings. Both reuse existing machinery.
    route.registry.run();
    route.mounted.unmount();
    if (route.host !== null && txDom !== undefined) {
      const parent = txDom.parentNode(route.host);
      if (parent !== null) txDom.removeChild(parent, route.host);
    }
  };

  const disposeActive = (): void => {
    if (active === null) return;
    teardownRoute(active);
    active = null;
  };

  /**
   * Move whatever is currently in the outlet into a fresh host wrapper (used to
   * isolate a hydrated/initial route so it can be animated out on the first
   * client navigation). Returns the wrapper, now the sole child of the outlet.
   */
  const wrapOutletChildren = (dom: DOMAdapter): Element => {
    const host = dom.createElement('div');
    dom.setAttribute(host, 'data-streetui-route', '');
    const moved: Node[] = [];
    let child = dom.firstChild(outlet);
    while (child !== null) {
      moved.push(child);
      child = dom.nextSibling(child);
    }
    for (const n of moved) dom.appendChild(host, n);
    dom.appendChild(outlet, host);
    return host;
  };

  /** Build + mount (or hydrate) a route into `target`, returning its handle. */
  const buildRoute = (
    match: RouteMatch,
    target: Element,
    hydrate: boolean,
  ): ActiveRoute => {
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
    const routeCompiled = compile(routeApp);
    const mounted = hydrate
      ? runtime.hydrate(routeCompiled, target)
      : runtime.mount(routeCompiled, target);
    return { registry, mounted, host: null, enterRun: null };
  };

  const renderRoute = (match: RouteMatch): void => {
    // Non-transitioned path — unchanged synchronous behaviour.
    if (routeTransition === undefined || txDom === undefined) {
      disposeActive();
      active = buildRoute(match, outlet, firstRender);
      firstRender = false;
      return;
    }

    // Transitioned path. The initial render (mount or hydrate) is NOT animated:
    // it must match the server paint, so we just place it in a host wrapper for
    // later animation and return.
    if (active === null) {
      if (firstRender) {
        // Hydrate the server HTML in place, then isolate it in a host wrapper.
        active = buildRoute(match, outlet, true);
        active.host = wrapOutletChildren(txDom);
      } else {
        const host = txDom.createElement('div');
        txDom.setAttribute(host, 'data-streetui-route', '');
        txDom.appendChild(outlet, host);
        active = buildRoute(match, host, false);
        active.host = host;
      }
      firstRender = false;
      return;
    }

    // Client-side navigation with a route already mounted: cross-fade.
    firstRender = false;
    const leaving = active;
    // Abort any in-flight enter on the departing host so we never run two
    // overlapping animations on one element (§6 discipline).
    leaving.enterRun?.cancel();
    leaving.enterRun = null;
    const leaveHost = leaving.host;

    // Mount the incoming route into a fresh host and animate it in.
    const enterHost = txDom.createElement('div');
    txDom.setAttribute(enterHost, 'data-streetui-route', '');
    txDom.appendChild(outlet, enterHost);
    const next = buildRoute(match, enterHost, false);
    next.host = enterHost;
    next.enterRun = runElementTransition(txDom, enterHost, routeTransition, 'enter', () => {
      next.enterRun = null;
    });
    active = next;

    // Animate the departing host out, then tear the old route down. Resources
    // (route-scoped cleanup + signal bindings) live until the leave completes.
    if (leaveHost !== null) {
      const run = runElementTransition(txDom, leaveHost, routeTransition, 'leave', () => {
        pendingLeaves.delete(leaving);
        teardownRoute(leaving);
      });
      pendingLeaves.set(leaving, run);
    } else {
      teardownRoute(leaving);
    }
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
      // Settle any in-flight leave animations and tear their routes down.
      for (const [route, run] of pendingLeaves) {
        run.cancel();
        teardownRoute(route);
      }
      pendingLeaves.clear();
      disposeActive();
      shellMounted?.unmount();
      router.destroy();
    },
  };
}
