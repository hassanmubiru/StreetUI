/**
 * StreetUI 2.2 — Phase 5 Real Application Stress Suites.
 *
 * Ten production-style applications, each built ENTIRELY through the public
 * `streetui` package (DSL → Compiler → Semantic Graph → Runtime → Renderer →
 * real DOM, plus SSR + hydration). They exercise the framework at production
 * scale so the accompanying test file can assert *structural correctness and
 * reconciler behaviour at scale*: element counts, keyed node reuse across
 * reorders, mount/unmount, reactive re-binding, overlay portalling, routing,
 * async branches, and SSR adoption.
 *
 * SCOPE / ANTI-FABRICATION NOTE (mission rule): these suites run under
 * happy-dom, which is a real DOM but NOT a browser and NOT an assistive
 * technology. They therefore make NO browser-performance claim and emit NO
 * timing numbers. Wall-clock benchmarking against a real browser stays BLOCKED
 * (no Chromium in this environment — see benchmarks/results/v2.2). Nothing here
 * is optimised against fabricated or synthetic browser numbers; every assertion
 * is about correct behaviour of the real pipeline at scale.
 *
 * The ten scenarios (mission Phase 5): 10k-row grid, admin dashboard,
 * e-commerce catalog, large form, realtime/chat, routing-heavy, async data,
 * SSR + hydration, overlay-heavy, i18n.
 */
import {
  signal,
  derived,
  streetui,
  compile,
  createRuntime,
  createRenderer,
  BrowserDOMAdapter,
  resource,
  createForm,
  required,
  minLength,
  createI18n,
  createRouter,
  mountRouter,
  routerOutlet,
  createMemoryHistory,
  type Signal,
  type PageDSL,
  type RouteDefinition,
  type MountedRouter,
  type Router,
} from 'streetui';

export type Compiled = ReturnType<typeof compile>;

/** Mount a compiled standalone app on a container via the real runtime/renderer. */
export function mountApp(compiled: Compiled, container: Element) {
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const runtime = createRuntime({ renderer });
  return runtime.mount(compiled, container); // { unmount() }
}
// ── 1 ── 10k-row data grid ────────────────────────────────────────────────────
export interface GridRow { readonly id: number; readonly name: string; readonly value: number; }

export function makeGridRows(n: number): GridRow[] {
  const rows: GridRow[] = new Array(n);
  for (let i = 0; i < n; i++) rows[i] = { id: i, name: `Row ${i}`, value: i };
  return rows;
}

/** A single reactive `listOf` over `rowCount` rows — stresses initial render,
 *  keyed reorder (node reuse) and in-place data update of the reconciler. */
export function createGridApp(rowCount: number) {
  const rows = signal<GridRow[]>(makeGridRows(rowCount));
  const app = streetui.app({ name: 'StreetUI Stress — Grid', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.section('grid', (s) => {
      s.heading('Data grid', { level: 1, id: 'grid-title' });
      s.listOf('rows', rows, (row, _i, item) => {
        item.text(row.name, { id: `cell-${row.id}` });
      }, { id: 'grid-body' });
    }, { id: 'grid', role: 'region', ariaLabel: 'Data grid' });
  });
  return { compiled: compile(app), rows };
}

// ── 2 ── Admin dashboard (nested regions + reactive KPIs) ──────────────────────
export function createDashboardApp(kpiCount = 12) {
  const stats: Signal<number>[] = [];
  const app = streetui.app({ name: 'StreetUI Stress — Admin', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.section('kpis', (s) => {
      s.heading('Admin dashboard', { level: 1, id: 'admin-title' });
      for (let i = 0; i < kpiCount; i++) {
        const stat = signal(i * 10);
        stats.push(stat);
        s.container(`kpi-${i}`, (c) => {
          c.heading(`Metric ${i}`, { level: 3, id: `kpi-label-${i}` });
          c.text(stat, { id: `kpi-value-${i}` });
        }, { id: `kpi-${i}` });
      }
    }, { id: 'kpis', role: 'region', ariaLabel: 'KPIs' });
    page.section('activity', (s) => {
      s.heading('Recent activity', { level: 2, id: 'activity-title' });
      s.container('activity-body', (c) => {
        c.text('System nominal.', { id: 'activity-note' });
      }, { id: 'activity-body' });
    }, { id: 'activity', role: 'region', ariaLabel: 'Activity' });
  });
  return { compiled: compile(app), stats };
}

// ── 3 ── E-commerce catalog (derived filtered list) ────────────────────────────
export interface Product { readonly id: number; readonly name: string; readonly category: string; readonly price: number; }

