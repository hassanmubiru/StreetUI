/**
 * StreetJS website — the ONE persistent application shell.
 *
 * Rendered once by mountRouter and kept across navigations: skip link, primary
 * navigation (desktop links + mobile menu), search trigger and dialog, theme
 * toggle, the router outlet, and the footer.
 *
 * The document head is NOT declared here. It is declared once per route via
 * pageHead() inside pageLayout (StreetUI finding F-7: a second head() layer in
 * the shell does not merge with the route's on the client).
 */

import { derived, routerOutlet, ROUTER_OUTLET_KEY, type Signal } from 'streetui';
import type { ContainerDSL, PageDSL, Router } from 'streetui';
import { navLink } from './components.js';
import { PRIMARY_NAV } from './content.js';
import { ds } from './design-system.js';
import { resultId, type SearchState } from './search.js';
import { SEARCH_INPUT_ID } from './search-keys.js';
import type { ThemeController } from './theme.js';

export const DOCS_SITE_URL = 'https://hassanmubiru.github.io/StreetJS/';

export interface ShellContext {
  readonly router: Router;
  readonly theme: ThemeController;
  readonly search: SearchState;
  /** Mobile navigation open state. */
  readonly menuOpen: Signal<boolean>;
  /**
   * Server only: fill the route outlet inline. The node is emitted with the
   * SAME key (ROUTER_OUTLET_KEY) and id ('page-outlet') that `routerOutlet`
   * uses, so client hydration adopts it node-for-node.
   */
  readonly renderOutlet?: (content: ContainerDSL) => void;
}

export function websiteShell(shell: PageDSL, ctx: ShellContext): void {
  const { router, theme, search, menuOpen } = ctx;

  shell.section('skip', (s) => {
    s.link('Skip to content', { href: '#page-outlet', id: 'skip-link', class: ds.skipLink });
  }, { id: 'site-skip' });

  shell.section('nav', (n) => {
    n.container('nav-inner', (inner) => {
      inner.container('brand-lockup', (b) => {
        b.text('S', { id: 'brand-mark', class: ds.brandMark, ariaHidden: true });
        b.link('StreetJS', { href: '/', id: 'brand', class: ds.brand });
      }, { id: 'brand-lockup', class: ds.brandLink });

      inner.container('nav-links', (links) => {
        for (const item of PRIMARY_NAV) navLink(links, router, item);
      }, { id: 'nav-links', class: ds.navLinks });

      inner.container('nav-controls', (right) => {
        right.button('Search', {
          id: 'search-trigger',
          ariaLabel: 'Search (Ctrl+K)',
          onClick: () => search.openSearch(),
          class: ds.searchTrigger,
        });
        right.button(theme.label, { id: 'theme-toggle', onClick: () => theme.cycle(), class: ds.themeToggle });
        right.button(derived(() => (menuOpen.get() ? 'Close menu' : 'Menu')), {
          id: 'menu-toggle',
          ariaControls: 'mobile-menu',
          onClick: () => menuOpen.set(!menuOpen.peek()),
          class: ds.menuToggle,
        });
      }, { id: 'nav-controls', class: ds.navControls });
    }, { id: 'nav-inner', class: ds.navInner });

    n.when(menuOpen, (m) => {
      m.container('mobile-menu', (links) => {
        for (const item of PRIMARY_NAV) {
          navLink(links, router, { ...item, id: `m-${item.id}` }, ds.mobileMenuLink, ds.mobileMenuLinkActive);
        }
      }, { id: 'mobile-menu', class: ds.mobileMenu });
    });
  }, { id: 'site-nav', class: ds.navBar, role: 'navigation', ariaLabel: 'Primary navigation' });

  // Search dialog — modal, focus-trapped, Esc closes (framework behaviour).
  shell.dialog('search-dialog', {
    open: search.open,
    onClose: () => search.closeSearch(),
    initialFocusId: SEARCH_INPUT_ID,
    ariaLabel: 'Search the StreetJS site',
    class: ds.searchPanel,
  }, (d) => {
    d.container('search-header', (h) => {
      h.text('Search', { id: 'search-title', class: ds.searchPanelTitle });
      h.button('Close', { id: 'search-close', onClick: () => search.closeSearch(), class: ds.buttonSecondary });
    }, { id: 'search-header', class: ds.searchPanelHeader });

    d.input({
      id: SEARCH_INPUT_ID,
      type: 'search',
      placeholder: 'Search docs, guides, API, examples…',
      ariaLabel: 'Search query',
      bind: search.query,
      class: ds.searchDialogInput,
    });

    d.text(search.status, { id: 'search-status', class: ds.searchHint, ariaLive: 'polite' });

    d.listOf('search-results', search.results, (item, _i, row) => {
      const rid = resultId(item);
      row.link(`${item.title} (${item.kind})`, { href: item.href, id: rid, class: ds.searchResultLink });
      row.text(item.summary, { id: `${rid}-summary`, class: ds.searchResultMeta });
    }, { id: 'search-results', class: ds.searchResultsList });

    d.when(search.isEmpty, (empty) => {
      empty.text('No matches. Try a shorter term such as "migration", "jwt" or "pool".', {
        id: 'search-empty',
        class: ds.searchEmpty,
      });
    });
  });

  // The active route renders here; the shell persists around it.
  if (ctx.renderOutlet !== undefined) {
    const fill = ctx.renderOutlet;
    shell.container(ROUTER_OUTLET_KEY, (c) => fill(c), { id: 'page-outlet' });
  } else {
    routerOutlet(shell, 'page-outlet');
  }

  shell.section('footer', (f) => {
    f.container('footer-inner', (fi) => {
      fi.text(
        'StreetJS is a TypeScript backend framework. This site is built entirely with StreetUI and records facts from the StreetJS v1.2.8 type declarations.',
        { id: 'footer-text', class: ds.footerText },
      );
      fi.container('footer-links', (links) => {
        links.link('Official docs', { href: DOCS_SITE_URL, external: true, id: 'footer-docs', class: ds.footerLink });
        links.link('About this site', { href: '/about', id: 'footer-about', class: ds.footerLink });
        links.link('Changelog', { href: '/changelog', id: 'footer-changelog', class: ds.footerLink });
      }, { id: 'footer-links', class: ds.footerLinks });
    }, { id: 'footer-inner', class: ds.footerInner });
  }, { id: 'site-footer', class: ds.footer, role: 'contentinfo' });
}
