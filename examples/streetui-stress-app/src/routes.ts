/**
 * StreetUI Stress App — routes.
 *
 * Six routes exercising the full feature surface of the 2.7 styling model in a
 * dense operational-ledger language: reactive tables, filters, pagination,
 * tabs, selection, a resource-driven loading/error surface, a form with
 * validation, an overlay dialog, a dropdown, a toast, and theme switching.
 *
 * All state is passed in via AppState so each createApp() instance is isolated;
 * nothing here is module-global.
 */
import {
  signal,
  derived,
  resource,
  mutation,
  type PageDSL,
  type RouteContext,
} from 'streetui';

import {
  style,
  animation,
  dialogPanel, backdrop, dropdownMenu, dropdownItem, tooltipBubble, toastSurface,
  countChip, fieldHelp, skeleton, visuallyHidden,
} from './design-system.js';

import type { AppState, Order } from './app.js';
import {
  page as pageClass, pageHeader, pageTitleBlock, pageTitle, pageSubtitle,
  card, cardHeader, cardTitle,
  metricGrid, metricTile, metricLabel, metricValue, metricDelta,
  splitGrid, mainAside,
  badge, button, iconButton,
  tableWrap, tableHeadRow, tableRow, cellNum, cellMeta, cellText,
  tabList, tab,
  pagination, pageButtons, pageButton,
  toolbar, toolbarGroup, segmentGroup, segment,
  field, fieldLabel, input, inputCompact, fieldError, formGrid,
  alert, stateRegion, spinner, stateTitle, stateHint,
  metaText, dataText, inlineLink, sectionHeading,
} from './design-system.js';

/** Register fade keyframes (idempotent) and derive enter/leave class tokens.

 * The transition engine reads `enterFrom`/`enterActive`/`enterTo` (etc.) class
 * names and toggles them on the host element; because these are `s-<hash>` strings
 * produced by `style()`, they dedup into the single shared stylesheet and never
 * collide with hand-written consumer CSS. */
const fadeIn = animation.animate('streetui-fade-in', { duration: 'base' });
const fadeOut = animation.animate('streetui-fade-out', { duration: 'base' });
const fadeFrom = style({ opacity: 0 });
const fadeTo = style({ opacity: 1 });

/** Shared leave transition for overlay/content branch swaps (explicit classes). */
const fade = {
  enterFrom: fadeFrom,
  enterTo: fadeTo,
  leaveFrom: fadeTo,
  leaveActive: fadeIn,
  leaveTo: fadeFrom,
  duration: 15,
} as const;

const PAGE_SIZE = 20;

function statusIntent(s: Order['status']): 'success' | 'warning' | 'danger' {
  return s === 'paid' ? 'success' : s === 'pending' ? 'warning' : 'danger';
}

function pageHead(c: PageDSL, title: string, desc: string) {
  c.head({ title: `${title} — Ledger`, description: desc });
}

function headerBlock(p: PageDSL | import('streetui').ContainerDSL, key: string, title: string, subtitle: string | import('streetui').BindableText) {
  p.container('page-header', (h) => {
    h.container('title-block', (tb) => {
      tb.heading(title, { level: 2, id: `${key}-title`, class: pageTitle });
      tb.text(subtitle, { id: `${key}-subtitle`, class: pageSubtitle });
    }, { id: `${key}-title-block`, class: pageTitleBlock });
  }, { id: `${key}-header`, class: pageHeader });
}

// ── Overview ──────────────────────────────────────────────────────────────────

export function overviewRoute(page: PageDSL, _ctx: RouteContext, state: AppState) {
  const { orders } = state;
  const revenue = derived(() => orders.get().reduce((s, o) => s + (o.status === 'paid' ? o.amount : 0), 0));
  const pending = derived(() => orders.get().filter(o => o.status === 'pending').length);
  const refunded = derived(() => orders.get().reduce((s, o) => s + (o.status === 'refunded' ? o.amount : 0), 0));

  pageHead(page, 'Overview', 'Commerce operations overview');
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
        h.link('View all →', { href: '/orders', id: 'view-all', class: inlineLink });
      }, { id: 'recent-header', class: cardHeader });
      c.container('table-wrap', (tw) => {
        tw.listOf('recent-rows', derived(() => orders.get().slice(0, 8)), (order, _i, row) => {
          row.text(order.id, { id: `r-id-${order.id}`, class: cellMeta });
          row.text(order.customer, { id: `r-name-${order.id}`, class: cellText });
          row.text(order.status, { id: `r-st-${order.id}`, class: badge({ intent: statusIntent(order.status) }) });
          row.text(`$${order.amount.toFixed(2)}`, { id: `r-amt-${order.id}`, class: cellNum });
        }, { id: 'recent-rows', class: tableRow });
      }, { id: 'recent-wrap', class: tableWrap });
    }, { id: 'recent-card', class: card });
  }, { id: 'overview', class: pageClass });
}

