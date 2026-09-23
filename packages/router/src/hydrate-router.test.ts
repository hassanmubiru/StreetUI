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
});
