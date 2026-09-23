import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { createRouter } from './router.js';
import { createMemoryHistory } from './history.js';
import { mountRouter, routerOutlet } from './mount-router.js';
import type { RouteDefinition } from './types.js';

beforeEach(() => resetIdCounter());

const text = (el: Element | null) => el?.textContent?.trim() ?? '';

/**
 * Router hydration. The "server" markup is produced by rendering the router once
 * (the browser and server renderers consume the same model and emit identical
 * HTML by design). That HTML is planted into a fresh container which is then
 * hydrated: the persistent shell and the initial route adopt the existing DOM,
 * and client-side navigation takes over afterwards.
 */
const routes: RouteDefinition[] = [
  {
    path: '/docs/:section',
    builder: (page, ctx) =>
      page.section('doc', (s) => {
        s.heading(ctx.params.section ?? '', { id: 'section-title' });
        s.text(`q=${ctx.query.get('q') ?? 'none'}`, { id: 'section-q' });
      }),
  },
  { path: '*', builder: (page) => page.section('nf', (s) => s.heading('missing', { id: 'nf' })) },
];

function serverHtml(path: string): string {
  resetIdCounter();
  const container = document.createElement('div');
  const router = createRouter({ routes, history: createMemoryHistory(path) });
  const mounted = mountRouter(router, {
    container,
    shell: (sh) => {
      sh.section('nav', (n) => {
        n.link('Intro', { href: '/docs/intro', id: 'nav-intro' });
        n.link('API', { href: '/docs/api', id: 'nav-api' });
      }, { id: 'shell-nav' });
      routerOutlet(sh);
    },
  });
  const html = container.innerHTML;
  mounted.unmount();
  return html;
}

describe('mountRouter — hydration', () => {
  it('adopts server shell + initial route, resolves route params, then navigates client-side', () => {
    const html = serverHtml('/docs/intro?q=hello');

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;

    // Snapshot the parsed server nodes so we can prove adoption (not recreation).
    const shellNavBefore = container.querySelector('#shell-nav');
    expect(shellNavBefore).not.toBeNull();
    // Server already resolved the dynamic param and query into the markup.
    expect(text(container.querySelector('#section-title'))).toBe('intro');
    expect(text(container.querySelector('#section-q'))).toBe('q=hello');

    resetIdCounter();
    const router = createRouter({ routes, history: createMemoryHistory('/docs/intro?q=hello') });
    const mounted = mountRouter(router, {
      container,
      hydrate: true,
      shell: (sh) => {
        sh.section('nav', (n) => {
          n.link('Intro', { href: '/docs/intro', id: 'nav-intro' });
          n.link('API', { href: '/docs/api', id: 'nav-api' });
        }, { id: 'shell-nav' });
        routerOutlet(sh);
      },
    });

    // Shell adopted — same element object, not rebuilt.
    expect(container.querySelector('#shell-nav')).toBe(shellNavBefore);
    // Initial route hydrated from the server HTML (same param).
    expect(text(container.querySelector('#section-title'))).toBe('intro');

    // Client-side navigation is live after hydration; the shell persists.
    router.navigate('/docs/api');
    expect(container.querySelector('#shell-nav')).toBe(shellNavBefore);
    expect(text(container.querySelector('#section-title'))).toBe('api');

    mounted.unmount();
    container.remove();
  });

  it('intercepts internal links after hydration (client-side nav)', () => {
    const html = serverHtml('/docs/intro');
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;

    resetIdCounter();
    const router = createRouter({ routes, history: createMemoryHistory('/docs/intro') });
    const mounted = mountRouter(router, {
      container,
      hydrate: true,
      shell: (sh) => {
        sh.section('nav', (n) => {
          n.link('Intro', { href: '/docs/intro', id: 'nav-intro' });
          n.link('API', { href: '/docs/api', id: 'nav-api' });
        }, { id: 'shell-nav' });
        routerOutlet(sh);
      },
    });

    const apiLink = container.querySelector('#nav-api')!;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    apiLink.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(router.currentRoute.get().params.section).toBe('api');
    expect(text(container.querySelector('#section-title'))).toBe('api');

    mounted.unmount();
    container.remove();
  });

  it('adopts the initial route content node-for-node (DOM identity preserved)', () => {
    const html = serverHtml('/docs/intro?q=hello');
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;

    // Capture the exact server element objects for the route content (inside the
    // outlet), not just the persistent shell.
    const serverTitle = container.querySelector('#section-title');
    const serverQ = container.querySelector('#section-q');
    expect(serverTitle).not.toBeNull();
    expect(serverQ).not.toBeNull();

    resetIdCounter();
    const router = createRouter({ routes, history: createMemoryHistory('/docs/intro?q=hello') });
    const mounted = mountRouter(router, {
      container,
      hydrate: true,
      shell: (sh) => {
        sh.section('nav', (n) => {
          n.link('Intro', { href: '/docs/intro', id: 'nav-intro' });
          n.link('API', { href: '/docs/api', id: 'nav-api' });
        }, { id: 'shell-nav' });
        routerOutlet(sh);
      },
    });

    // The route content elements are the SAME objects the server produced — the
    // v0.8 router-outlet adoption fix (previously these were re-rendered fresh).
    expect(container.querySelector('#section-title')).toBe(serverTitle);
    expect(container.querySelector('#section-q')).toBe(serverQ);
    // Params and query were resolved identically on both sides.
    expect(text(serverTitle)).toBe('intro');
    expect(text(serverQ)).toBe('q=hello');

    mounted.unmount();
    container.remove();
  });

  it('performs a normal fresh route transition on client navigation (no stale adoption)', () => {
    const html = serverHtml('/docs/intro');
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;

    const serverTitle = container.querySelector('#section-title');

    resetIdCounter();
    const router = createRouter({ routes, history: createMemoryHistory('/docs/intro') });
    const mounted = mountRouter(router, {
      container,
      hydrate: true,
      shell: (sh) => {
        sh.section('nav', (n) => {
          n.link('API', { href: '/docs/api', id: 'nav-api' });
        }, { id: 'shell-nav' });
        routerOutlet(sh);
      },
    });

    // Initial route adopted the server node.
    expect(container.querySelector('#section-title')).toBe(serverTitle);

    // Navigating mounts a fresh subtree: the new title element is a different
    // object, the old one is detached, and content updates correctly.
    router.navigate('/docs/api');
    const afterNav = container.querySelector('#section-title');
    expect(afterNav).not.toBe(serverTitle);
    expect(text(afterNav)).toBe('api');
    // Exactly one route title exists (no duplicate/stale content left behind).
    expect(container.querySelectorAll('#section-title').length).toBe(1);

    mounted.unmount();
    container.remove();
  });
});
