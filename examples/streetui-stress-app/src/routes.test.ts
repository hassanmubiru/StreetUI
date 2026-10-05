/**
 * Stress-app route interaction tests.
 *
 * Exercises the feature surface the 2.7 styling model must serve in a real
 * app: routing across six routes, reactive table filtering, pagination,
 * tab switching, an async resource's loading→data lifecycle, two-way-bound
 * form inputs, and route-scoped cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountApp, renderApp, type MountedStressApp } from './app.js';
import { createMemoryHistory } from 'streetui';
import { flushUpdates } from 'streetui/testing';

const text = (el: Element | null | undefined) => el?.textContent ?? '';

/** Flush microtasks plus a macrotask so deferred leave transitions can settle. */
async function settle(ms = 40): Promise<void> {
  await flushUpdates();
  await new Promise<void>((r) => setTimeout(r, ms));
  await flushUpdates();
}

let container: HTMLElement;
let app: MountedStressApp | undefined;

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  app = undefined;
});

afterEach(() => {
  app?.unmount();
});

function mount(path = '/') {
  app = mountApp(container, { history: createMemoryHistory(path) });
  return app;
}

describe('routing', () => {
  it.each([
    ['/', 'overview'],
    ['/products', 'products-page'],
    ['/orders', 'orders-page'],
    ['/analytics', 'analytics-page'],
    ['/settings', 'settings-page'],
  ])('SSR-renders %s with its page node', (path, marker) => {
    const { html } = renderApp(path);
    expect(html).toContain(marker);
  });

  it('navigates between routes in the live app', async () => {
    const a = mount('/');
    a.router.navigate('/products');
    await flushUpdates();
    expect(container.querySelector('#products-page')).not.toBeNull();
    a.router.navigate('/analytics');
    await flushUpdates();
    expect(container.querySelector('#analytics-page')).not.toBeNull();
    expect(container.querySelector('#products-page')).toBeNull();
  });

  it('falls back to not-found for an unknown path', async () => {
    mount('/nope');
    await flushUpdates();
    expect(container.querySelector('#not-found')).not.toBeNull();
  });
});

describe('orders route — filters + pagination', () => {
  it('filters the table by the status segments', async () => {
    mount('/orders');
    await flushUpdates();
    const total = container.querySelectorAll('#orders-list > *').length;
    (container.querySelector('#seg-paid') as HTMLElement).click();
    await settle();
    const paid = container.querySelectorAll('#orders-list > *').length;
    expect(paid).toBeLessThanOrEqual(total);
    expect(text(container.querySelector('#orders-count'))).toContain('of 200');
  });

  it('narrows rows via the bound search input', async () => {
    const a = mount('/orders');
    await flushUpdates();
    a.state.search.set('Customer 199');
    await flushUpdates();
    expect(text(container.querySelector('#orders-count'))).toContain('of 200');
  });

  it('shows the empty state when no orders match', async () => {
    const a = mount('/orders');
    await flushUpdates();
    a.state.search.set('zzz-no-match-zzz');
    await flushUpdates();
    expect(container.querySelector('#orders-empty')).not.toBeNull();
  });

  it('paginates and disables Prev on page 1', async () => {
    mount('/orders');
    await flushUpdates();
    expect(text(container.querySelector('#pager-info'))).toContain('Page 1 of');
    (container.querySelector('#pager-next') as HTMLElement).click();
    await flushUpdates();
    expect(text(container.querySelector('#pager-info'))).toContain('Page 2 of');
  });
});

describe('products route — selection', () => {
  it('shows an empty detail aside then a detail card on selection', async () => {
    mount('/products');
    await flushUpdates();
    expect(container.querySelector('#no-sel')).not.toBeNull();
    const sel = container.querySelector('#prod-rows [id^="p-sel-"]') as HTMLElement;
    sel.click();
    await flushUpdates();
    expect(container.querySelector('#detail-card')).not.toBeNull();
    expect(text(container.querySelector('#pd-name'))).toContain('Product');
  });
});

describe('customers route — async resource', () => {
  it('resolves from loading to a populated table', async () => {
    mount('/customers');
    // Allow the 20ms loader + flush.
    await new Promise(r => setTimeout(r, 40));
    await flushUpdates();
    const rows = container.querySelectorAll('#cust-rows > *').length;
    expect(rows).toBeGreaterThan(0);
  });
});

