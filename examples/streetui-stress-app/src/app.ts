/**
 * StreetUI Stress App — main application entry.
 *
 * A dense ledger/commerce dashboard that exercises the full 2.7 styling system
 * with a materially different visual language from the documentation website.
 */
import {
  signal,
  derived,
  streetui,
  compile,
  createRuntime,
  createRenderer,
  BrowserDOMAdapter,
  createRouter,
  mountRouter,
  routerOutlet,
  createMemoryHistory,
  renderToString,
  renderStyles,
  renderHead,
  styleRegistry,
  createTheme,
  type PageDSL,
} from 'streetui';

import {
  ledger,
  appShell, rail, railBrand, railTagline, railNav, railLink, railDivider,
  contentCol, topbar, topbarTitle, topbarActions, page as pageClass,
  pageHeader, pageTitleBlock, pageTitle, pageSubtitle,
  card, cardHeader, cardTitle, cardHint,
  metricGrid, metricTile, metricLabel, metricValue, metricDelta,
  badge, button, iconButton,
  tableWrap, tableHeadRow, tableRow, cellNum, cellMeta, cellText,
  tabList, tab,
  toolbar, toolbarGroup, segmentGroup, segment,
  input, inputCompact,
  splitGrid,
} from './design-system.js';

// ── Reactive data ─────────────────────────────────────────────────────────────

