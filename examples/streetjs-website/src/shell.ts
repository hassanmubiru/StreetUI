import { type PageDSL, derived, renderStyles } from 'streetui';
import { routerOutlet, ROUTER_OUTLET_KEY } from 'streetui';
import {
  siteLayout, siteHeader, headerInner, siteLogo, logoAccent,
  headerNav, navLink, themeToggle, siteFooter, footerInner, footerText, skipLink,
  searchOverlay, searchModal, searchInput, searchResults, searchResult,
  searchResultSelected, searchResultTitle, searchResultDesc, searchResultType,
  searchEmpty, searchHint,
  brand,
} from './design-system.js';
import { theme } from './theme.js';
import {
  isSearchOpen, searchQuery, searchResults as results, selectedIndex,
  openSearch, closeSearch, updateQuery, moveSelection, getSelectedResult
} from './search.js';

export function websiteShell(page: PageDSL, ctx: { renderOutlet?: () => void } = {}) {
  page.container('site', (site) => {
    // Skip link
    site.link('Skip to content', { href: '#main-content', id: 'skip-link', class: skipLink });

    // Header
    site.container('header', (h) => {
      h.container('header-inner', (hi) => {
        hi.link('StreetJS', { href: '/', id: 'logo', class: siteLogo });
        hi.container('nav', (nav) => {
          const links = [
            ['Docs', '/docs'],
            ['API', '/api'],
            ['Examples', '/examples'],
            ['Guides', '/guides'],
            ['Getting Started', '/getting-started'],
          ] as const;
          for (const [label, href] of links) {
            nav.link(label, { href, id: `nav-${label.toLowerCase().replace(/\s/g,'-')}`, class: navLink });
          }
        }, { id: 'main-nav', class: headerNav, role: 'navigation', ariaLabel: 'Main navigation' });
        hi.button('Search (⌘K)', {
          id: 'search-trigger', class: themeToggle,
          ariaLabel: 'Open search',
          onClick: () => openSearch(),
        });
        hi.button(derived(() => theme.label.get()), {
          id: 'theme-toggle', class: themeToggle,
          ariaLabel: 'Toggle theme',
          onClick: () => theme.cycle(),
        });
      }, { id: 'header-inner', class: headerInner });

    // Search modal overlay (portal)
    h.when(isSearchOpen, (modal) => {
      modal.container('search-overlay', (overlay) => {
        overlay.container('search-modal', (m) => {
          m.input({
            id: 'search-input',
            class: searchInput,
            type: 'text',
            placeholder: 'Search docs, API, guides...',
            ariaLabel: 'Search',
            value: searchQuery,
            onInput: (e) => updateQuery((e.target as HTMLInputElement).value),
          });
          m.container('results-container', (rc) => {
            rc.when(
              derived(() => searchQuery.get().length > 0 && results.get().length === 0),
              (empty) => {
                empty.text('No results found. Try a different search term.', { id: 'search-empty', class: searchEmpty });
              }
            );
            rc.listOf('result', results, (item, r) => {
              const isSelected = derived(() => results.get().indexOf(item.get()) === selectedIndex.get());
              r.container(`result-${item.get().url}`, (ri) => {
                ri.container('result-top', (rt) => {
                  rt.text(item.get().type, { id: `result-type-${item.get().url}`, class: searchResultType });
                  rt.text(item.get().title, { id: `result-title-${item.get().url}`, class: searchResultTitle });
                }, { id: `result-top-${item.get().url}` });
                ri.text(item.get().description, { id: `result-desc-${item.get().url}`, class: searchResultDesc });
              }, {
                id: `result-${item.get().url.replace(/[^a-z0-9]/gi, '-')}`,
                class: searchResult,
                onClick: () => {
                  if (typeof window !== 'undefined') {
                    window.location.href = item.get().url;
                  }
                  closeSearch();
                },
              });
            });
          }, { id: 'search-results', class: searchResults });
          m.container('search-footer', (sf) => {
            sf.text('↑↓ Navigate  ↵ Open  Esc Close', { id: 'search-hint', class: searchHint });
          }, { id: 'search-footer' });
        }, { id: 'search-modal', class: searchModal, role: 'dialog', ariaLabel: 'Search' });
      }, {
        id: 'search-overlay',
        class: searchOverlay,
        onClick: (e) => {
          if ((e.target as HTMLElement).id === 'search-overlay') closeSearch();
        },
      });
    });
    }, { id: 'site-header', class: siteHeader, role: 'banner' });

    // Main content / router outlet
    site.container('main', (main) => {
      if (ctx.renderOutlet) {
        ctx.renderOutlet();
      } else {
        routerOutlet(main, 'main-content');
      }
    }, { id: 'main-content', role: 'main' });

    // Footer
    site.container('footer', (f) => {
      f.container('footer-inner', (fi) => {
        fi.text('Built with StreetUI 3.0.0', { id: 'footer-text', class: footerText });
        fi.link('GitHub', { href: 'https://github.com/streetjs/streetjs', id: 'footer-github', class: footerText });
      }, { id: 'footer-inner', class: footerInner });
    }, { id: 'site-footer', class: siteFooter, role: 'contentinfo' });
  }, { id: 'site-layout', class: siteLayout });
}
