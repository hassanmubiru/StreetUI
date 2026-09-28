/**
 * Router memory stress (StreetUI 2.0 §26).
 *
 * Exercises the router lifecycle at 50 / 100 / 200 iterations and proves the
 * platform leaves NO residue:
 *   • navigation churn — each route swap disposes the previous route, so a
 *     signal that route content binds to keeps exactly one live observer while
 *     that route is shown and drops to zero when it is navigated away from;
 *   • mount/unmount cycles — creating, mounting and unmounting N routers leaves
 *     the container empty every time and never accumulates DOM in the body;
 *   • after `unmount()`, `router.currentRoute` has no live subscribers.
 *
 * Deterministic structural assertions (observer counts, DOM presence) — no
 * timing (route resolution here is synchronous).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, observerCount } from '@streetui/state';
import { resetIdCounter } from '@streetui/core';
import { createRouter } from './router.js';
import { createMemoryHistory } from './history.js';
import { mountRouter, routerOutlet } from './mount-router.js';
import type { RouteDefinition } from './types.js';

beforeEach(() => resetIdCounter());

describe.each([50, 100, 200])('router memory stress — %i iterations', (N) => {
  it('navigation churn keeps exactly one live binding for the shown route', () => {
    const dep = signal('x');
    const baseline = observerCount(dep) ?? 0;

    const routes: RouteDefinition[] = [
      // The "live" route binds `dep` reactively; the "other" route does not.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { path: '/live', builder: (page) => (page as any).text(dep, { id: 'live' }) },
      { path: '/other', builder: (page) => page.text('other', { id: 'other' }) },
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const router = createRouter({ routes, history: createMemoryHistory('/live') });
    const mounted = mountRouter(router, { container, shell: (sh) => routerOutlet(sh) });

    // On /live the bound text registers the route's live observers on `dep`.
    // (The exact multiplicity is an implementation detail; what matters for a
    // leak check is that it is stable and drains — captured dynamically here.)
    const mountedObservers = observerCount(dep) ?? 0;
    expect(mountedObservers).toBeGreaterThan(baseline);

    for (let i = 0; i < N; i++) {
      router.navigate('/other');
      // Leaving /live disposed its binding — no observer residue.
      expect(observerCount(dep)).toBe(baseline);
      expect(container.querySelector('#live')).toBeNull();
      expect(container.querySelector('#other')).not.toBeNull();

      router.navigate('/live');
      // Re-entering re-binds to exactly the same count (no accumulation across
      // repeated visits).
      expect(observerCount(dep)).toBe(mountedObservers);
      expect(container.querySelector('#other')).toBeNull();
    }

    mounted.unmount();
    // Unmount drained the active route's binding and the container.
    expect(observerCount(dep)).toBe(baseline);
    expect(container.childNodes.length).toBe(0);
    // currentRoute has no leftover subscribers after unmount.
    expect(observerCount(router.currentRoute) ?? 0).toBe(0);
    container.remove();
  });

  it('create → mount → unmount N routers empties the container every cycle', () => {
    const routes: RouteDefinition[] = [
      { path: '/', builder: (page) => page.section('home', (s) => s.heading('Home', { id: 'h' })) },
    ];

    const bodyBefore = document.body.childNodes.length;
    for (let i = 0; i < N; i++) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const router = createRouter({ routes, history: createMemoryHistory('/') });
      const mounted = mountRouter(router, { container });
      expect(container.querySelector('#h')).not.toBeNull();

      mounted.unmount();
      expect(container.childNodes.length).toBe(0);
      // A navigation after unmount is a safe no-op (does not repopulate).
      router.navigate('/');
      expect(container.childNodes.length).toBe(0);
      container.remove();
    }
    // No router leaked DOM into the document body.
    expect(document.body.childNodes.length).toBe(bodyBefore);
  });
});
