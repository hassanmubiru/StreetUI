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

import { derived, ROUTER_OUTLET_KEY, type Signal } from 'streetui';
import type { ContainerDSL, PageDSL, Router } from 'streetui';
import { navLink } from './components.js';
import { NPM_URL, PRIMARY_NAV, SECONDARY_NAV } from './content.js';
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

  // One app-root wrapper carries the base font, colour and page background, so
  // every descendant inherits the sans stack and themed surface (without it the
  // body default — a serif face on a white page — leaked through).
  shell.container('app-root', (root) => {

  root.section('skip', (s) => {
    s.link('Skip to content', { href: '#page-outlet', id: 'skip-link', class: ds.skipLink });
  }, { id: 'site-skip' });

  root.section('nav', (n) => {
    n.container('nav-inner', (inner) => {
      inner.container('brand-lockup', (b) => {
        b.text('S', { id: 'brand-mark', class: ds.brandMark, ariaHidden: true });
        b.link('StreetJS', { href: '/', id: 'brand', class: ds.brand });
      }, { id: 'brand-lockup', class: ds.brandLink });

      inner.container('nav-links', (links) => {
        for (const item of PRIMARY_NAV) navLink(links, router, item);
      }, { id: 'nav-links', class: ds.navLinks });

      inner.container('nav-controls', (right) => {
        right.link('npm', { href: NPM_URL, external: true, id: 'nav-npm', class: ds.navExternal });
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
        right.link('Get started', { href: '/getting-started', id: 'nav-cta', class: ds.navCta });
      }, { id: 'nav-controls', class: ds.navControls });
    }, { id: 'nav-inner', class: ds.navInner });

    n.when(menuOpen, (m) => {
      m.container('mobile-menu', (links) => {
        for (const item of PRIMARY_NAV) {
          navLink(links, router, { ...item, id: `m-${item.id}` }, ds.mobileMenuLink, ds.mobileMenuLinkActive);
        }
        for (const item of SECONDARY_NAV) {
          navLink(links, router, { ...item, id: `m-${item.id}` }, ds.mobileMenuLink, ds.mobileMenuLinkActive);
        }
        links.link('npm', { href: NPM_URL, external: true, id: 'm-nav-npm', class: ds.mobileMenuLink });
      }, { id: 'mobile-menu', class: ds.mobileMenu });
    });
  }, { id: 'site-nav', class: ds.navBar, role: 'navigation', ariaLabel: 'Primary navigation' });

  // Search dialog — modal, focus-trapped, Esc closes (framework behaviour).
  root.dialog('search-dialog', {
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
    root.container(ROUTER_OUTLET_KEY, (c) => fill(c), { id: 'page-outlet', role: 'main' });
  } else {
    // Use container directly (same as routerOutlet but with role="main" for landmark)
    root.container(ROUTER_OUTLET_KEY, () => { /* filled by the router at runtime */ }, { id: 'page-outlet', role: 'main' });
  }

  root.section('footer', (f) => {
    f.container('footer-inner', (fi) => {
      fi.container('footer-brand', (fb) => {
        fb.container('footer-brand-lockup', (bl) => {
          bl.text('S', { id: 'footer-mark', class: ds.footerMark, ariaHidden: true });
          bl.text('StreetJS', { id: 'footer-wordmark', class: ds.footerWordmark });
        }, { id: 'footer-brand-lockup', class: ds.footerBrandLockup });
        fb.text(
          'A TypeScript backend framework for Node.js. This site is built entirely with StreetUI and records facts from the StreetJS v1.2.8 type declarations.',
          { id: 'footer-text', class: ds.footerText },
        );
      }, { id: 'footer-brand', class: ds.footerBrand });

      fi.container('footer-cols', (cols) => {
        cols.container('footer-col-docs', (c) => {
          c.text('Documentation', { id: 'footer-col-docs-h', class: ds.footerColTitle });
          c.link('Getting started', { href: '/getting-started', id: 'footer-getting', class: ds.footerLink });
          c.link('Docs', { href: '/docs', id: 'footer-docs', class: ds.footerLink });
          c.link('API reference', { href: '/api', id: 'footer-api', class: ds.footerLink });
          c.link('Guides', { href: '/guides', id: 'footer-guides', class: ds.footerLink });
        }, { id: 'footer-col-docs', class: ds.footerCol });
        cols.container('footer-col-explore', (c) => {
          c.text('Explore', { id: 'footer-col-explore-h', class: ds.footerColTitle });
          c.link('Examples', { href: '/examples', id: 'footer-examples', class: ds.footerLink });
          c.link('Playground', { href: '/playground', id: 'footer-playground', class: ds.footerLink });
          c.link('Plugins', { href: '/plugins', id: 'footer-plugins', class: ds.footerLink });
          c.link('Blog', { href: '/blog', id: 'footer-blog', class: ds.footerLink });
        }, { id: 'footer-col-explore', class: ds.footerCol });
        cols.container('footer-col-project', (c) => {
          c.text('Project', { id: 'footer-col-project-h', class: ds.footerColTitle });
          c.link('npm package', { href: NPM_URL, external: true, id: 'footer-npm', class: ds.footerLink });
          c.link('Official docs', { href: DOCS_SITE_URL, external: true, id: 'footer-official', class: ds.footerLink });
          c.link('Changelog', { href: '/changelog', id: 'footer-changelog', class: ds.footerLink });
          c.link('About', { href: '/about', id: 'footer-about', class: ds.footerLink });
        }, { id: 'footer-col-project', class: ds.footerCol });
      }, { id: 'footer-cols', class: ds.footerCols });
    }, { id: 'footer-inner', class: ds.footerInner });
  }, { id: 'site-footer', class: ds.footer, role: 'contentinfo' });

  }, { id: 'app-root', class: ds.appRoot });
}