// ── Orders ────────────────────────────────────────────────────────────────────

export function ordersRoute(page: PageDSL, _ctx: RouteContext, state: AppState) {
  const { orders, filter, search } = state;
  const pageNum = signal(1);
  const visible = derived(() => {
    const f = filter.get();
    const q = search.get().toLowerCase();
    return orders.get().filter(o =>
      (f === 'all' || o.status === f) &&
      (q === '' || o.customer.toLowerCase().includes(q) || o.id.includes(q)));
  });
  const pageCount = derived(() => Math.max(1, Math.ceil(visible.get().length / PAGE_SIZE)));
  const pageRows = derived(() => {
    const p = Math.min(pageNum.get(), pageCount.get());
    return visible.get().slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  });

  pageHead(page, 'Orders', 'All orders');
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
        f.input({ id: 'search', type: 'search', bind: search, class: inputCompact, placeholder: 'Search orders…', ariaLabel: 'Search orders' });
        f.container('segments', (sg) => {
          (['all', 'paid', 'pending', 'refunded'] as const).forEach((s) => {
            sg.button(s.charAt(0).toUpperCase() + s.slice(1), {
              id: `seg-${s}`,
              class: segment,
              ariaCurrent: derived(() => filter.get() === s) as never,
              onClick: () => { filter.set(s); pageNum.set(1); },
            });
          });
        }, { id: 'seg-group', class: segmentGroup, role: 'group', ariaLabel: 'Filter by status' });
      }, { id: 'toolbar-filters', class: toolbarGroup });
    }, { id: 'orders-toolbar', class: toolbar });

    p.container('orders-table-wrap', (tw) => {
      tw.when(derived(() => visible.get().length === 0), (empty) => {
        empty.container('empty', (e) => {
          e.heading('No orders match', { level: 3, id: 'empty-title', class: stateTitle });
          e.text('Try a different search or filter.', { id: 'empty-hint', class: stateHint });
        }, { id: 'orders-empty', class: stateRegion });
      }, (full) => {
        full.listOf('orders-rows', pageRows, (order, _i, row) => {
          row.text(order.id, { id: `o-id-${order.id}`, class: cellMeta });
          row.text(order.customer, { id: `o-name-${order.id}`, class: cellText });
          row.text(order.status, { id: `o-st-${order.id}`, class: badge({ intent: statusIntent(order.status) }) });
          row.text(`$${order.amount.toFixed(2)}`, { id: `o-amt-${order.id}`, class: cellNum });
          row.button('⋯', { id: `o-act-${order.id}`, class: iconButton, ariaLabel: `Actions for ${order.id}` });
        }, { id: 'orders-list', class: tableRow });
      });

      tw.container('pager', (pg) => {
        pg.text(derived(() => `Page ${Math.min(pageNum.get(), pageCount.get())} of ${pageCount.get()}`), { id: 'pager-info', class: metaText });
        pg.container('pager-buttons', (pb) => {
          pb.button('‹ Prev', { id: 'pager-prev', class: pageButton, disabled: derived(() => pageNum.get() <= 1), onClick: () => pageNum.set(Math.max(1, pageNum.get() - 1)) });
          pb.button('Next ›', { id: 'pager-next', class: pageButton, disabled: derived(() => pageNum.get() >= pageCount.get()), onClick: () => pageNum.set(pageNum.get() + 1) });
        }, { id: 'pager-buttons', class: pageButtons });
      }, { id: 'orders-pager', class: pagination });
    }, { id: 'orders-table-wrap', class: tableWrap });
  }, { id: 'orders-page', class: pageClass });
}

// ── Products ──────────────────────────────────────────────────────────────────

