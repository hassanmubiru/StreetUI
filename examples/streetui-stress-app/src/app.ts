/**
 * StreetUI Stress App — application assembly.
 *
 * A dense ledger/commerce operations console that exercises the 2.7 styling
 * system with a visual language materially different from the documentation
 * website (deep-teal accent, slate surfaces, compact spacing, tabular figures).
 *
 * The shell/outlet contract matches the website's proven SSR↔hydration recipe:
 * the server fills `#page-outlet` inline keyed on ROUTER_OUTLET_KEY; the client
 * router mounts/hydrates the same element id. There is one source of truth for
 * the outlet identity, so byte-identity is preserved and hydration adopts
 * node-for-node instead of re-rendering.
 */
import {
  signal,
  derived,
  createRouter,
  mountRouter,
  routerOutlet,
  ROUTER_OUTLET_KEY,
  createMemoryHistory,
  renderToString,
  renderStyles,
  renderHead,
  serializeState,
  styleRegistry,
  adoptServerStyles,
  BrowserDOMAdapter,
  createTheme,
  streetui,
  compile,
  type PageDSL,
  type ContainerDSL,
  type Router,
  type RouterHistory,
  type RouteContext,
  type ThemeController,
  type Signal,
} from 'streetui';

import {
  appShell, rail, railBrand, railTagline, railNav, railLink, railDivider,
  contentCol, topbar, topbarTitle, topbarActions, button, skipLink,
} from './design-system.js';
import {
  overviewRoute, productsRoute, ordersRoute, customersRoute, analyticsRoute,
  settingsRoute, notFoundRoute,
} from './routes.js';
// Importing the design system registers every Ledger token into the shared
// styleRegistry at module load, so the serialized stylesheet is complete and
// byte-identical for every route (SSR determinism §15/§16).

export const STATE_KEY = 'streetui-stress-app';

/** The single outlet element id — the SSR fill and client mount must agree. */
export const OUTLET_ID = 'page-outlet';

const CSS_MARKER = 'data-streetui-css';

// ── Data model ────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  customer: string;
  amount: number;
  status: 'paid' | 'pending' | 'refunded';
}

function makeOrders(n: number): Order[] {
  const statuses: Order['status'][] = ['paid', 'pending', 'refunded'];
  return Array.from({ length: n }, (_, i) => ({
    id: `ORD-${String(i + 1000).padStart(5, '0')}`,
    customer: `Customer ${i + 1}`,
    amount: 49.99 + i * 13.37,
    status: statuses[i % 3]!,
  }));
}

/** Per-app reactive state. Created fresh in createApp so instances are isolated. */
export interface AppState {
  orders: Signal<Order[]>;
  filter: Signal<'all' | 'paid' | 'pending' | 'refunded'>;
  search: Signal<string>;
}

function createState(): AppState {
  return {
    orders: signal(makeOrders(200)),
    filter: signal<'all' | 'paid' | 'pending' | 'refunded'>('all'),
    search: signal(''),
  };
}

// ── Shell ─────────────────────────────────────────────────────────────────────

interface ShellDeps {
  theme: ThemeController;
  /** SSR only: fills the outlet container with the active route. */
  renderOutlet?: (content: ContainerDSL) => void;
}

function shellBuilder(page: PageDSL, deps: ShellDeps) {
  page.container('shell', (shell) => {
    shell.link('Skip to content', { href: `#${OUTLET_ID}`, id: 'skip-link', class: skipLink });

    // Navigation rail
    shell.container('rail', (r) => {
      r.heading('Ledger', { level: 1, id: 'brand', class: railBrand });
      r.text('Commerce ops', { id: 'tagline', class: railTagline });
      r.container('nav', (n) => {
        n.link('Overview', { href: '/', id: 'nav-overview', class: railLink });
        n.link('Products', { href: '/products', id: 'nav-products', class: railLink });
        n.link('Orders', { href: '/orders', id: 'nav-orders', class: railLink });
        n.link('Customers', { href: '/customers', id: 'nav-customers', class: railLink });
        n.link('Analytics', { href: '/analytics', id: 'nav-analytics', class: railLink });
        n.container('divider', () => {}, { id: 'rail-divider', class: railDivider });
        n.link('Settings', { href: '/settings', id: 'nav-settings', class: railLink });
      }, { id: 'rail-nav', class: railNav });
    }, { id: 'rail', class: rail });

    // Content column
    shell.container('content', (col) => {
      col.container('topbar', (tb) => {
        tb.text('Ledger', { id: 'topbar-title', class: topbarTitle });
        tb.container('actions', (a) => {
          a.button(derived(() => deps.theme.label.get()), {
            id: 'theme-toggle',
            class: button({ intent: 'quiet', size: 'sm' }),
            onClick: () => deps.theme.cycle(),
          });
        }, { id: 'topbar-actions', class: topbarActions });
      }, { id: 'topbar', class: topbar });

      // Router outlet. On the server we fill it inline keyed on ROUTER_OUTLET_KEY
      // and the shared OUTLET_ID; on the client the router populates it. One
      // source of truth for both key and id → hydration adopts node-for-node.
      if (deps.renderOutlet !== undefined) {
        const fill = deps.renderOutlet;
        col.container(ROUTER_OUTLET_KEY, (c) => fill(c), { id: OUTLET_ID });
      } else {
        routerOutlet(col, OUTLET_ID);
      }
    }, { id: 'content', class: contentCol });
  }, { id: 'app-shell', class: appShell });
}

