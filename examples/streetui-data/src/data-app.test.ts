import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import type { Resource } from '@streetui/state';
import { createMemoryHistory } from '@streetui/router';
import { createProductApi, type Product, type ProductApi } from './api-server.js';
import { mountDataApp, type MountedDataApp } from './data-app.js';

/** Resolve after all queued microtasks + timers so real fetch round-trips settle. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const text = (el: Element | null): string => el?.textContent?.trim() ?? '';

let api: ProductApi;
let baseUrl: string;
let container: HTMLElement;
let app: MountedDataApp | null = null;

beforeEach(async () => {
  resetIdCounter();
  api = createProductApi();
  baseUrl = await api.listen();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  app?.unmount();
  app = null;
  container.remove();
  await api.close();
});

describe('streetui-data — loading → success against a real HTTP API', () => {
  it('shows a loading state, then renders the fetched product list (no hardcoded data)', async () => {
    app = mountDataApp(container, { baseUrl, history: createMemoryHistory('/products') });

    // Synchronously after mount the fetch is in flight → loading UI, no items yet.
    expect(container.querySelector('#products-loading')).not.toBeNull();
    expect(container.querySelector('#product-1')).toBeNull();

    await settle();

    // Data resolved over real HTTP → list rendered, loading gone.
    expect(container.querySelector('#products-loading')).toBeNull();
    expect(text(container.querySelector('#product-1'))).toBe('Antminer S21 — $3999');
    expect(text(container.querySelector('#product-2'))).toBe('Whatsminer M60 — $3499');
    expect(text(container.querySelector('#product-3'))).toBe('Avalon A1466 — $2899');
  });

  it('reflects the server data exactly — swapping the backing data changes the render', async () => {
    api.setProducts([{ id: 7, name: 'Bombax BM100', price: 5200 }]);
    app = mountDataApp(container, { baseUrl, history: createMemoryHistory('/products') });
    await settle();
    expect(text(container.querySelector('#product-7'))).toBe('Bombax BM100 — $5200');
    expect(container.querySelector('#product-1')).toBeNull();
  });

  it('renders the empty state when the API returns no products', async () => {
    api.setProducts([]);
    app = mountDataApp(container, { baseUrl, history: createMemoryHistory('/products') });
    await settle();
    expect(container.querySelector('#products-empty')).not.toBeNull();
    expect(text(container.querySelector('#products-empty'))).toBe('No products available.');
  });
});

describe('streetui-data — error → error UI → retry', () => {
  it('shows the error fallback with a Retry button, then recovers on retry', async () => {
    api.setFail(true);
    app = mountDataApp(container, { baseUrl, history: createMemoryHistory('/products') });
    await settle();

    // Failed fetch surfaced through the resource's error → errorBoundary fallback.
    const errorEl = container.querySelector('#products-error');
    expect(errorEl).not.toBeNull();
    expect(text(errorEl)).toContain('Unable to load products');
    const retry = container.querySelector('#products-retry') as HTMLElement | null;
    expect(retry).not.toBeNull();
    // Body is not shown while in the error state.
    expect(container.querySelector('#product-1')).toBeNull();

    // Fix the server and retry → new real request → body restored.
    api.setFail(false);
    retry!.click();
    await settle();

    expect(container.querySelector('#products-error')).toBeNull();
    expect(text(container.querySelector('#product-1'))).toBe('Antminer S21 — $3999');
  });
});

describe('streetui-data — router integration cleans up the previous route resource', () => {
  it('does not update detached UI when navigating away while a fetch is in flight', async () => {
    api.setDelay(40); // keep the /products fetch in flight across the navigation

    const captured: Array<Resource<Product[]>> = [];
    app = mountDataApp(container, {
      baseUrl,
      history: createMemoryHistory('/products'),
      onProductsResource: (r) => captured.push(r),
    });

    // Fetch in flight: loading UI present, resource is loading.
    expect(container.querySelector('#products-loading')).not.toBeNull();
    expect(captured).toHaveLength(1);
    const productsResource = captured[0]!;
    expect(productsResource.status.peek()).toBe('loading');

    // Navigate away BEFORE the response arrives. The router disposes the route
    // (ctx.onCleanup → resource.dispose), which aborts the in-flight fetch.
    app.router.navigate('/');
    expect(text(container.querySelector('#home-title'))).toBe('StreetUI Store');
    expect(container.querySelector('#products-loading')).toBeNull();

    // Let the delayed response arrive. The disposed resource must NOT transition
    // to success and must NOT resurrect any product UI in the detached subtree.
    await new Promise((r) => setTimeout(r, 80));

    expect(productsResource.status.peek()).toBe('loading'); // frozen — no post-dispose write
    expect(productsResource.data.peek()).toBeUndefined();
    expect(container.querySelector('#product-1')).toBeNull();
    expect(text(container.querySelector('#home-title'))).toBe('StreetUI Store');
  });

  it('creates a fresh resource per navigation and tears down the previous one', async () => {
    const captured: Array<Resource<Product[]>> = [];
    app = mountDataApp(container, {
      baseUrl,
      history: createMemoryHistory('/products'),
      onProductsResource: (r) => captured.push(r),
    });
    await settle();
    expect(captured).toHaveLength(1);
    expect(container.querySelector('#product-1')).not.toBeNull();

    // Leave and return: a brand-new resource is created for the second visit.
    app.router.navigate('/');
    app.router.navigate('/products');
    await settle();
    expect(captured).toHaveLength(2);
    expect(captured[0]).not.toBe(captured[1]);
    expect(container.querySelector('#product-1')).not.toBeNull();
  });
});
