/**
 * Compilation entry for the SSR + hydration path.
 *
 * `compilePage` builds ONE composed page — header, navigation, sidebar and the
 * body of a single route — so it can be `renderToString`-ed on the server and
 * hydrated node-for-node on the client (no router outlet indirection). The
 * interactive multi-route client app lives in `routed.ts`.
 */
import { streetui, derived } from 'streetui';
import { compile, type CompiledApplication, type PageDSL } from 'streetui';
import { ThemeContext, type AppDeps, type Theme } from './deps.js';
import {
  buildOverview,
  buildDashboard,
  buildUsers,
  buildControls,
  buildSettings,
} from './views.js';

export type ViewName = 'overview' | 'dashboard' | 'users' | 'controls' | 'settings';

const VIEWS: Record<ViewName, (page: PageDSL, deps: AppDeps) => void> = {
  overview: buildOverview,
  dashboard: buildDashboard,
  users: buildUsers,
  controls: buildControls,
  settings: buildSettings,
};

/** Header + nav + sidebar chrome, then the selected route body — one flat page. */
function buildComposedPage(page: PageDSL, deps: AppDeps, view: ViewName): void {
  const { i18n } = deps;
  const theme = ThemeContext.consume();

  page.section('header', (h) => {
    h.heading(i18n.t('appTitle'), { id: 'app-title', level: 1 });
    h.text(derived(() => `theme:${theme.name}`), { id: 'theme-flag' });
    h.button('lang', {
      id: 'lang-toggle',
      onClick: () => i18n.setLocale(i18n.locale.peek() === 'en' ? 'fr' : 'en'),
    });
  }, { id: 'app-header' });

  page.section('nav', (n) => {
    n.link(i18n.t('navHome'), { href: '/', id: 'nav-home' });
    n.link(i18n.t('navDashboard'), { href: '/dashboard', id: 'nav-dashboard' });
    n.link(i18n.t('navUsers'), { href: '/users', id: 'nav-users' });
    n.link(i18n.t('navSettings'), { href: '/settings', id: 'nav-settings' });
  }, { id: 'app-nav' });

  page.section('sidebar', (s) => {
    s.text(derived(() => i18n.translate('totalUsers', { count: deps.totalCount.get() })), { id: 'side-total' });
    s.text(derived(() => i18n.translate('activeUsers', { count: deps.activeCount.get() })), { id: 'side-active' });
  }, { id: 'app-sidebar' });

  VIEWS[view](page, deps);
}

export function compilePage(
  deps: AppDeps,
  view: ViewName = 'users',
  theme: Theme = { name: 'light' },
): CompiledApplication {
  return ThemeContext.provide(theme, () => {
    const app = streetui.app({ name: 'performance-app' });
    app.page('home', (page) => buildComposedPage(page, deps, view));
    return compile(app);
  });
}

export * from './deps.js';
export * from './data.js';
export * from './views.js';
