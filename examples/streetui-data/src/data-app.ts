/**
 * StreetUI Data — a real data-driven application built on the public StreetUI
 * API: @streetui/router for pages, `resource()` for async data, `errorBoundary`
 * for failure UI, plus signals, `when()`, reactive lists and event handlers.
 *
 * Pipeline per route: DSL → Compiler → Graph → Runtime → Renderer → real DOM.
 *
 * The application NEVER hardcodes product data — it always fetches from a real
 * HTTP endpoint (`GET {baseUrl}/api/products`). See `api-server.ts` for the
 * local server used by the example and its tests.
 *
 * Routes:
 *   /                Home
 *   /products        Product list  (resource + loading/error/retry + reactive list)
 *   /products/:id    Product detail (per-route resource keyed by the :id param)
 *   *                404
 */

import { signal, derived, resource, type Resource } from 'streetui';
import type { ContainerDSL } from 'streetui';
import {
  createRouter,
  mountRouter,
  routerOutlet,
  type Router,
  type RouteDefinition,
  type RouteContext,
  type RouterHistory,
} from 'streetui';
import type { Product } from './api-server.js';

// ── API client (transport-agnostic Promise-returning functions) ────────────────
/** Fetch the full product list. Throws on a non-OK response (surfaced as error). */
export async function fetchProducts(baseUrl: string, signal: AbortSignal): Promise<Product[]> {
  const response = await fetch(`${baseUrl}/api/products`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Product[];
}

/** Fetch a single product by id (derived from the list endpoint). */
export async function fetchProduct(
  baseUrl: string,
  id: number,
  signal: AbortSignal,
): Promise<Product> {
  const products = await fetchProducts(baseUrl, signal);
  const found = products.find((p) => p.id === id);
  if (found === undefined) throw new Error(`Product ${id} not found`);
  return found;
}

export interface DataAppOptions {
  /** Base URL of the product API (e.g. a local server, or the page origin). */
  readonly baseUrl: string;
  readonly history?: RouterHistory;
  /** Test/observability seam: invoked with each products resource as it is created. */
  readonly onProductsResource?: (resource: Resource<Product[]>) => void;
  /** As above, for the detail route's resource. */
  readonly onProductResource?: (resource: Resource<Product>) => void;
}

// ── Reusable layout ─────────────────────────────────────────────────────────────
function pageLayout(
  scope: ContainerDSL,
  opts: { id: string; title: string },
  body: (content: ContainerDSL) => void,
): void {
  scope.section(opts.id, (s) => {
    s.heading(opts.title, { level: 1, id: `${opts.id}-title` });
    s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body` });
  }, { id: `page-${opts.id}` });
}

// ── Route builders ──────────────────────────────────────────────────────────────
function buildRoutes(opts: DataAppOptions): RouteDefinition[] {
  const home: RouteDefinition = {
    path: '/',
    builder: (page) =>
      pageLayout(page, { id: 'home', title: 'StreetUI Store' }, (c) => {
        c.text('A data-driven demo backed by a real HTTP API.', { id: 'home-tagline' });
        c.link('Browse products', { href: '/products', id: 'home-products-link' });
      }),
  };

  const products: RouteDefinition = {
    path: '/products',
    builder: (page, ctx: RouteContext) => {
      // Resource is created per route mount and disposed on navigation via
      // ctx.onCleanup — its in-flight fetch is aborted when leaving the route.
      const res = resource<Product[]>(
        ({ signal }) => fetchProducts(opts.baseUrl, signal),
        { onCleanup: ctx.onCleanup },
      );
      opts.onProductsResource?.(res);

      const list = derived<Product[]>(() => res.data.get() ?? []);
      const showEmpty = derived<boolean>(
        () => res.status.get() === 'success' && list.get().length === 0,
      );

      pageLayout(page, { id: 'products', title: 'Products' }, (c) => {
        c.errorBoundary('products-boundary', (body) => {
          // Loading state (only when there is no data yet).
          body.when(derived(() => res.loading.get() && res.data.get() === undefined), (l) => {
            l.text('Loading products…', { id: 'products-loading' });
          });
          // Data.
          body.listOf('products', list, (item, _i, content) => {
            content.text(`${item.name} — $${item.price}`, { id: `product-${item.id}` });
            content.link('Details', { href: `/products/${item.id}`, id: `product-link-${item.id}` });
          }, { id: 'products-list' });
          // Empty state.
          body.when(showEmpty, (e) => {
            e.text('No products available.', { id: 'products-empty' });
          });
        }, {
          source: res.error,
          onRetry: () => { void res.refetch(); },
          fallback: (fb, error, retry) => {
            fb.text(`Unable to load products (${(error as Error).message}).`, { id: 'products-error' });
            fb.button('Retry', { id: 'products-retry', onClick: retry });
          },
        });
      });
    },
  };

  const productDetail: RouteDefinition = {
    path: '/products/:id',
    builder: (page, ctx: RouteContext) => {
      const id = Number(ctx.params.id ?? '0');
      const res = resource<Product>(
        ({ signal }) => fetchProduct(opts.baseUrl, id, signal),
        { onCleanup: ctx.onCleanup },
      );
      opts.onProductResource?.(res);

      const name = derived(() => res.data.get()?.name ?? '');
      const price = derived(() => res.data.get()?.price ?? 0);

      pageLayout(page, { id: 'detail', title: 'Product' }, (c) => {
        c.errorBoundary('detail-boundary', (body) => {
          body.when(res.loading, (l) => l.text('Loading…', { id: 'detail-loading' }));
          body.when(derived(() => res.status.get() === 'success'), (ok) => {
            ok.heading(name, { level: 2, id: 'detail-name' });
            ok.text(price, { id: 'detail-price' });
          });
          body.link('Back to products', { href: '/products', id: 'detail-back' });
        }, {
          source: res.error,
          onRetry: () => { void res.refetch(); },
          fallback: (fb, error, retry) => {
            fb.text(`Unable to load product (${(error as Error).message}).`, { id: 'detail-error' });
            fb.button('Retry', { id: 'detail-retry', onClick: retry });
          },
        });
      });
    },
  };

  const notFound: RouteDefinition = {
    path: '*',
    builder: (page, ctx: RouteContext) =>
      pageLayout(page, { id: 'notfound', title: '404 — Not found' }, (c) => {
        c.text(`Nothing here at ${ctx.path}.`, { id: 'notfound-text' });
        c.link('Go home', { href: '/', id: 'notfound-home' });
      }),
  };

  return [home, products, productDetail, notFound];
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function dataShell(shell: ContainerDSL, router: Router): void {
  shell.section('nav', (n) => {
    n.heading('StreetUI Store', { level: 1, id: 'brand' });
    n.link('Home', { href: '/', id: 'nav-home' });
    n.link('Products', { href: '/products', id: 'nav-products' });
  }, { id: 'site-nav' });
  routerOutlet(shell);
}

// ── App factory + mount ─────────────────────────────────────────────────────────
export interface DataApp {
  readonly router: Router;
}

export function createDataApp(opts: DataAppOptions): DataApp {
  const routesConfig =
    opts.history !== undefined
      ? { routes: buildRoutes(opts), history: opts.history }
      : { routes: buildRoutes(opts) };
  const router = createRouter(routesConfig);
  return { router };
}

export interface MountedDataApp extends DataApp {
  unmount(): void;
}

export function mountDataApp(container: Element, opts: DataAppOptions): MountedDataApp {
  const { router } = createDataApp(opts);
  const mounted = mountRouter(router, {
    container,
    shell: (shell) => dataShell(shell, router),
  });
  return { router, unmount: () => mounted.unmount() };
}
