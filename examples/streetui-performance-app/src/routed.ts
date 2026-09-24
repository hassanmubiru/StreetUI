/**
 * The interactive multi-route client application: a persistent shell
 * (header/nav/sidebar) with a router outlet, and the five routes required by
 * the spec — `/`, `/dashboard`, `/users`, `/users/:id`, `/settings`. Uses the
 * unified `streetui` router API and supports client-side navigation, memory or
 * browser history, and hydration of a server-rendered shell.
 */
import {
  createRouter,
  mountRouter,
  createMemoryHistory,
  createBrowserHistory,
  type RouteDefinition,
  type MountedRouter,
  type Router,
} from 'streetui';
import { createDeps, ThemeContext, type AppDeps, type Theme } from './deps.js';
import { buildShell } from './shell.js';
import {
  buildOverview,
  buildDashboard,
  buildUsers,
  buildSettings,
  buildUserDetail,
} from './views.js';

export function routes(deps: AppDeps): RouteDefinition[] {
  return [
    { path: '/', builder: (page) => buildOverview(page, deps) },
    { path: '/dashboard', builder: (page) => buildDashboard(page, deps) },
    { path: '/users', builder: (page) => buildUsers(page, deps) },
    { path: '/users/:id', builder: (page, ctx) => buildUserDetail(page, deps, ctx) },
    { path: '/settings', builder: (page) => buildSettings(page, deps) },
    { path: '*', builder: (page) => page.section('nf', (s) => s.heading('Not found', { id: 'nf', level: 2 })) },
  ];
}

export interface MountPerfOptions {
  readonly path?: string;
  readonly hydrate?: boolean;
  readonly useBrowserHistory?: boolean;
  readonly deps?: AppDeps;
  readonly theme?: Theme;
}

export interface MountedPerfApp {
  readonly deps: AppDeps;
  readonly router: Router;
  readonly mounted: MountedRouter;
  unmount(): void;
}

export function mountPerfApp(container: Element, opts: MountPerfOptions = {}): MountedPerfApp {
  const deps = opts.deps ?? createDeps();
  const theme = opts.theme ?? { name: 'light' };
  const history = opts.useBrowserHistory
    ? createBrowserHistory()
    : createMemoryHistory(opts.path ?? '/');
  const router = createRouter({ routes: routes(deps), history });

  const mounted = ThemeContext.provide(theme, () =>
    mountRouter(router, {
      container,
      ...(opts.hydrate !== undefined ? { hydrate: opts.hydrate } : {}),
      shell: (sh) => buildShell(sh, router, deps),
    }),
  );

  return {
    deps,
    router,
    mounted,
    unmount(): void {
      mounted.unmount();
      router.destroy();
      deps.userDetail.dispose();
      deps.settingsForm.dispose();
    },
  };
}