interface Product { sku: string; name: string; price: number; stock: number; }

function makeProducts(): Product[] {
  return Array.from({ length: 24 }, (_, i) => ({
    sku: `SKU-${String(i + 100).padStart(4, '0')}`,
    name: `Product ${i + 1}`,
    price: 9.99 + i * 7.5,
    stock: (i * 37) % 120,
  }));
}

export function productsRoute(page: PageDSL, _ctx: RouteContext, state: AppState) {
  const products = signal(makeProducts());
  const selected = signal<string | null>(null);
  const lowStockOnly = signal(false);
  const visible = derived(() => products.get().filter(p => !lowStockOnly.get() || p.stock < 20));

  pageHead(page, 'Products', 'Product catalogue');
  page.container('products-page', (p) => {
    headerBlock(p, 'products', 'Products', derived(() => `${visible.get().length} SKUs`));

    p.container('products-grid', (g) => {
      g.container('products-list', (c) => {
        c.container('card-header', (h) => {
          h.heading('Catalogue', { level: 3, id: 'cat-title', class: cardTitle });
          h.button(derived(() => lowStockOnly.get() ? 'Show all' : 'Low stock'), {
            id: 'low-stock-toggle', class: button({ intent: 'quiet', size: 'sm' }),
            onClick: () => lowStockOnly.set(!lowStockOnly.get()),
          });
        }, { id: 'cat-header', class: cardHeader });
        c.container('table-wrap', (tw) => {
          tw.container('head-row', (hr) => {
            hr.text('SKU', { id: 'ph-sku', class: cellMeta });
            hr.text('Name', { id: 'ph-name', class: cellText });
            hr.text('Price', { id: 'ph-price', class: cellNum });
            hr.text('Stock', { id: 'ph-stock', class: cellNum });
          }, { id: 'prod-head', class: tableHeadRow });
          tw.listOf('product-rows', visible, (prod, _i, row) => {
            row.text(prod.sku, { id: `p-sku-${prod.sku}`, class: cellMeta });
            row.text(prod.name, { id: `p-name-${prod.sku}`, class: cellText });
            row.text(`$${prod.price.toFixed(2)}`, { id: `p-price-${prod.sku}`, class: cellNum });
            row.text(String(prod.stock), { id: `p-stock-${prod.sku}`, class: cellNum });
            row.button('Select', {
              id: `p-sel-${prod.sku}`, class: button({ intent: 'quiet', size: 'sm' }),
              ariaSelected: derived(() => selected.get() === prod.sku) as never,
              onClick: () => selected.set(prod.sku),
            });
          }, { id: 'prod-rows', class: tableRow });
        }, { id: 'prod-table', class: tableWrap });
      }, { id: 'products-card', class: card });

      g.container('detail-aside', (aside) => {
        aside.when(derived(() => selected.get() !== null), (sel) => {
          const prod = derived(() => products.get().find(x => x.sku === selected.get())!);
          sel.container('detail-card', (d) => {
            d.heading('Product detail', { level: 3, id: 'pd-title', class: cardTitle });
            d.text(derived(() => prod.get().name), { id: 'pd-name', class: dataText });
            d.text(derived(() => `Price $${prod.get().price.toFixed(2)}`), { id: 'pd-price', class: metaText });
            d.text(derived(() => `Stock ${prod.get().stock}`), { id: 'pd-stock', class: metaText });
            d.text(derived(() => prod.get().stock < 20 ? 'Low stock — reorder soon' : 'In stock'), {
              id: 'pd-flag', class: badge({ intent: prod.get().stock < 20 ? 'warning' : 'success' }),
            });
          }, { id: 'detail-card', class: card });
        }, (none) => {
          none.container('no-sel', (n) => {
            n.text('Select a product to see details.', { id: 'no-sel', class: stateHint });
          }, { id: 'no-sel', class: stateRegion });
        });
      }, { id: 'detail-aside', class: mainAside });
    }, { id: 'products-grid', class: splitGrid });
  }, { id: 'products-page', class: pageClass });
}

// ── Customers (resource: loading → data/error) ────────────────────────────────

interface Customer { id: string; name: string; email: string; region: string; lifetime: number; }

