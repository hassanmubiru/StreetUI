import { describe, it, expect, beforeEach } from 'vitest';
import { signal, effect } from '@streetui/state';
import { resetIdCounter } from '@streetui/core';
import { createRouter } from './router.js';
import { createMemoryHistory } from './history.js';
import { mountRouter, routerOutlet } from './mount-router.js';
import type { RouteDefinition } from './types.js';

beforeEach(() => resetIdCounter());

const text = (el: Element | null) => el?.textContent?.trim() ?? '';

describe('mountRouter — shell + outlet', () => {
  it('mounts a persistent shell and swaps only the outlet on navigation', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const routes: RouteDefinition[] = [
      { path: '/', builder: (page) => page.section('home', (s) => s.heading('Home', { id: 'home-title' })) },
      { path: '/docs', builder: (page) => page.section('docs', (s) => s.heading('Docs', { id: 'docs-title' })) },
      { path: '*', builder: (page) => page.section('nf', (s) => s.heading('Missing', { id: 'nf-title' })) },
    ];
    const router = createRouter({ routes, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, {
      container,
      shell: (shell) => {
        shell.section('nav', (n) => {
          n.link('Home', { href: '/', id: 'nav-home' });
          n.link('Docs', { href: '/docs', id: 'nav-docs' });
        }, { id: 'shell-nav' });
        routerOutlet(shell);
      },
    });

    // Shell present, home route rendered inside the outlet.
    const shellNav = container.querySelector('#shell-nav');
    expect(shellNav).not.toBeNull();
    expect(container.querySelector('#home-title')).not.toBeNull();

    router.navigate('/docs');
    // Same shell element instance persists; outlet content replaced.
    expect(container.querySelector('#shell-nav')).toBe(shellNav);
    expect(container.querySelector('#home-title')).toBeNull();
    expect(container.querySelector('#docs-title')).not.toBeNull();

    router.navigate('/nowhere');
    expect(container.querySelector('#nf-title')).not.toBeNull();

    mounted.unmount();
    container.remove();
  });

  it('renders route content directly into the container when no shell is given', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const routes: RouteDefinition[] = [
      { path: '/', builder: (page) => page.section('home', (s) => s.heading('Home', { id: 'h' })) },
    ];
    const router = createRouter({ routes, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, { container });
    expect(container.querySelector('#h')).not.toBeNull();
    mounted.unmount();
    container.remove();
  });
});

describe('mountRouter — route params, query, reactive state', () => {
  it('passes params and query into the route context', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const routes: RouteDefinition[] = [
      {
        path: '/users/:id',
        builder: (page, ctx) =>
          page.section('u', (s) => {
            s.heading(`User ${ctx.params.id}`, { id: 'user-title' });
            s.text(`tab=${ctx.query.get('tab') ?? 'none'}`, { id: 'user-tab' });
          }),
      },
      { path: '*', builder: (page) => page.section('nf', (s) => s.heading('x', { id: 'nf' })) },
    ];
    const router = createRouter({ routes, history: createMemoryHistory('/users/42?tab=posts') });
    const mounted = mountRouter(router, { container });
    expect(text(container.querySelector('#user-title'))).toBe('User 42');
    expect(text(container.querySelector('#user-tab'))).toBe('tab=posts');
    mounted.unmount();
    container.remove();
  });
});