interface Order {
  id: string; customer: string; amount: number; status: 'paid' | 'pending' | 'refunded';
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

const allOrders = makeOrders(200);
const orders = signal(allOrders);
const filter = signal<'all' | 'paid' | 'pending' | 'refunded'>('all');
const searchQ = signal('');
const visibleOrders = derived(() => {
  const f = filter.get();
  const q = searchQ.get().toLowerCase();
  return orders.get().filter(o =>
    (f === 'all' || o.status === f) &&
    (q === '' || o.customer.toLowerCase().includes(q) || o.id.includes(q))
  );
});

const revenue = derived(() => orders.get().reduce((s, o) => s + (o.status === 'paid' ? o.amount : 0), 0));
const pending = derived(() => orders.get().filter(o => o.status === 'pending').length);
const refunded = derived(() => orders.get().reduce((s, o) => s + (o.status === 'refunded' ? o.amount : 0), 0));

// ── Theme ─────────────────────────────────────────────────────────────────────

const theme = createTheme({ initial: 'system' });

// ── Shell builder ──────────────────────────────────────────────────────────────

function shellBuilder(page: PageDSL, ctx: { renderOutlet?: () => void }) {
  page.container('shell', (shell) => {
    // Nav rail
    shell.container('rail', (r) => {
      r.heading('Ledger', { level: 1, id: 'brand', class: railBrand });
      r.text('Commerce dashboard', { id: 'tagline', class: railTagline });
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
      // Top bar
      col.container('topbar', (tb) => {
        tb.text('Ledger', { id: 'topbar-title', class: topbarTitle });
        tb.container('actions', (a) => {
          a.button(derived(() => theme.label.get()), {
            id: 'theme-toggle',
            class: button({ intent: 'quiet', size: 'sm' }),
            onClick: () => theme.cycle(),
          });
        }, { id: 'topbar-actions', class: topbarActions });
      }, { id: 'topbar', class: topbar });

      // Router outlet
      if (ctx.renderOutlet) {
        ctx.renderOutlet();
      } else {
        routerOutlet(col);
      }
    }, { id: 'content', class: contentCol });
  }, { id: 'app-shell', class: appShell });
}

// ── Routes ────────────────────────────────────────────────────────────────────

function overviewRoute(page: PageDSL) {
  page.head({ title: 'Overview — Ledger', description: 'Dashboard overview' });
  page.container('overview', (p) => {
    p.container('page-header', (h) => {
      h.container('title-block', (tb) => {
        tb.heading('Overview', { level: 2, id: 'page-title', class: pageTitle });
        tb.text('Your commerce at a glance', { id: 'page-subtitle', class: pageSubtitle });
      }, { id: 'title-block', class: pageTitleBlock });
      p.button('Export', { id: 'export-btn', class: button({ intent: 'quiet', size: 'sm' }) });
    }, { id: 'page-header', class: pageHeader });

    // Metric tiles
    p.container('metrics', (m) => {
      m.container('revenue-tile', (t) => {
        t.text('Total revenue', { id: 'revenue-label', class: metricLabel });
        t.text(derived(() => `$${revenue.get().toFixed(2)}`), { id: 'revenue-value', class: metricValue });
        t.text('↑ vs last month', { id: 'revenue-delta', class: metricDelta({ trend: 'up' }) });
      }, { id: 'revenue-tile', class: metricTile });
      m.container('orders-tile', (t) => {
        t.text('Total orders', { id: 'orders-label', class: metricLabel });
        t.text(derived(() => String(orders.get().length)), { id: 'orders-value', class: metricValue });
        t.text('Stable', { id: 'orders-delta', class: metricDelta({ trend: 'flat' }) });
      }, { id: 'orders-tile', class: metricTile });
      m.container('pending-tile', (t) => {
        t.text('Pending', { id: 'pending-label', class: metricLabel });
        t.text(derived(() => String(pending.get())), { id: 'pending-value', class: metricValue });
        t.text('↑ needs attention', { id: 'pending-delta', class: metricDelta({ trend: 'down' }) });
      }, { id: 'pending-tile', class: metricTile });
      m.container('refunded-tile', (t) => {
        t.text('Refunded', { id: 'refunded-label', class: metricLabel });
        t.text(derived(() => `$${refunded.get().toFixed(2)}`), { id: 'refunded-value', class: metricValue });
        t.text('↓ vs last month', { id: 'refunded-delta', class: metricDelta({ trend: 'up' }) });
      }, { id: 'refunded-tile', class: metricTile });
    }, { id: 'metrics', class: metricGrid });

    // Recent orders preview (first 10)
    p.container('recent-card', (c) => {
      c.container('card-header', (h) => {
        h.heading('Recent orders', { level: 3, id: 'recent-title', class: cardTitle });
        h.link('View all →', { href: '/orders', id: 'view-all', class: '' });
      }, { id: 'recent-header', class: cardHeader });
      c.container('table-wrap', (tw) => {
        tw.container('head-row', () => {}, { id: 'table-head', class: tableHeadRow });
        c.listOf('recent-rows', derived(() => visibleOrders.get().slice(0, 10)), (order, _i, row) => {
          row.text(order.id, { id: `row-id-${order.id}`, class: cellMeta });
          row.text(order.customer, { id: `row-name-${order.id}`, class: cellText });
          row.text(badge({ intent: order.status === 'paid' ? 'success' : order.status === 'pending' ? 'warning' : 'danger' }), { id: `row-status-${order.id}` });
          row.text(`$${order.amount.toFixed(2)}`, { id: `row-amt-${order.id}`, class: cellNum });
        }, { id: 'recent-rows', class: tableRow });
      }, { id: 'table-wrap', class: tableWrap });
    }, { id: 'recent-card', class: card });
  }, { id: 'overview', class: pageClass });
}

function ordersRoute(page: PageDSL) {
  page.head({ title: 'Orders — Ledger', description: 'All orders' });
  page.container('orders-page', (p) => {
    p.container('page-header', (h) => {
      h.container('title-block', (tb) => {
        tb.heading('Orders', { level: 2, id: 'orders-title', class: pageTitle });
        tb.text(derived(() => `${visibleOrders.get().length} of ${orders.get().length}`), { id: 'orders-count', class: pageSubtitle });
      }, { id: 'orders-title-block', class: pageTitleBlock });
      h.button('New order', { id: 'new-order-btn', class: button({ intent: 'primary', size: 'sm' }) });
    }, { id: 'orders-header', class: pageHeader });

    // Toolbar
    p.container('toolbar', (tb) => {
      tb.container('filters', (f) => {
        f.input({ id: 'search', type: 'search', bind: searchQ, class: inputCompact, placeholder: 'Search orders…' } as never);
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

    // Full table
    p.container('orders-table-wrap', (tw) => {
      tw.listOf('orders-rows', visibleOrders, (order, _i, row) => {
        row.text(order.id, { id: `ord-id-${order.id}`, class: cellMeta });
        row.text(order.customer, { id: `ord-name-${order.id}`, class: cellText });
        row.text(badge({ intent: order.status === 'paid' ? 'success' : order.status === 'pending' ? 'warning' : 'danger' }), { id: `ord-status-${order.id}` });
        row.text(`$${order.amount.toFixed(2)}`, { id: `ord-amt-${order.id}`, class: cellNum });
        row.button('⋯', { id: `ord-action-${order.id}`, class: iconButton });
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

// ── App ───────────────────────────────────────────────────────────────────────

export function createApp() {
  const router = createRouter({
    routes: [
      { path: '/',           builder: overviewRoute },
      { path: '/orders',     builder: ordersRoute },
      { path: '/customers',  builder: placeholderRoute('Customers') },
      { path: '/settings',   builder: placeholderRoute('Settings') },
      { path: '*',           builder: placeholderRoute('Not found') },
    ],
    history: createMemoryHistory('/'),
  });
  return { router, theme };
}

// ── Client mount ──────────────────────────────────────────────────────────────

export function mountApp(container: Element) {
  const { router, theme } = createApp();
  theme.mount(container as HTMLElement);
  mountRouter(router, {
    container,
    shell: (page) => shellBuilder(page, {}),
  });
}

// ── SSR ───────────────────────────────────────────────────────────────────────

export function renderApp(path = '/') {
  const app = streetui.app({ name: 'ledger' });
  const hist = createMemoryHistory(path);
  const router = createRouter({
    routes: [
      { path: '/',          builder: overviewRoute },
      { path: '/orders',    builder: ordersRoute },
      { path: '/customers', builder: placeholderRoute('Customers') },
      { path: '/settings',  builder: placeholderRoute('Settings') },
      { path: '*',          builder: placeholderRoute('Not found') },
    ],
    history: hist,
  });

  const currentRoute = router.currentRoute;
  const routeBuilder = currentRoute.get().builder;

  app.page('main', (page) => shellBuilder(page, {
    renderOutlet: () => routeBuilder(page),
  }));

  const compiled = compile(app);
  const html = renderToString(compiled);
  const styles = renderStyles({ registry: styleRegistry });
  const head = renderHead(compiled);
  router.destroy();
  return { html, styles, head };
}