function makeCustomers(): Customer[] {
  const regions = ['NA', 'EU', 'APAC', 'LATAM'];
  return Array.from({ length: 30 }, (_, i) => ({
    id: `CUS-${String(i + 500).padStart(4, '0')}`,
    name: `Customer ${i + 1}`,
    email: `customer${i + 1}@example.com`,
    region: regions[i % regions.length]!,
    lifetime: 120 + i * 91.4,
  }));
}

export function customersRoute(page: PageDSL, ctx: RouteContext, state: AppState) {
  // Simulated async read. `resource()` models loading/error/data as signals and
  // refetches on demand. Route-scoped cleanup disposes it on navigation.
  const fail = signal(false);
  const res = resource<Customer[]>(async () => {
    await new Promise(r => setTimeout(r, 20));
    if (fail.get()) throw new Error('Failed to load customers');
    return makeCustomers();
  });
  ctx.onCleanup(() => res.dispose());
  void res.refetch();

  pageHead(page, 'Customers', 'Customer directory');
  page.container('customers-page', (p) => {
    headerBlock(p, 'customers', 'Customers', 'Directory and lifetime value');

    p.container('customers-body', (body) => {
      body.asyncBoundary('cust-resource', res, {
        loading: (l) => {
          l.container('spin', () => {}, { id: 'cust-spin', class: spinner });
          l.text('Loading customers…', { id: 'cust-loading', class: stateHint });
        },
        error: (e, _err, retry) => {
          e.heading('Could not load customers', { level: 3, id: 'cust-err-title', class: stateTitle });
          e.text('The directory request failed.', { id: 'cust-err-hint', class: stateHint });
          e.button('Retry', { id: 'cust-retry', class: button({ intent: 'primary', size: 'sm' }), onClick: () => { fail.set(false); retry(); } });
        },
        success: (ok, data) => {
          ok.container('table-wrap', (tw) => {
            tw.container('head-row', (hr) => {
              hr.text('ID', { id: 'ch-id', class: cellMeta });
              hr.text('Name', { id: 'ch-name', class: cellText });
              hr.text('Region', { id: 'ch-region', class: cellText });
              hr.text('Lifetime', { id: 'ch-lt', class: cellNum });
            }, { id: 'cust-head', class: tableHeadRow });
            tw.listOf('cust-rows', derived(() => data.get() ?? []), (cust, _i, row) => {
              row.text(cust.id, { id: `c-id-${cust.id}`, class: cellMeta });
              row.text(cust.name, { id: `c-name-${cust.id}`, class: cellText });
              row.text(cust.region, { id: `c-region-${cust.id}`, class: cellText });
              row.text(`$${cust.lifetime.toFixed(2)}`, { id: `c-lt-${cust.id}`, class: cellNum });
            }, { id: 'cust-rows', class: tableRow });
          }, { id: 'cust-table', class: tableWrap });
        },
      });
    }, { id: 'customers-body', class: card });
  }, { id: 'customers-page', class: pageClass });
}

// ── Analytics (tabs + derived figures) ────────────────────────────────────────

export function analyticsRoute(page: PageDSL, _ctx: RouteContext, state: AppState) {
  const { orders } = state;
  const activeTab = signal<'volume' | 'revenue' | 'mix'>('volume');

  const byStatus = derived(() => {
    const all = orders.get();
    return {
      paid: all.filter(o => o.status === 'paid'),
      pending: all.filter(o => o.status === 'pending'),
      refunded: all.filter(o => o.status === 'refunded'),
    };
  });

  pageHead(page, 'Analytics', 'Sales analytics');
  page.container('analytics-page', (p) => {
    headerBlock(p, 'analytics', 'Analytics', 'Trends and breakdowns');

    p.container('tabs', (tl) => {
      (['volume', 'revenue', 'mix'] as const).forEach((tk) => {
        tl.button(tk.charAt(0).toUpperCase() + tk.slice(1), {
          id: `tab-${tk}`, class: tab,
          ariaSelected: derived(() => activeTab.get() === tk) as never,
          onClick: () => activeTab.set(tk),
        });
      });
    }, { id: 'analytics-tabs', class: tabList, role: 'tablist', ariaLabel: 'Analytics views' });

    p.container('panel', (panel) => {
      panel.when(derived(() => activeTab.get() === 'volume'), (v) => {
        v.container('vol', (x) => {
          x.heading('Order volume', { level: 3, id: 'vol-title', class: sectionHeading });
          x.text(derived(() => `${orders.get().length} orders`), { id: 'vol-num', class: dataText });
        }, { id: 'vol-panel' });
      });
      panel.when(derived(() => activeTab.get() === 'revenue'), (v) => {
        v.container('rev', (x) => {
          x.heading('Revenue', { level: 3, id: 'rev-title', class: sectionHeading });
          x.text(derived(() => `$${byStatus.get().paid.reduce((s, o) => s + o.amount, 0).toFixed(2)}`), { id: 'rev-num', class: dataText });
        }, { id: 'rev-panel' });
      });
      panel.when(derived(() => activeTab.get() === 'mix'), (v) => {
        v.container('mix', (x) => {
          x.heading('Status mix', { level: 3, id: 'mix-title', class: sectionHeading });
          const b = byStatus.get();
          x.text(`Paid ${b.paid.length} · Pending ${b.pending.length} · Refunded ${b.refunded.length}`, { id: 'mix-num', class: dataText });
        }, { id: 'mix-panel' });
      });
    }, { id: 'analytics-panel', class: card });
  }, { id: 'analytics-page', class: pageClass });
}