describe('mountRouter — CRITICAL route lifecycle cleanup', () => {
  it('tears down the previous route effects, subscriptions and DOM on navigation', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const counter = signal(0);
    const effectRuns: number[] = [];
    const cleaned: string[] = [];

    const routes: RouteDefinition[] = [
      {
        path: '/a',
        builder: (page, ctx) => {
          page.section('a', (s) => {
            s.heading('A', { id: 'a-title' });
            s.text(counter, { id: 'a-count' }); // reactive binding on route A
          });
          // A route-scoped effect + explicit cleanup, both registered via onCleanup.
          const stop = effect(() => { effectRuns.push(counter.get()); });
          ctx.onCleanup(stop);
          ctx.onCleanup(() => cleaned.push('a'));
        },
      },
      {
        path: '/b',
        builder: (page) => page.section('b', (s) => s.heading('B', { id: 'b-title' })),
      },
    ];

    const router = createRouter({ routes, history: createMemoryHistory('/a') });
    const mounted = mountRouter(router, { container });

    // Route A live: effect ran once, reactive text reflects the signal.
    expect(effectRuns).toEqual([0]);
    expect(text(container.querySelector('#a-count'))).toBe('0');

    // While A is mounted, a signal change drives the effect and the DOM.
    counter.set(1);
    expect(effectRuns).toEqual([0, 1]);
    expect(text(container.querySelector('#a-count'))).toBe('1');

    const runsBefore = effectRuns.length;

    // Navigate away — A must be fully cleaned up.
    router.navigate('/b');
    expect(cleaned).toEqual(['a']); // onCleanup fired
    expect(container.querySelector('#a-title')).toBeNull(); // A's DOM gone
    expect(container.querySelector('#b-title')).not.toBeNull(); // B mounted

    // PROOF the subscriptions/effects are dead: further signal writes do nothing.
    counter.set(2);
    counter.set(3);
    expect(effectRuns.length).toBe(runsBefore); // effect no longer running
    // (and no throw, no stale DOM update — B has no binding to `counter`)

    mounted.unmount();
    container.remove();
  });
});

describe('mountRouter — link interception', () => {
  function clickAnchor(el: Element) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  }

  it('intercepts internal links (client-side nav) and leaves external links alone', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const routes: RouteDefinition[] = [
      { path: '/', builder: (page) => page.section('home', (s) => s.heading('Home', { id: 'home-title' })) },
      { path: '/docs', builder: (page) => page.section('docs', (s) => s.heading('Docs', { id: 'docs-title' })) },
      { path: '*', builder: (page) => page.section('nf', (s) => s.heading('x', { id: 'nf' })) },
    ];
    const router = createRouter({ routes, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, {
      container,
      shell: (shell) => {
        shell.section('nav', (n) => {
          n.link('Docs', { href: '/docs', id: 'nav-docs' });
          n.link('External', { href: 'https://example.com', external: true, id: 'nav-ext' });
        }, { id: 'nav' });
        routerOutlet(shell);
      },
    });

    // Internal link → intercepted, client-side navigation happens.
    const internal = container.querySelector('#nav-docs')!;
    const internalEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    internal.dispatchEvent(internalEvent);
    expect(internalEvent.defaultPrevented).toBe(true);
    expect(router.currentRoute.get().path).toBe('/docs');
    expect(container.querySelector('#docs-title')).not.toBeNull();

    // External link (target=_blank) → NOT intercepted, route unchanged.
    const external = container.querySelector('#nav-ext')!;
    const externalEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    external.dispatchEvent(externalEvent);
    expect(externalEvent.defaultPrevented).toBe(false);
    expect(router.currentRoute.get().path).toBe('/docs'); // still on docs

    mounted.unmount();
    container.remove();
  });

  it('does not intercept modified clicks (ctrl/meta/new-tab intent)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const routes: RouteDefinition[] = [
      { path: '/', builder: (page) => page.section('home', (s) => s.heading('Home', { id: 'home-title' })) },
      { path: '/docs', builder: (page) => page.section('docs', (s) => s.heading('Docs', { id: 'docs-title' })) },
    ];
    const router = createRouter({ routes, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, {
      container,
      shell: (shell) => {
        shell.section('nav', (n) => n.link('Docs', { href: '/docs', id: 'nav-docs' }), { id: 'nav' });
        routerOutlet(shell);
      },
    });

    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
    container.querySelector('#nav-docs')!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(router.currentRoute.get().path).toBe('/'); // unchanged

    mounted.unmount();
    container.remove();
  });
});

describe('mountRouter — unmount', () => {
  it('empties the container and stops reacting to route changes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const routes: RouteDefinition[] = [
      { path: '/', builder: (page) => page.section('home', (s) => s.heading('Home', { id: 'home-title' })) },
      { path: '/docs', builder: (page) => page.section('docs', (s) => s.heading('Docs', { id: 'docs-title' })) },
    ];
    const router = createRouter({ routes, history: createMemoryHistory('/') });
    const mounted = mountRouter(router, { container });
    expect(container.querySelector('#home-title')).not.toBeNull();

    mounted.unmount();
    expect(container.children.length).toBe(0);

    // Navigating after unmount does not re-render into the container.
    router.navigate('/docs');
    expect(container.querySelector('#docs-title')).toBeNull();
    container.remove();
  });
});
