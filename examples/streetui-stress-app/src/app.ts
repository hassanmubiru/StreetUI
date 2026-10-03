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
  contentCol, topbar, topbarTitle, topbarActions, page as pageClass,
  pageHeader, pageTitleBlock, pageTitle, pageSubtitle,
  card, cardHeader, cardTitle,
  metricGrid, metricTile, metricLabel, metricValue, metricDelta,
  badge, button, iconButton,
  tableWrap, tableHeadRow, tableRow, cellNum, cellMeta, cellText,
  toolbar, toolbarGroup, segmentGroup, segment,
  inputCompact, skipLink,
} from './design-system.js';
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

function statusIntent(s: Order['status']): 'success' | 'warning' | 'danger' {
  return s === 'paid' ? 'success' : s === 'pending' ? 'warning' : 'danger';
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
        n.link('Orders', { href: '/orders', id: 'nav-orders', class: railLink });
        n.link('Customers', { href: '/customers', id: 'nav-customers', class: railLink });
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

function overviewRoute(page: PageDSL, _ctx: RouteContext, state: AppState) {
  const { orders, filter, search } = state;
  const visible = derived(() => {
    const f = filter.get();
    const q = search.get().toLowerCase();
    return orders.get().filter(o =>
      (f === 'all' || o.status === f) &&
      (q === '' || o.customer.toLowerCase().includes(q) || o.id.includes(q)));
  });
  const revenue = derived(() => orders.get().reduce((s, o) => s + (o.status === 'paid' ? o.amount : 0), 0));
  const pending = derived(() => orders.get().filter(o => o.status === 'pending').length);
  const refunded = derived(() => orders.get().reduce((s, o) => s + (o.status === 'refunded' ? o.amount : 0), 0));

  page.head({ title: 'Overview — Ledger', description: 'Commerce operations overview' });
  page.container('overview', (p) => {
    p.container('page-header', (h) => {
      h.container('title-block', (tb) => {
        tb.heading('Overview', { level: 2, id: 'page-title', class: pageTitle });
        tb.text('Your commerce at a glance', { id: 'page-subtitle', class: pageSubtitle });
      }, { id: 'title-block', class: pageTitleBlock });
      h.button('Export', { id: 'export-btn', class: button({ intent: 'quiet', size: 'sm' }) });
    }, { id: 'page-header', class: pageHeader });

    p.container('metrics', (m) => {
      const tile = (key: string, label: string, val: () => string, delta: string, trend: 'up' | 'down' | 'flat') => {
        m.container(key, (t) => {
          t.text(label, { id: `${key}-label`, class: metricLabel });
          t.text(derived(val), { id: `${key}-value`, class: metricValue });
          t.text(delta, { id: `${key}-delta`, class: metricDelta({ trend }) });
        }, { id: key, class: metricTile });
      };
      tile('revenue-tile', 'Total revenue', () => `$${revenue.get().toFixed(2)}`, '↑ vs last month', 'up');
      tile('orders-tile', 'Total orders', () => String(orders.get().length), 'Stable', 'flat');
      tile('pending-tile', 'Pending', () => String(pending.get()), '↑ needs attention', 'down');
      tile('refunded-tile', 'Refunded', () => `$${refunded.get().toFixed(2)}`, '↓ vs last month', 'up');
    }, { id: 'metrics', class: metricGrid });

    p.container('recent-card', (c) => {
      c.container('card-header', (h) => {
        h.heading('Recent orders', { level: 3, id: 'recent-title', class: cardTitle });
        h.link('View all →', { href: '/orders', id: 'view-all', class: cellMeta });
      }, { id: 'recent-header', class: cardHeader });
      c.container('table-wrap', (tw) => {
        tw.container('head-row', () => {}, { id: 'recent-head', class: tableHeadRow });
        tw.listOf('recent-rows', derived(() => visible.get().slice(0, 10)), (order, _i, row) => {
          row.text(order.id, { id: `r-id-${order.id}`, class: cellMeta });
          row.text(order.customer, { id: `r-name-${order.id}`, class: cellText });
          row.text(badge({ intent: statusIntent(order.status) }), { id: `r-st-${order.id}` });
          row.text(`$${order.amount.toFixed(2)}`, { id: `r-amt-${order.id}`, class: cellNum });
        }, { id: 'recent-rows', class: tableRow });
      }, { id: 'recent-wrap', class: tableWrap });
    }, { id: 'recent-card', class: card });
  }, { id: 'overview', class: pageClass });
}

function ordersRoute(page: PageDSL, _ctx: RouteContext, state: AppState) {
  const { orders, filter, search } = state;
  const visible = derived(() => {
    const f = filter.get();
    const q = search.get().toLowerCase();
    return orders.get().filter(o =>
      (f === 'all' || o.status === f) &&
      (q === '' || o.customer.toLowerCase().includes(q) || o.id.includes(q)));
  });

  page.head({ title: 'Orders — Ledger', description: 'All orders' });
  page.container('orders-page', (p) => {
    p.container('page-header', (h) => {
      h.container('title-block', (tb) => {
        tb.heading('Orders', { level: 2, id: 'orders-title', class: pageTitle });
        tb.text(derived(() => `${visible.get().length} of ${orders.get().length}`), { id: 'orders-count', class: pageSubtitle });
      }, { id: 'orders-title-block', class: pageTitleBlock });
      h.button('New order', { id: 'new-order-btn', class: button({ intent: 'primary', size: 'sm' }) });
    }, { id: 'orders-header', class: pageHeader });

    p.container('toolbar', (tb) => {
      tb.container('filters', (f) => {
        f.input({ id: 'search', type: 'search', bind: search, class: inputCompact, placeholder: 'Search orders…' } as never);
        f.container('segments', (sg) => {
          (['all', 'paid', 'pending', 'refunded'] as const).forEach((s) => {
            sg.button(s.charAt(0).toUpperCase() + s.slice(1), {
              id: `seg-${s}`,
              class: segment,
              onClick: () => filter.set(s),
            });
          });
        }, { id: 'seg-group', class: segmentGroup });
      }, { id: 'toolbar-filters', class: toolbarGroup });
    }, { id: 'orders-toolbar', class: toolbar });

    p.container('orders-table-wrap', (tw) => {
      tw.listOf('orders-rows', visible, (order, _i, row) => {
        row.text(order.id, { id: `o-id-${order.id}`, class: cellMeta });
        row.text(order.customer, { id: `o-name-${order.id}`, class: cellText });
        row.text(badge({ intent: statusIntent(order.status) }), { id: `o-st-${order.id}` });
        row.text(`$${order.amount.toFixed(2)}`, { id: `o-amt-${order.id}`, class: cellNum });
        row.button('⋯', { id: `o-act-${order.id}`, class: iconButton });
      }, { id: 'orders-list', class: tableRow });
    }, { id: 'orders-table-wrap', class: tableWrap });
  }, { id: 'orders-page', class: pageClass });
}

function placeholderRoute(name: string) {
  return (page: PageDSL) => {
    page.head({ title: `${name} — Ledger` });
    page.container(name.toLowerCase(), (p) => {
      p.heading(name, { level: 2, id: `${name.toLowerCase()}-title`, class: pageTitle });
      p.text('Coming soon.', { id: `${name.toLowerCase()}-placeholder`, class: pageSubtitle });
    }, { id: `${name.toLowerCase()}-page`, class: pageClass });
  };
}

function buildRoutes(state: AppState) {
  return [
    { path: '/',          builder: (p: PageDSL, c: RouteContext) => overviewRoute(p, c, state) },
    { path: '/orders',    builder: (p: PageDSL, c: RouteContext) => ordersRoute(p, c, state) },
    { path: '/customers', builder: placeholderRoute('Customers') },
    { path: '/settings',  builder: placeholderRoute('Settings') },
    { path: '*',          builder: placeholderRoute('Not found') },
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
