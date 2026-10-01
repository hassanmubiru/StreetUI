/**
 * StreetUI Website — persistent application shell.
 *
 * Rendered once by mountRouter and kept across navigations. Contains the skip
 * link, the primary navigation (with active markers), the theme toggle, the
 * docs search box with live results, the router outlet (where routes render),
 * and the footer. Everything here is the real public builder DSL + signals.
 *
 * Accessibility: a skip link targets the main region, the nav is a <nav>
 * landmark (section id "site-nav"), the search box has an associated status
 * line, and the theme toggle is a real <button> with a reactive label.
 */

import { derived, type Signal } from 'streetui';
import type { PageDSL, Router } from 'streetui';
import { routerOutlet } from 'streetui';
import { navLink } from './components.js';
import { PRIMARY_NAV, searchContent, type SearchDoc } from './content.js';
import type { ThemeController } from './theme.js';

export interface ShellContext {
  readonly router: Router;
  readonly theme: ThemeController;
  readonly search: SearchState;
}

export interface SearchState {
  readonly query: Signal<string>;
  readonly results: Signal<SearchDoc[]>;
}

/** Build the search state (query signal + derived results over the index). */
export function createSearchState(querySignal: Signal<string>): SearchState {
  return {
    query: querySignal,
    results: derived<SearchDoc[]>(() => searchContent(querySignal.get())),
  };
}

export function websiteShell(shell: PageDSL, ctx: ShellContext): void {
  const { router, theme, search } = ctx;

  // Skip link — first focusable, jumps past the nav to the route content.
  shell.section('skip', (s) => {
    s.link('Skip to content', { href: '#page-outlet', id: 'skip-link' });
  }, { id: 'site-skip' });

  // Primary navigation landmark.
  shell.section('nav', (n) => {
    n.heading('StreetUI', { level: 1, id: 'brand' });

    n.container('nav-links', (links) => {
      for (const item of PRIMARY_NAV) {
        navLink(links, router, item);
      }
      links.link('GitHub', { href: 'https://example.com/streetui', external: true, id: 'nav-github' });
    }, { id: 'nav-links' });

    // Theme toggle — a real button bound to a reactive label.
    n.container('theme', (t) => {
      t.button(theme.label, { id: 'theme-toggle', onClick: () => theme.cycle() });
    }, { id: 'theme-region' });

    // Docs search — bound input + live results list + empty state.
    n.container('search', (sc) => {
      sc.input({
        id: 'search-input',
        type: 'search',
        placeholder: 'Search docs…',
        bind: search.query,
      });
      sc.listOf('search-results', search.results, (item, _i, content) => {
        content.link(`${item.title} — ${item.kind}`, {
          href: item.href,
          id: `search-result-${slugifyId(item.title)}-${item.kind}`,
        });
      }, { id: 'search-results' });
      sc.when(
        derived(() => search.query.get().trim() !== '' && search.results.get().length === 0),
        (empty) => { empty.text('No matches.', { id: 'search-empty' }); },
      );
    }, { id: 'search-region' });
  }, { id: 'site-nav' });

  // The active route renders here; the shell above/below persists.
  routerOutlet(shell);

  shell.section('footer', (f) => {
    f.text('Built with StreetUI — this site is a StreetUI application.', { id: 'footer-text' });
    f.link('MIT License', { href: '/about', id: 'footer-license' });
  }, { id: 'site-footer' });
}

/** Stable id fragment from an arbitrary title (search result ids). */
function slugifyId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