// ── Routes ────────────────────────────────────────────────────────────────────

function buildRoutes(state: AppState) {
  return [
    { path: '/',          builder: (p: PageDSL, c: RouteContext) => overviewRoute(p, c, state) },
    { path: '/products',  builder: (p: PageDSL, c: RouteContext) => productsRoute(p, c, state) },
    { path: '/orders',    builder: (p: PageDSL, c: RouteContext) => ordersRoute(p, c, state) },
    { path: '/customers', builder: (p: PageDSL, c: RouteContext) => customersRoute(p, c, state) },
    { path: '/analytics', builder: (p: PageDSL, c: RouteContext) => analyticsRoute(p, c, state) },
    { path: '/settings',  builder: (p: PageDSL, c: RouteContext) => settingsRoute(p, c, state) },
    { path: '*',          builder: notFoundRoute },
  ];
}


// ── App object ────────────────────────────────────────────────────────────────

export interface StressAppOptions {
  /** Navigation source. Defaults to browser history; pass memory for SSR/tests. */
  readonly history?: RouterHistory;
  /** Adopt server-rendered markup instead of mounting fresh. */
  readonly hydrate?: boolean;
  /** Theme persistence seam (defaults to guarded localStorage). */
  readonly themeStorage?: import('streetui').ThemeStorage;
}

export interface StressApp {
  readonly router: Router;
  readonly theme: ThemeController;
  readonly state: AppState;
}

export interface MountedStressApp extends StressApp {
  unmount(): void;
}

export function createApp(options: StressAppOptions = {}): StressApp {
  const state = createState();
  const theme = createTheme(
    options.themeStorage !== undefined ? { storage: options.themeStorage } : {},
  );
  const router = createRouter(
    options.history !== undefined
      ? { routes: buildRoutes(state), history: options.history }
      : { routes: buildRoutes(state) },
  );
  return { router, theme, state };
}

// ── Client stylesheet install (app responsibility, §1 boundary) ──────────────
//
// Hydration: the server already emitted the sheet; adopt its identities into
// the registry. Fresh mount: serialize the registry once and inject a single
// <style> block, guarded to run at most once per document (idempotent).
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

export function mountApp(container: Element, options: StressAppOptions = {}): MountedStressApp {
  const app = createApp(options);
  const hydrate = options.hydrate ?? false;
  installClientStyles(container, hydrate);
  const mounted = mountRouter(app.router, {
    container,
    outletId: OUTLET_ID,
    hydrate,
    shell: (shell) => shellBuilder(shell, { theme: app.theme }),
  });
  return {
    ...app,
    unmount: () => {
      mounted.unmount();
      app.theme.dispose();
    },
  };
}

// ── SSR ───────────────────────────────────────────────────────────────────────

export interface RenderResult {
  readonly html: string;
  readonly head: string;
  readonly stateScript: string;
  readonly styles: string;
}

/**
 * Render the app at `path` to HTML. The persistent shell carries the active
 * route already inside `#page-outlet`, exactly where the client hydrates it —
 * composed as ONE compiled app through the normal renderToString pipeline.
 */
export function renderApp(path = '/'): RenderResult {
  const state = createState();
  // SSR: no DOM → theme attaches to nothing; data-theme lives on <html>,
  // outside the hydrated container, so it is never a hydration mismatch.
  const theme = createTheme({ storage: { read: () => null, write: () => {} } });

  const router = createRouter({ routes: buildRoutes(state), history: createMemoryHistory(path) });
  const match = router.currentRoute.get();
  const ctx: RouteContext = {
    path: match.path,
    pattern: match.pattern,
    params: match.params,
    query: match.query,
    onCleanup: () => { /* SSR: render lifecycle only */ },
  };

  const app = streetui.app({ name: 'ledger', version: '2.8.0' });
  app.page('main', (page) => {
    shellBuilder(page, {
      theme,
      renderOutlet: (content) => {
        match.route.builder(content as unknown as PageDSL, ctx);
      },
    });
  });

  const compiled = compile(app);
  const html = renderToString(compiled);
  const head = renderHead(compiled);
  const themeChoice = theme.choice.get();
  theme.dispose();
  router.destroy();

  const stateScript = serializeState({ [STATE_KEY]: { path, themeChoice } });
  const styles = renderStyles({ registry: styleRegistry });
  return { html, head, stateScript, styles };
}