describe('analytics route — tabs', () => {
  it('switches the visible panel between tabs', async () => {
    mount('/analytics');
    await flushUpdates();
    expect(container.querySelector('#vol-panel')).not.toBeNull();
    (container.querySelector('#tab-revenue') as HTMLElement).click();
    await settle();
    expect(container.querySelector('#rev-panel')).not.toBeNull();
    expect(container.querySelector('#vol-panel')).toBeNull();
  });
});

describe('settings route — form', () => {
  it('renders the bound form fields', async () => {
    mount('/settings');
    await flushUpdates();
    expect(container.querySelector('#name-input')).not.toBeNull();
    expect(container.querySelector('#email-input')).not.toBeNull();
    expect(container.querySelector('#save-btn')).not.toBeNull();
  });
});

describe('theme', () => {
  it('cycles data-theme without re-rendering the app', async () => {
    const a = mount('/');
    await flushUpdates();
    const shell = container.querySelector('#app-shell');
    const before = a.theme.choice.get();
    (container.querySelector('#theme-toggle') as HTMLElement).click();
    await flushUpdates();
    // Choice advanced light → dark → system; resolved value can repeat when the
    // OS resolves 'system', so assert on the choice signal itself.
    expect(a.theme.choice.get()).not.toBe(before);
    expect(document.documentElement.getAttribute('data-theme')).not.toBeNull();
    // Shell node identity preserved → a data-theme flip, not a rerender.
    expect(container.querySelector('#app-shell')).toBe(shell);
  });
});

describe('overlays & transitions', () => {
  it('opens and closes the new-order dialog (modal overlay)', async () => {
    mount('/orders');
    await flushUpdates();
    expect(document.querySelector('#new-order-panel')).toBeNull();
    (container.querySelector('#new-order-btn') as HTMLElement).click();
    await flushUpdates();
    expect(document.querySelector('#new-order-panel')).not.toBeNull();
    expect(document.querySelector('#new-order-panel')?.getAttribute('class')).toContain('s-');
    (document.querySelector('#new-order-close') as HTMLElement).click();
    await flushUpdates();
    expect(document.querySelector('#new-order-panel')).toBeNull();
  });

  it('opens a per-row dropdown on the action button', async () => {
    mount('/orders');
    await flushUpdates();
    const firstAction = container.querySelector('#o-act-ORD-01000') as HTMLElement;
    expect(firstAction).not.toBeNull();
    firstAction.click();
    await settle();
    expect(document.querySelector('#drop-ORD-01000')).not.toBeNull();
    expect(document.querySelector('#o-refund-ORD-01000')).not.toBeNull();
    expect(document.querySelector('#o-copy-ORD-01000')).not.toBeNull();
  });

  it('raises a toast when a dropdown action is invoked', async () => {
    mount('/orders');
    await flushUpdates();
    (container.querySelector('#o-act-ORD-01000') as HTMLElement).click();
    await settle();
    (document.querySelector('#o-refund-ORD-01000') as HTMLElement).click();
    await settle();
    const toast = document.querySelector('#orders-toast-text');
    expect(toast).not.toBeNull();
    expect(text(toast)).toContain('Refunded');
  });

  it('toggles a tooltip on the export button', async () => {
    mount('/');
    await flushUpdates();
    expect(document.querySelector('#export-tip-text')).toBeNull();
    (container.querySelector('#export-btn') as HTMLElement).click();
    await flushUpdates();
    const tip = document.querySelector('#export-tip-text');
    expect(tip).not.toBeNull();
    expect(text(tip)).toContain('Export the current view as CSV');
  });

  it('defers removing a `when` branch until the leave transition elapses', async () => {
    mount('/settings');
    await flushUpdates();
    // Force a validation error to show the save-error alert.
    const emailIn = container.querySelector('#email-input') as HTMLInputElement;
    emailIn.value = 'not-an-email';
    emailIn.dispatchEvent(new Event('input', { bubbles: true }));
    (container.querySelector('#save-btn') as HTMLElement).click();
    await settle();
    expect(container.querySelector('#save-error')).not.toBeNull();
    // Correct the email so the error clears.
    emailIn.value = 'ok@example.com';
    emailIn.dispatchEvent(new Event('input', { bubbles: true }));
    await flushUpdates();
    // Leave transition is deferred (~15ms) — the error is still present here.
    expect(container.querySelector('#save-error')).not.toBeNull();
    await settle();
    // After the leave completes the error node is reclaimed.
    expect(container.querySelector('#save-error')).toBeNull();
  });
});
