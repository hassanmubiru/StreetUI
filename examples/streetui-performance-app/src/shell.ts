/**
 * The persistent application shell: a header, primary navigation, and a
 * sidebar, wrapped around the router outlet. Rendered once and reused across
 * every route transition (only the outlet content is swapped).
 */
import { derived, type PageDSL } from 'streetui';
import { routerOutlet, type Router } from 'streetui';
import { type AppDeps, ThemeContext } from './deps.js';

export function buildShell(shell: PageDSL, router: Router, deps: AppDeps): void {
  const { i18n } = deps;
  const theme = ThemeContext.consume();

  shell.section('header', (h) => {
    h.heading(i18n.t('appTitle'), { id: 'app-title', level: 1 });
    h.text(derived(() => `theme:${theme.name}`), { id: 'theme-flag' });
    h.button('lang', {
      id: 'lang-toggle',
      onClick: () => i18n.setLocale(i18n.locale.peek() === 'en' ? 'fr' : 'en'),
    });
  }, { id: 'app-header' });

  shell.section('nav', (n) => {
    n.link(i18n.t('navHome'), { href: '/', id: 'nav-home' });
    n.link(i18n.t('navDashboard'), { href: '/dashboard', id: 'nav-dashboard' });
    n.link(i18n.t('navUsers'), { href: '/users', id: 'nav-users' });
    n.link(i18n.t('navSettings'), { href: '/settings', id: 'nav-settings' });
  }, { id: 'app-nav' });

  shell.section('sidebar', (s) => {
    s.text(derived(() => i18n.translate('totalUsers', { count: deps.totalCount.get() })), { id: 'side-total' });
    s.text(derived(() => i18n.translate('activeUsers', { count: deps.activeCount.get() })), { id: 'side-active' });
  }, { id: 'app-sidebar' });

  // The outlet the router fills with the active route's page tree.
  routerOutlet(shell);
}