// ── Settings (form + validation + mutation → toast) ───────────────────────────

export function settingsRoute(page: PageDSL, _ctx: RouteContext, state: AppState) {
  const storeName = signal('Ledger Store');
  const email = signal('ops@example.com');
  const emailError = signal<string | null>(null);
  const saved = signal(false);

  const save = mutation<void, { ok: true }>(async () => {
    await new Promise(r => setTimeout(r, 15));
    const v = email.get();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      emailError.set('Enter a valid email address');
      throw new Error('invalid email');
    }
    emailError.set(null);
    saved.set(true);
    return { ok: true };
  });

  pageHead(page, 'Settings', 'Store settings');
  page.container('settings-page', (p) => {
    headerBlock(p, 'settings', 'Settings', 'Store profile and notifications');

    p.form('settings-form', (f) => {
      f.container('fields', (grid) => {
        grid.container('name-field', (fl) => {
          fl.text('Store name', { id: 'name-label', class: fieldLabel });
          fl.input({ id: 'name-input', type: 'text', bind: storeName, class: input, ariaRequired: true });
        }, { id: 'name-field', class: field });
        grid.container('email-field', (fl) => {
          fl.text('Contact email', { id: 'email-label', class: fieldLabel });
          fl.input({
            id: 'email-input', type: 'email', bind: email, class: input, ariaRequired: true,
            ariaInvalid: derived(() => emailError.get() !== null) as never,
            ariaDescribedBy: 'email-error',
          });
          fl.when(derived(() => emailError.get() !== null), (e) => {
            e.text(derived(() => emailError.get() ?? ''), { id: 'email-error', class: fieldError, role: 'alert' });
          });
        }, { id: 'email-field', class: field });
      }, { id: 'settings-fields', class: formGrid });

      f.container('actions', (a) => {
        a.button(derived(() => save.pending.get() ? 'Saving…' : 'Save changes'), {
          id: 'save-btn', class: button({ intent: 'primary', size: 'md' }),
          disabled: save.pending,
          onClick: () => { void save.mutate(undefined).catch(() => {}); },
        });
      }, { id: 'settings-actions' });
    }, {
      id: 'settings-form',
      onSubmit: (e) => { e.preventDefault(); void save.mutate(undefined).catch(() => {}); },
    });

    p.when(derived(() => save.error.get() !== undefined), (e) => {
      e.text('Could not save settings.', { id: 'save-error', class: alert({ intent: 'danger' }), role: 'alert' });
    });
  }, { id: 'settings-page', class: pageClass });
}

// ── Not found ─────────────────────────────────────────────────────────────────

export function notFoundRoute(page: PageDSL) {
  page.head({ title: 'Not found — Ledger' });
  page.container('not-found', (p) => {
    p.heading('Page not found', { level: 2, id: 'nf-title', class: pageTitle });
    p.text('That route does not exist.', { id: 'nf-hint', class: pageSubtitle });
    p.link('← Back to overview', { href: '/', id: 'nf-back', class: inlineLink });
  }, { id: 'not-found', class: pageClass });
}
