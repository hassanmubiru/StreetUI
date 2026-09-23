import { describe, it, expect, beforeEach } from 'vitest';
import { createRouter } from './router.js';
import { createMemoryHistory, createBrowserHistory } from './history.js';
import type { RouteDefinition } from './types.js';

/** Minimal route table — builders are irrelevant to the core-routing tests. */
const routes: RouteDefinition[] = [
  { path: '/', builder: () => {} },
  { path: '/docs', builder: () => {} },
  { path: '/docs/:section', builder: () => {} },
  { path: '/users/:id', builder: () => {} },
  { path: '/products', builder: () => {} },
  { path: '*', builder: () => {} },
];

describe('createRouter — matching & current route', () => {
  it('resolves the initial route from history', () => {
    const router = createRouter({ routes, history: createMemoryHistory('/docs') });
    expect(router.currentRoute.get().pattern).toBe('/docs');
    expect(router.currentRoute.get().path).toBe('/docs');
    router.destroy();
  });

  it('exposes params for dynamic routes', () => {
    const router = createRouter({ routes, history: createMemoryHistory('/users/123') });
    expect(router.currentRoute.get().params).toEqual({ id: '123' });
    router.destroy();
  });

  it('parses query strings into URLSearchParams', () => {
    const router = createRouter({ routes, history: createMemoryHistory('/products?page=2&sort=asc') });
    const q = router.currentRoute.get().query;
    expect(q.get('page')).toBe('2');
    expect(q.get('sort')).toBe('asc');
    expect(router.currentRoute.get().path).toBe('/products'); // query excluded from path
    router.destroy();
  });
});

describe('createRouter — programmatic navigation', () => {
  let router: ReturnType<typeof createRouter>;
  beforeEach(() => {
    router = createRouter({ routes, history: createMemoryHistory('/') });
  });

  it('navigate() updates the current route reactively', () => {
    const seen: string[] = [];
    router.currentRoute.subscribe((m) => seen.push(m.path));
    router.navigate('/docs');
    expect(router.currentRoute.get().pattern).toBe('/docs');
    router.navigate('/users/7');
    expect(router.currentRoute.get().params).toEqual({ id: '7' });
    expect(seen).toEqual(['/docs', '/users/7']);
    router.destroy();
  });

  it('navigate() carries query strings through', () => {
    router.navigate('/products?page=3');
    expect(router.currentRoute.get().query.get('page')).toBe('3');
    router.destroy();
  });

  it('back() and forward() walk history deterministically', () => {
    router.navigate('/docs');
    router.navigate('/products');
    expect(router.currentRoute.get().path).toBe('/products');
    router.back();
    expect(router.currentRoute.get().path).toBe('/docs');
    router.back();
    expect(router.currentRoute.get().path).toBe('/');
    router.forward();
    expect(router.currentRoute.get().path).toBe('/docs');
    router.destroy();
  });

  it('replace: true does not add a back entry', () => {
    router.navigate('/docs');
    router.navigate('/products', { replace: true });
    expect(router.currentRoute.get().path).toBe('/products');
    router.back(); // should land on '/', not '/docs'
    expect(router.currentRoute.get().path).toBe('/');
    router.destroy();
  });
});

describe('createRouter — 404 fallback', () => {
  it('uses the provided * route for unknown paths', () => {
    const router = createRouter({ routes, history: createMemoryHistory('/does/not/exist') });
    expect(router.currentRoute.get().pattern).toBe('*');
    expect(router.currentRoute.get().isFallback).toBe(true);
    router.destroy();
  });

  it('falls back to a built-in 404 when no * route is supplied', () => {
    const noWild: RouteDefinition[] = [{ path: '/', builder: () => {} }];
    const router = createRouter({ routes: noWild, history: createMemoryHistory('/missing') });
    expect(router.currentRoute.get().isFallback).toBe(true);
    router.destroy();
  });
});

describe('createRouter — isActive', () => {
  it('is reactive and supports prefix vs exact matching', () => {
    const router = createRouter({ routes, history: createMemoryHistory('/docs/getting-started') });
    const docsActive = router.isActive('/docs');
    const docsExact = router.isActive('/docs', { exact: true });
    const homeActive = router.isActive('/');

    expect(docsActive.get()).toBe(true); // prefix match
    expect(docsExact.get()).toBe(false); // not the exact page
    expect(homeActive.get()).toBe(false); // '/' never prefix-matches other paths

    router.navigate('/docs');
    expect(docsExact.get()).toBe(true); // now exactly on /docs

    router.navigate('/');
    expect(homeActive.get()).toBe(true);
    expect(docsActive.get()).toBe(false);
    router.destroy();
  });
});

describe('createRouter — browser history (pushState / popstate / back)', () => {
  it('navigate uses pushState (no reload) and popstate updates the route', async () => {
    window.history.replaceState({}, '', '/');
    const router = createRouter({ routes, history: createBrowserHistory() });
    expect(router.currentRoute.get().path).toBe('/');

    router.navigate('/docs');
    expect(window.location.pathname).toBe('/docs');
    expect(router.currentRoute.get().pattern).toBe('/docs');

    router.navigate('/products?page=2');
    expect(window.location.search).toBe('?page=2');
    expect(router.currentRoute.get().query.get('page')).toBe('2');

    router.back(); // async popstate → returns to /docs
    await new Promise((r) => setTimeout(r, 20));
    expect(router.currentRoute.get().path).toBe('/docs');

    router.destroy();
  });
});
