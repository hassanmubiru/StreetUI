/**
 * StreetUI 2.2 — Phase 5 Real Application Stress Suites (tests).
 *
 * Drives the ten production-style apps in `stress-suites.ts` through the real
 * pipeline under happy-dom and asserts STRUCTURAL CORRECTNESS + RECONCILER
 * BEHAVIOUR AT SCALE — never a browser-performance number (browser benchmarking
 * stays BLOCKED; see benchmarks/results/v2.2). happy-dom is a real DOM but not a
 * browser, so nothing here is a wall-clock claim.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetIdCounter,
  renderToString,
  renderHead,
  createRenderer,
  BrowserDOMAdapter,
} from 'streetui';
import {
  mountApp,
  createGridApp,
  createDashboardApp,
  createCatalogApp,
  createLargeFormApp,
  createChatApp,
  createRoutingApp,
  createAsyncApp,
  createSsrApp,
  createOverlayApp,
  createI18nApp,
  type GridRow,
} from './stress-suites.js';

const txt = (el: Element | null | undefined) => el?.textContent?.trim() ?? '';

async function flush(ms = 0): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await new Promise<void>((r) => setTimeout(r, ms));
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function click(el: Element | null): void {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

function setInput(el: Element | null, value: string): void {
  const input = el as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function container(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  resetIdCounter();
});
// 1 ── 10k-row grid: initial render, keyed reorder reuse, in-place update ──────
describe('stress 1 — 10k-row data grid', () => {
  const N = 10_000;

  it('renders 10,000 keyed rows through the real reconciler', () => {
    const c = container();
    const { compiled } = createGridApp(N);
    const mounted = mountApp(compiled, c);
    const cells = c.querySelectorAll('[id^="cell-"]');
    expect(cells.length).toBe(N);
    expect(txt(c.querySelector('#cell-0'))).toBe('Row 0');
    expect(txt(c.querySelector('#cell-9999'))).toBe('Row 9999');
    mounted.unmount();
  }, 30_000);

  it('reuses DOM nodes by key across a full reverse (no re-creation)', () => {
    const c = container();
    const { compiled, rows } = createGridApp(N);
    const mounted = mountApp(compiled, c);

    const before0 = c.querySelector('#cell-0');
    const before9999 = c.querySelector('#cell-9999');
    expect(before0).not.toBeNull();

    rows.update((r: GridRow[]) => [...r].reverse());

    // Same element objects survive the reorder (keyed identity preserved).
    expect(c.querySelector('#cell-0')).toBe(before0);
    expect(c.querySelector('#cell-9999')).toBe(before9999);
    // Count unchanged.
    expect(c.querySelectorAll('[id^="cell-"]').length).toBe(N);
    // Order flipped: first rendered cell is now the highest id.
    const first = c.querySelector('#grid-body')?.querySelector('[id^="cell-"]');
    expect(first?.id).toBe('cell-9999');
    mounted.unmount();
  }, 30_000);

  it('updates a single row in place without disturbing the others', () => {
    const c = container();
    const { compiled, rows } = createGridApp(1000);
    const mounted = mountApp(compiled, c);
    const otherBefore = c.querySelector('#cell-500');

    rows.update((r: GridRow[]) => r.map((row) => (row.id === 7 ? { ...row, name: 'CHANGED' } : row)));

    expect(txt(c.querySelector('#cell-7'))).toBe('CHANGED');
    // An untouched row keeps its node identity and text.
    expect(c.querySelector('#cell-500')).toBe(otherBefore);
    expect(txt(c.querySelector('#cell-500'))).toBe('Row 500');
    expect(c.querySelectorAll('[id^="cell-"]').length).toBe(1000);
    mounted.unmount();
  });
});

// 2 ── Admin dashboard: nested regions + reactive KPIs ─────────────────────────
describe('stress 2 — admin dashboard', () => {
  it('renders nested KPI regions and updates a metric reactively', () => {
    const c = container();
    const { compiled, stats } = createDashboardApp(12);
    const mounted = mountApp(compiled, c);

    expect(c.querySelectorAll('[id^="kpi-value-"]').length).toBe(12);
    expect(txt(c.querySelector('#kpi-value-3'))).toBe('30');
    expect(c.querySelector('#activity-note')).not.toBeNull();

    stats[3]!.set(999);
    expect(txt(c.querySelector('#kpi-value-3'))).toBe('999');
    // Sibling metric untouched.
    expect(txt(c.querySelector('#kpi-value-4'))).toBe('40');
    mounted.unmount();
  });
});

// 3 ── E-commerce catalog: derived filter narrows the list reactively ──────────
describe('stress 3 — e-commerce catalog', () => {
  it('filters a large catalog via a derived signal and restores it', () => {
    const c = container();
    const { compiled, category } = createCatalogApp(400);
    const mounted = mountApp(compiled, c);

    expect(c.querySelectorAll('[id^="product-"]').length).toBe(400);

    click(c.querySelector('#filter-asic')); // category → 'asic' (every 4th)
    expect(c.querySelectorAll('[id^="product-"]').length).toBe(100);
    expect(txt(c.querySelector('#product-1'))).toBe('Product 1'); // id 1 % 4 == 1 == 'asic'

    click(c.querySelector('#filter-all'));
    expect(c.querySelectorAll('[id^="product-"]').length).toBe(400);
    void category;
    mounted.unmount();
  });
});

// 4 ── Large form: validation blocks submit, then succeeds ─────────────────────
describe('stress 4 — large validated form', () => {
  it('renders 30 fields, blocks an invalid submit, and submits once valid', () => {
    const c = container();
    const { compiled, submitted, names } = createLargeFormApp(30, 5);
    const mounted = mountApp(compiled, c);

    expect(c.querySelectorAll('[id^="input-"]').length).toBe(30);

    // Submit while required fields are empty → blocked, errors shown.
    c.querySelector('#big-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(submitted.get()).toBe(false);
    expect(txt(c.querySelector(`#error-${names[0]}`))).not.toBe('');

    // Fill the required fields and resubmit → succeeds.
    for (let i = 0; i < 5; i++) setInput(c.querySelector(`#input-${names[i]}`), `value-${i}`);
    c.querySelector('#big-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(submitted.get()).toBe(true);
    expect(txt(c.querySelector('#form-status'))).toBe('saved');
    mounted.unmount();
  });
});

// 5 ── Realtime / chat: append-heavy list reuses prior nodes ───────────────────
describe('stress 5 — realtime chat (append-heavy)', () => {
  it('streams 500 messages, appending without re-creating earlier ones', () => {
    const c = container();
    const { compiled, send } = createChatApp();
    const mounted = mountApp(compiled, c);

    send('first');
    const firstNode = c.querySelector('#msg-0');
    expect(txt(firstNode)).toBe('first');

    for (let i = 1; i < 500; i++) send(`m${i}`);

    expect(c.querySelectorAll('[id^="msg-"]').length).toBe(500);
    // The very first message node is reused across all the appends (keyed).
    expect(c.querySelector('#msg-0')).toBe(firstNode);
    expect(txt(c.querySelector('#msg-499'))).toBe('m499');
    mounted.unmount();
  }, 20_000);
});
// 6 ── Routing-heavy: many routes + rapid navigation, shell persists ──────────
describe('stress 6 — routing-heavy', () => {
  it('navigates across 50 routes while the shell node persists', () => {
    const c = container();
    const { router, mount } = createRoutingApp(50);
    const mounted = mount(c);

    expect(c.querySelector('#page-0-title')).not.toBeNull();
    const shell = c.querySelector('#route-shell');
    expect(shell).not.toBeNull();

    for (const i of [7, 23, 49, 0, 31]) {
      router.navigate(`/p${i}`);
      expect(txt(c.querySelector(`#page-${i}-title`))).toBe(`Page ${i}`);
      expect(c.querySelector('#route-shell')).toBe(shell); // same shell reused
    }

    router.navigate('/nope');
    expect(c.querySelector('#route-not-found')).not.toBeNull();
    mounted.unmount();
  });
});

// 7 ── Async data: loading → success via resource + asyncBoundary ─────────────
describe('stress 7 — async data', () => {
  it('shows the loading branch then the loaded list', async () => {
    const c = container();
    const { compiled, res } = createAsyncApp(200, 5);
    const mounted = mountApp(compiled, c);

    expect(c.querySelector('#async-loading')).not.toBeNull();
    expect(c.querySelector('#async-list')).toBeNull();

    await flush(15);

    expect(c.querySelector('#async-loading')).toBeNull();
    expect(c.querySelectorAll('[id^="async-item-"]').length).toBe(200);
    expect(txt(c.querySelector('#async-item-0'))).toBe('Item 0');

    res.dispose();
    mounted.unmount();
  });
});

// 8 ── SSR + hydration: server render, adopt DOM, stay reactive ───────────────
describe('stress 8 — SSR + hydration', () => {
  it('server-renders head + body then hydrates by adopting server nodes', async () => {
    resetIdCounter();
    const { compiled, open } = createSsrApp(100);

    const bodyHtml = renderToString(compiled);
    const headHtml = renderHead(compiled);
    expect(headHtml).toContain('SSR Stress');
    expect(bodyHtml).toContain('Row 0');
    expect(bodyHtml).toContain('Row 99');

    resetIdCounter();
    document.body.innerHTML = `<div id="app">${bodyHtml}</div>`;
    const appEl = document.getElementById('app')!;
    const serverCell = appEl.querySelector('#ssr-cell-0');
    expect(serverCell).not.toBeNull();
    expect(appEl.querySelectorAll('[id^="ssr-cell-"]').length).toBe(100);

    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.hydrate(compiled, appEl);

    // Adopted, not recreated.
    expect(appEl.querySelector('#ssr-cell-0')).toBe(serverCell);
    // Reactive after hydration.
    expect(appEl.querySelector('#ssr-revealed')).toBeNull();
    open.set(true);
    await flush();
    expect(appEl.querySelector('#ssr-revealed')).not.toBeNull();

    handle.unmount();
  });
});

// 9 ── Overlay-heavy: all five overlay kinds portal to <body> ─────────────────
describe('stress 9 — overlay-heavy', () => {
  it('opens and closes dialog, popover, dropdown, tooltip and toast', async () => {
    const c = container();
    const { compiled, dialogOpen, popoverOpen, dropdownOpen, tooltipOpen, toastOpen } = createOverlayApp();
    const mounted = mountApp(compiled, c);

    // Nothing shown initially.
    for (const id of ['#dialog-body', '#popover-body', '#dropdown-item', '#tooltip-body', '#toast-body']) {
      expect(document.querySelector(id)).toBeNull();
    }

    click(c.querySelector('#open-dialog'));
    click(c.querySelector('#open-popover'));
    click(c.querySelector('#open-dropdown'));
    click(c.querySelector('#open-tooltip'));
    toastOpen.set(true);
    await flush();

    // All overlay panels are portalled and present simultaneously.
    expect(document.querySelector('#dialog-body')).not.toBeNull();
    expect(document.querySelector('#popover-body')).not.toBeNull();
    expect(document.querySelector('#dropdown-item')).not.toBeNull();
    expect(document.querySelector('#tooltip-body')).not.toBeNull();
    expect(document.querySelector('#toast-body')).not.toBeNull();

    // Cooperative close via the signals the app owns.
    dialogOpen.set(false);
    popoverOpen.set(false);
    dropdownOpen.set(false);
    tooltipOpen.set(false);
    toastOpen.set(false);
    await flush();
    expect(document.querySelector('#dialog-body')).toBeNull();
    expect(document.querySelector('#toast-body')).toBeNull();

    mounted.unmount();
  });
});

// 10 ── i18n: many reactive bindings re-translate on locale switch ────────────
describe('stress 10 — i18n locale switch at scale', () => {
  it('re-translates 100 bound strings when the locale changes', () => {
    const c = container();
    const { compiled, i18n, keyCount } = createI18nApp(100);
    const mounted = mountApp(compiled, c);

    expect(c.querySelectorAll('[id^="i18nline-"]').length).toBe(keyCount);
    expect(txt(c.querySelector('#i18nline-0'))).toBe('English 0');
    expect(txt(c.querySelector('#i18nline-99'))).toBe('English 99');

    i18n.setLocale('fr');

    expect(txt(c.querySelector('#i18nline-0'))).toBe('French 0');
    expect(txt(c.querySelector('#i18nline-99'))).toBe('French 99');
    mounted.unmount();
  });
});

