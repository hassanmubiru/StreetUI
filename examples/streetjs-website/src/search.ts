/**
 * StreetJS website — global search state.
 *
 * One query signal, one open signal, and everything else derived from them.
 * The index covers Docs, Guides, API, Examples, Plugins, Blog and Changelog
 * (see content.ts); there is no second search implementation.
 */

import { derived, signal, type ReadonlySignal, type Signal } from 'streetui';
import { searchContent, type SearchDoc } from './content.js';

export interface SearchState {
  /** The text in the search box. */
  readonly query: Signal<string>;
  /** Whether the search dialog is open. */
  readonly open: Signal<boolean>;
  /** Results for the current query (empty when the query is blank). */
  readonly results: ReadonlySignal<SearchDoc[]>;
  /** True when a non-blank query matched nothing. */
  readonly isEmpty: ReadonlySignal<boolean>;
  /** True when the query is blank (show the hint, not an empty state). */
  readonly isIdle: ReadonlySignal<boolean>;
  /** "3 results" / "1 result" / "Type to search" — for the live status line. */
  readonly status: ReadonlySignal<string>;
  openSearch(): void;
  closeSearch(): void;
}

export function createSearchState(initialQuery = ''): SearchState {
  const query = signal(initialQuery);
  const open = signal(false);
  const results = derived<SearchDoc[]>(() => searchContent(query.get()));
  const isIdle = derived(() => query.get().trim() === '');
  const isEmpty = derived(() => !isIdle.get() && results.get().length === 0);
  const status = derived(() => {
    if (isIdle.get()) return 'Type to search the docs, guides, API, examples, plugins, blog and changelog.';
    const n = results.get().length;
    return n === 0 ? 'No results' : `${n} result${n === 1 ? '' : 's'}`;
  });
  return {
    query,
    open,
    results,
    isEmpty,
    isIdle,
    status,
    openSearch() { open.set(true); },
    closeSearch() { open.set(false); query.set(''); },
  };
}

/** Stable DOM id for a result row — derived from the doc, never its position. */
export function resultId(doc: Pick<SearchDoc, 'kind' | 'title'>): string {
  const slug = `${doc.kind}-${doc.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `search-result-${slug}`;
}
