/**
 * Stress-app foundation tests.
 *
 * Proves the SSR↔client outlet contract, byte-identity across repeated SSR
 * renders, hydration adoption (no re-render, no duplicate sheet), and clean
 * unmount. These are the gates that decide whether the app exposed a real
 * framework problem — they run before any framework change is considered.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, mountApp, renderApp, OUTLET_ID } from './app.js';
import { createMemoryHistory } from 'streetui';

const CSS_MARKER = 'data-streetui-css';

function mountContainer(html: string): { container: HTMLElement; doc: Document } {
  const doc = document.implementation.createHTMLDocument('stress');
  doc.body.innerHTML = `<div id="app" data-ssr>${html}</div>`;
  return { container: doc.getElementById('app') as HTMLElement, doc };
}

describe('stress app foundation — SSR', () => {
  it('renders the persistent shell with the route inside the outlet', () => {
    const { html } = renderApp('/');
    expect(html).toContain('app-shell');
    expect(html).toContain(`id="${OUTLET_ID}"`);
    expect(html).toContain('overview');
  });

  it('emits a single deduplicated stylesheet with the CSS marker', () => {
    const { styles } = renderApp('/');
    const count = (styles.match(/<style\b/g) ?? []).length;
    expect(count).toBe(1);
    expect(styles).toContain(CSS_MARKER);
    expect(styles).toContain('--surface-rail'); // ledger token
  });

  it('is byte-identical across repeated renders of the same route', () => {
    const a = renderApp('/orders');
    const b = renderApp('/orders');
    expect(a.html).toBe(b.html);
    expect(a.styles).toBe(b.styles);
  });

  it('renders different routes inside the same shell', () => {
    const home = renderApp('/');
    const orders = renderApp('/orders');
    expect(home.html).toContain('overview');
    expect(orders.html).toContain('orders-page');
    // Same shell wrapper both times → stable outlet identity.
    for (const r of [home, orders]) {
      expect(r.html).toContain(`id="${OUTLET_ID}"`);
      expect(r.html).toContain('app-shell');
    }
  });
});

describe('stress app foundation — client mount', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('mounts fresh and installs exactly one stylesheet', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = mountApp(container);
    expect(container.querySelector(`#${OUTLET_ID}`)).not.toBeNull();
    const sheets = document.head.querySelectorAll(`[${CSS_MARKER}]`);
    expect(sheets.length).toBe(1);
    app.unmount();
  });

  it('does not duplicate the stylesheet on a second mount in the same document', () => {
    const c1 = document.createElement('div');
    const c2 = document.createElement('div');
    document.body.appendChild(c1);
    document.body.appendChild(c2);
    const a = mountApp(c1);
    const b = mountApp(c2);
    expect(document.head.querySelectorAll(`[${CSS_MARKER}]`).length).toBe(1);
    a.unmount();
    b.unmount();
  });

  it('unmounts cleanly (removes the shell)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = mountApp(container);
    expect(container.querySelector('#app-shell')).not.toBeNull();
    app.unmount();
    expect(container.querySelector('#app-shell')).toBeNull();
  });
});

describe('stress app foundation — hydration', () => {
  it('adopts server markup inside the outlet without a second stylesheet', () => {
    const { html, styles } = renderApp('/');
    const { container, doc } = mountContainer(html);
    doc.head.insertAdjacentHTML('beforeend', styles);
    const app = mountApp(container, { hydrate: true });
    // Sheet was already in head; hydration must NOT inject a second one.
    expect(doc.head.querySelectorAll(`[${CSS_MARKER}]`).length).toBe(1);
    expect(container.querySelector(`#${OUTLET_ID}`)).not.toBeNull();
    expect(container.querySelector('#app-shell')).not.toBeNull();
    app.unmount();
  });
});

describe('stress app — routing state', () => {
  it('creates an isolated app instance with its own state', () => {
    const a = createApp({ history: createMemoryHistory('/') });
    const b = createApp({ history: createMemoryHistory('/') });
    expect(a.state).not.toBe(b.state);
    expect(a.router).not.toBe(b.router);
    a.state.orders.set([]);
    expect(b.state.orders.get().length).toBeGreaterThan(0);
    a.router.destroy();
    b.router.destroy();
  });
});
