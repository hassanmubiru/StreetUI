/**
 * StreetJS website — search keyboard handling (app level).
 *
 * The StreetUI builder DSL has no key-event binding, so keyboard shortcuts are
 * wired with ONE browser-only document listener. The decision logic lives in
 * pure functions (`nextFocusId`, `isTypingTarget`, `shouldOpenSearch`) so it is
 * unit-testable without a DOM.
 *
 * Why this module also handles result clicks: the dialog is portalled to
 * <body>, outside the router container, so the router's link interception
 * never sees clicks inside it. Without this, choosing a result would trigger a
 * full page reload. We navigate through the router instead.
 */

import type { Router } from 'streetui';
import { resultId, type SearchState } from './search.js';

export const SEARCH_INPUT_ID = 'search-input';
const RESULT_PREFIX = 'search-result-';

/**
 * Move focus through [input, ...results]. ArrowDown goes forward, ArrowUp goes
 * back; both clamp at the ends. An unknown current id: ArrowDown → first id,
 * ArrowUp → undefined (nothing to do).
 */
export function nextFocusId(
  ids: readonly string[],
  currentId: string | null,
  key: string,
): string | undefined {
  if (ids.length === 0) return undefined;
  const idx = currentId === null ? -1 : ids.indexOf(currentId);
  if (key === 'ArrowDown') return ids[Math.min(idx + 1, ids.length - 1)];
  if (key === 'ArrowUp') return idx < 0 ? undefined : ids[Math.max(idx - 1, 0)];
  return undefined;
}

/** True when a keystroke target is a text-entry control. */
export function isTypingTarget(el: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (el === null || el.tagName === undefined) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/** Cmd/Ctrl+K anywhere, or "/" when not typing. */
export function shouldOpenSearch(
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean },
  typing: boolean,
): boolean {
  if ((e.metaKey === true || e.ctrlKey === true) && e.key.toLowerCase() === 'k') return true;
  if (e.key === '/' && !typing && e.metaKey !== true && e.ctrlKey !== true && e.altKey !== true) return true;
  return false;
}

export interface SearchKeyOptions {
  readonly search: SearchState;
  readonly router: Router;
  readonly doc?: Document;
}

/** Install the listeners. Returns a disposer. No-op where there is no document. */
export function installSearchKeys(options: SearchKeyOptions): () => void {
  const doc = options.doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (doc === undefined) return () => {};
  const { search, router } = options;

  const resultIds = (): string[] =>
    Array.from(doc.querySelectorAll<HTMLElement>(`[id^="${RESULT_PREFIX}"]`)).map((el) => el.id);

  const onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    const active = doc.activeElement as HTMLElement | null;

    if (!search.open.peek()) {
      if (shouldOpenSearch(e, isTypingTarget(active))) {
        e.preventDefault();
        search.openSearch();
      }
      return;
    }

    // Dialog is open.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const ids = [SEARCH_INPUT_ID, ...resultIds()];
      const target = nextFocusId(ids, active?.id ?? null, e.key);
      if (target !== undefined) {
        e.preventDefault();
        doc.getElementById(target)?.focus();
      }
      return;
    }

    if (e.key === 'Enter' && active?.id === SEARCH_INPUT_ID) {
      const first = search.results.peek()[0];
      if (first !== undefined) {
        e.preventDefault();
        router.navigate(first.href);
        search.closeSearch();
      }
    }
  };

  const onClick = (event: Event): void => {
    if (!search.open.peek()) return;
    const e = event as MouseEvent;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as Element | null)?.closest?.('a') ?? null;
    if (anchor === null || !anchor.id.startsWith(RESULT_PREFIX)) return;
    const href = anchor.getAttribute('href');
    if (href === null || href === '') return;
    e.preventDefault();
    router.navigate(href);
    search.closeSearch();
  };

  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('click', onClick);
  return () => {
    doc.removeEventListener('keydown', onKeyDown);
    doc.removeEventListener('click', onClick);
  };
}

export { resultId };
