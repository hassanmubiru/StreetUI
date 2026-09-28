/**
 * Router route transitions (§9).
 *
 * A configured `transition` cross-fades on client-side navigation: the incoming
 * route mounts into its own host wrapper and plays `enter`, while the outgoing
 * route's disposal (route-scoped cleanup + DOM removal) is DEFERRED until its
 * `leave` animation ends. History, params and lifecycle are untouched — only the
 * teardown timing changes. The initial mount/hydration is never animated.
 *
 * happy-dom dispatches no `transitionend`, so completion is driven by dispatching
 * an explicit `transitionend` on the animating host (deterministic, no timers). A
 * large duration keeps the fallback timer from firing mid-test.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { createRouter } from './router.js';
import { createMemoryHistory } from './history.js';
import { mountRouter } from './mount-router.js';
import type { RouteDefinition } from './types.js';

beforeEach(() => resetIdCounter());

const FADE = { name: 'fade', duration: 100000 } as const;

/** End the running transition on `el` by dispatching a real transitionend. */
function endTransition(el: Element): void {
  el.dispatchEvent(new Event('transitionend', { bubbles: true }));
}

const routes: RouteDefinition[] = [
  { path: '/', builder: (page) => page.section('home', (s) => s.heading('Home', { id: 'home-title' })) },
  { path: '/docs', builder: (page) => page.section('docs', (s) => s.heading('Docs', { id: 'docs-title' })) },
];

describe('mountRouter — route transitions (§9)', () => {
  it('does NOT animate the initial render (matches server paint, §22)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const router = createRouter({ routes, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, { container, transition: FADE });

    // Home is present immediately; no enter classes linger on the initial host.
    expect(container.querySelector('#home-title')).not.toBeNull();
    expect(container.querySelector('.fade-enter-active')).toBeNull();
    expect(container.querySelector('.fade-enter-from')).toBeNull();

    mounted.unmount();
    container.remove();
  });

  it('defers the outgoing route until its leave animation ends; enters the new one', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const router = createRouter({ routes, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, { container, transition: FADE });

    expect(container.querySelector('#home-title')).not.toBeNull();

    router.navigate('/docs');

    // Both routes coexist during the cross-fade: old deferred, new entering.
    expect(container.querySelector('#home-title')).not.toBeNull(); // leaving, still in DOM
    expect(container.querySelector('#docs-title')).not.toBeNull(); // entered
    const leaveHost = container.querySelector('.fade-leave-active');
    const enterHost = container.querySelector('.fade-enter-active');
    expect(leaveHost).not.toBeNull();
    expect(enterHost).not.toBeNull();

    // Finish the leave → old route removed from the DOM now.
    endTransition(leaveHost!);
    expect(container.querySelector('#home-title')).toBeNull();
    // New route remains; finish its enter → enter classes cleared.
    endTransition(enterHost!);
    expect(container.querySelector('#docs-title')).not.toBeNull();
    expect(container.querySelector('.fade-enter-active')).toBeNull();

    mounted.unmount();
    container.remove();
  });

  it('rapid navigation cancels the in-flight enter (no overlapping runs)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const three: RouteDefinition[] = [
      ...routes,
      { path: '/about', builder: (page) => page.section('about', (s) => s.heading('About', { id: 'about-title' })) },
    ];
    const router = createRouter({ routes: three, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, { container, transition: FADE });

    router.navigate('/docs'); // home leaving, docs entering
    router.navigate('/about'); // docs' enter aborted, docs now leaving, about entering

    // The final route is present and entering.
    expect(container.querySelector('#about-title')).not.toBeNull();
    // Exactly one host is entering (the aborted docs enter left no active class).
    expect(container.querySelectorAll('.fade-enter-active').length).toBe(1);

    mounted.unmount();
    // After unmount everything is torn down.
    expect(container.querySelector('#about-title')).toBeNull();
    expect(container.querySelector('#docs-title')).toBeNull();
    expect(container.querySelector('#home-title')).toBeNull();
    container.remove();
  });

  it('runs route-scoped cleanup only when the leave completes, not on navigate', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let cleaned = 0;
    const r: RouteDefinition[] = [
      {
        path: '/',
        builder: (page, ctx) => {
          ctx.onCleanup(() => {
            cleaned += 1;
          });
          page.section('home', (s) => s.heading('Home', { id: 'home-title' }));
        },
      },
      { path: '/docs', builder: (page) => page.section('docs', (s) => s.heading('Docs', { id: 'docs-title' })) },
    ];
    const router = createRouter({ routes: r, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, { container, transition: FADE });

    router.navigate('/docs');
    // Departing route's resources still alive mid-animation.
    expect(cleaned).toBe(0);

    endTransition(container.querySelector('.fade-leave-active')!);
    // Cleanup ran exactly once when the leave finished.
    expect(cleaned).toBe(1);

    mounted.unmount();
    container.remove();
  });
});

describe('mountRouter — no transition (unchanged synchronous behaviour)', () => {
  it('swaps content synchronously and never emits transition classes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const router = createRouter({ routes, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, { container });

    router.navigate('/docs');
    expect(container.querySelector('#home-title')).toBeNull(); // gone immediately
    expect(container.querySelector('#docs-title')).not.toBeNull();
    expect(container.querySelector('[class*="fade"]')).toBeNull();

    mounted.unmount();
    container.remove();
  });
});