export function makeProducts(n: number): Product[] {
  const cats = ['gpu', 'asic', 'psu', 'cable'];
  const out: Product[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = { id: i, name: `Product ${i}`, category: cats[i % cats.length]!, price: 100 + i };
  return out;
}

export function createCatalogApp(productCount: number) {
  const products = signal<Product[]>(makeProducts(productCount));
  const category = signal<string>('all');
  const visible = derived<Product[]>(() => {
    const c = category.get();
    return c === 'all' ? products.get() : products.get().filter((p) => p.category === c);
  });
  const app = streetui.app({ name: 'StreetUI Stress — Catalog', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.section('catalog', (s) => {
      s.heading('Catalog', { level: 1, id: 'catalog-title' });
      s.button('All', { id: 'filter-all', onClick: () => category.set('all') });
      s.button('ASIC only', { id: 'filter-asic', onClick: () => category.set('asic') });
      s.listOf('products', visible, (p, _i, item) => {
        item.text(p.name, { id: `product-${p.id}` });
      }, { id: 'catalog-list' });
    }, { id: 'catalog', role: 'region', ariaLabel: 'Catalog' });
  });
  return { compiled: compile(app), products, category, visible };
}
// ── 4 ── Large form (many validated fields via createForm) ─────────────────────
export function largeFormFieldNames(count: number): string[] {
  return Array.from({ length: count }, (_v, i) => `field${i}`);
}

/** `createForm` with many fields; the first `requiredCount` are required +
 *  minLength(2). Drives the full forms → validation → submit path at scale. */
export function createLargeFormApp(fieldCount = 30, requiredCount = 5) {
  const names = largeFormFieldNames(fieldCount);
  const initialValues: Record<string, string> = {};
  const validators: Record<string, ReturnType<typeof required>[]> = {};
  for (let i = 0; i < names.length; i++) {
    initialValues[names[i]!] = '';
    if (i < requiredCount) validators[names[i]!] = [required(), minLength(2)];
  }
  const submitted = signal(false);
  const form = createForm<Record<string, string>>({
    initialValues,
    validators,
    onSubmit: () => submitted.set(true),
  });
  const app = streetui.app({ name: 'StreetUI Stress — Form', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.section('form-section', (s) => {
      s.heading('Large form', { level: 1, id: 'form-title' });
      s.form('big-form', (f) => {
        for (let i = 0; i < names.length; i++) {
          const name = names[i]!;
          f.input({ id: `input-${name}`, type: 'text', bind: form.field(name).value });
          f.text(derived(() => form.field(name).error.get() ?? ''), { id: `error-${name}` });
        }
        f.text(derived(() => (submitted.get() ? 'saved' : '')), { id: 'form-status' });
        f.button('Submit', { id: 'form-submit' });
      }, { id: 'big-form', onSubmit: () => form.submit(), ariaLabel: 'Large form' });
    }, { id: 'form-section', role: 'region', ariaLabel: 'Large form' });
  });
  return { compiled: compile(app), form, submitted, names };
}

// ── 5 ── Realtime / chat (append-heavy list) ───────────────────────────────────
export interface ChatMessage { readonly id: number; readonly text: string; }

export function createChatApp() {
  const messages = signal<ChatMessage[]>([]);
  let next = 0;
  const send = (text: string): number => {
    const id = next++;
    messages.update((m) => [...m, { id, text }]);
    return id;
  };
  const app = streetui.app({ name: 'StreetUI Stress — Chat', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.section('chat', (s) => {
      s.heading('Chat', { level: 1, id: 'chat-title' });
      s.listOf('messages', messages, (msg, _i, item) => {
        item.text(msg.text, { id: `msg-${msg.id}` });
      }, { id: 'chat-log' });
    }, { id: 'chat', role: 'region', ariaLabel: 'Chat' });
  });
  return { compiled: compile(app), messages, send };
}

// ── 6 ── Routing-heavy (many routes + rapid navigation) ────────────────────────
export function createRoutingApp(routeCount = 50) {
  const routes: RouteDefinition[] = [];
  for (let i = 0; i < routeCount; i++) {
    routes.push({
      path: `/p${i}`,
      builder: (page: PageDSL) => page.section(`sec-${i}`, (s) => {
        s.heading(`Page ${i}`, { level: 1, id: `page-${i}-title` });
      }, { id: `page-${i}`, role: 'region', ariaLabel: `Page ${i}` }),
    });
  }
  routes.push({ path: '*', builder: (page: PageDSL) => page.section('nf', (s) => s.heading('Not found', { level: 1, id: 'route-not-found' }), { id: 'nf' }) });
  const router = createRouter({ routes, history: createMemoryHistory('/p0') });
  const mount = (container: Element): MountedRouter => mountRouter(router, {
    container,
    shell: (sh: PageDSL) => {
      sh.section('r-nav', (n) => n.heading('Routing app', { level: 1, id: 'route-shell' }), { id: 'r-nav', role: 'navigation', ariaLabel: 'Nav' });
      routerOutlet(sh);
    },
  });
  return { router, mount, routeCount };
}
// ── 7 ── Async data (resource + asyncBoundary) ─────────────────────────────────
export interface AsyncItem { readonly id: number; readonly label: string; }

export function makeAsyncItems(n: number): AsyncItem[] {
  return Array.from({ length: n }, (_v, i) => ({ id: i, label: `Item ${i}` }));
}

/** A `resource` feeding an `asyncBoundary` (loading → success). The caller owns
 *  the resource so it can be disposed after the test. */
export function createAsyncApp(itemCount = 200, delayMs = 0) {
  const items = makeAsyncItems(itemCount);
  const res = resource<AsyncItem[]>(
    () => new Promise((resolve) => setTimeout(() => resolve(items), delayMs)),
    { immediate: true },
  );
  const app = streetui.app({ name: 'StreetUI Stress — Async', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.section('async', (s) => {
      s.heading('Async data', { level: 1, id: 'async-title' });
      s.asyncBoundary('async-data', res, {
        loading: (c) => c.text('Loading…', { id: 'async-loading' }),
        error: (c, e) => c.text(`Error: ${(e as Error).message}`, { id: 'async-error' }),
        success: (c, data) => {
          c.listOf('async-list', data as Signal<AsyncItem[]>, (it, _i, item) => {
            item.text(it.label, { id: `async-item-${it.id}` });
          }, { id: 'async-list' });
        },
      });
    }, { id: 'async', role: 'region', ariaLabel: 'Async data' });
  });
  return { compiled: compile(app), res };
}

// ── 8 ── SSR + hydration ───────────────────────────────────────────────────────
/** A deterministic standalone page for server render → hydrate. Reactivity is
 *  proven post-hydration by toggling `open`. */
export function createSsrApp(rowCount = 100) {
  const open = signal(false);
  const rows = signal<GridRow[]>(makeGridRows(rowCount));
  const app = streetui.app({ name: 'StreetUI Stress — SSR', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.head({ title: 'SSR Stress', description: 'server render then hydrate' });
    page.section('ssr', (s) => {
      s.heading('SSR + hydration', { level: 1, id: 'ssr-title' });
      s.listOf('ssr-rows', rows, (row, _i, item) => {
        item.text(row.name, { id: `ssr-cell-${row.id}` });
      }, { id: 'ssr-body' });
      s.button('Toggle', { id: 'ssr-toggle', onClick: () => open.update((v) => !v) });
      s.when(open, (b) => b.text('revealed', { id: 'ssr-revealed' }));
    }, { id: 'ssr', role: 'region', ariaLabel: 'SSR' });
  });
  return { compiled: compile(app), open, rows };
}

// ── 9 ── Overlay-heavy (all five overlay kinds) ────────────────────────────────
export function createOverlayApp() {
  const dialogOpen = signal(false);
  const popoverOpen = signal(false);
  const dropdownOpen = signal(false);
  const tooltipOpen = signal(false);
  const toastOpen = signal(false);
  const app = streetui.app({ name: 'StreetUI Stress — Overlays', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.section('overlays', (s) => {
      s.heading('Overlays', { level: 1, id: 'overlays-title' });

      s.button('Open dialog', { id: 'open-dialog', onClick: () => dialogOpen.set(true) });
      s.dialog('ov-dialog', { open: dialogOpen, onClose: () => dialogOpen.set(false), ariaLabel: 'Dialog' }, (d) => {
        d.text('Dialog body', { id: 'dialog-body' });
      });

      s.button('Open popover', { id: 'open-popover', onClick: () => popoverOpen.set(true) });
      s.popover('ov-popover', { open: popoverOpen, onClose: () => popoverOpen.set(false) }, (p) => {
        p.text('Popover body', { id: 'popover-body' });
      });

      s.button('Open dropdown', { id: 'open-dropdown', onClick: () => dropdownOpen.set(true) });
      s.dropdown('ov-dropdown', { open: dropdownOpen, onClose: () => dropdownOpen.set(false) }, (m) => {
        m.button('Item', { id: 'dropdown-item' });
      });

      s.button('Open tooltip', { id: 'open-tooltip', onClick: () => tooltipOpen.set(true) });
      s.tooltip('ov-tooltip', { open: tooltipOpen }, (t) => {
        t.text('Tooltip body', { id: 'tooltip-body' });
      });

      s.toast('ov-toast', { open: toastOpen, onClose: () => toastOpen.set(false) }, (t) => {
        t.text('Toast body', { id: 'toast-body' });
      });
    }, { id: 'overlays', role: 'region', ariaLabel: 'Overlays' });
  });
  return { compiled: compile(app), dialogOpen, popoverOpen, dropdownOpen, tooltipOpen, toastOpen };
}

// ── 10 ── i18n (many reactive bindings + locale switch) ────────────────────────
export function createI18nApp(keyCount = 100) {
  const en: Record<string, string> = {};
  const fr: Record<string, string> = {};
  for (let i = 0; i < keyCount; i++) {
    en[`k${i}`] = `English ${i}`;
    fr[`k${i}`] = `French ${i}`;
  }
  const i18n = createI18n({ locale: 'en', fallbackLocale: 'en', messages: { en, fr } });
  const app = streetui.app({ name: 'StreetUI Stress — i18n', version: '1.0.0' });
  app.page('home', (page: PageDSL) => {
    page.section('i18n', (s) => {
      s.heading('i18n', { level: 1, id: 'i18n-title' });
      for (let i = 0; i < keyCount; i++) {
        s.text(i18n.t(`k${i}`), { id: `i18nline-${i}` });
      }
    }, { id: 'i18n', role: 'region', ariaLabel: 'i18n' });
  });
  return { compiled: compile(app), i18n, keyCount };
}

export type { Router, MountedRouter };

