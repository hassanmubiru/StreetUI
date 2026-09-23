/**
 * Router integration for the full app: a persistent shell (nav + outlet) with
 * two routes. Reuses the same DSL building blocks. Supports SSR + hydration
 * (mountRouter's `hydrate` option) and live client-side navigation.
 */
import { createRouter, mountRouter, routerOutlet, createMemoryHistory, type RouteDefinition, type MountedRouter } from '@streetui/router';
import { createDeps } from './deps.js';
import { buildApp } from './app.js';

export function routes(): RouteDefinition[] {
  return [
    {
      path: '/',
      builder: (page) => buildApp(page, createDeps({ seed: { count: 0, locale: 'en' } })),
    },
    {
      path: '/user/:id',
      builder: (page, ctx) =>
        page.section('user-route', (s) => {
          s.heading('User', { id: 'user-heading', level: 2 });
          s.text(`id=${ctx.params.id ?? ''}`, { id: 'user-id' });
        }),
    },
    { path: '*', builder: (page) => page.section('nf', (s) => s.heading('Not found', { id: 'nf' })) },
  ];
}

export function mountFullApp(container: Element, opts: { path?: string; hydrate?: boolean } = {}): MountedRouter {
  const router = createRouter({ routes: routes(), history: createMemoryHistory(opts.path ?? '/') });
  return mountRouter(router, {
    container,
    ...(opts.hydrate !== undefined ? { hydrate: opts.hydrate } : {}),
    shell: (sh) => {
      sh.section('nav', (n) => {
        n.link('Home', { href: '/', id: 'nav-home' });
        n.link('User 7', { href: '/user/7', id: 'nav-user' });
      }, { id: 'shell-nav' });
      routerOutlet(sh);
    },
  });
}
