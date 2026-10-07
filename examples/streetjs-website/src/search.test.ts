import { describe, expect, it } from 'vitest';
import { searchContent, SEARCH_INDEX } from './content.js';
import { createSearchState, resultId } from './search.js';
import { isTypingTarget, nextFocusId, shouldOpenSearch } from './search-keys.js';

describe('nextFocusId', () => {
  const ids = ['search-input', 'r1', 'r2', 'r3'];
  it('moves forward and clamps at the end', () => {
    expect(nextFocusId(ids, 'search-input', 'ArrowDown')).toBe('r1');
    expect(nextFocusId(ids, 'r2', 'ArrowDown')).toBe('r3');
    expect(nextFocusId(ids, 'r3', 'ArrowDown')).toBe('r3');
  });
  it('moves back and clamps at the start', () => {
    expect(nextFocusId(ids, 'r2', 'ArrowUp')).toBe('r1');
    expect(nextFocusId(ids, 'search-input', 'ArrowUp')).toBe('search-input');
  });
  it('handles unknown/null current ids and empty lists', () => {
    expect(nextFocusId(ids, null, 'ArrowDown')).toBe('search-input');
    expect(nextFocusId(ids, 'elsewhere', 'ArrowDown')).toBe('search-input');
    expect(nextFocusId(ids, 'elsewhere', 'ArrowUp')).toBeUndefined();
    expect(nextFocusId([], 'x', 'ArrowDown')).toBeUndefined();
    expect(nextFocusId(ids, 'r1', 'Enter')).toBeUndefined();
  });
});

describe('isTypingTarget / shouldOpenSearch', () => {
  it('recognises text-entry controls only', () => {
    expect(isTypingTarget({ tagName: 'input' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
  it('opens on Ctrl/Cmd+K anywhere and "/" only outside inputs', () => {
    expect(shouldOpenSearch({ key: 'k', ctrlKey: true }, true)).toBe(true);
    expect(shouldOpenSearch({ key: 'K', metaKey: true }, false)).toBe(true);
    expect(shouldOpenSearch({ key: '/' }, false)).toBe(true);
    expect(shouldOpenSearch({ key: '/' }, true)).toBe(false);
    expect(shouldOpenSearch({ key: '/', ctrlKey: true }, false)).toBe(false);
    expect(shouldOpenSearch({ key: 'k' }, false)).toBe(false);
  });
});

describe('createSearchState', () => {
  it('is idle for a blank query, with a hint rather than an empty state', () => {
    const s = createSearchState();
    expect(s.isIdle.get()).toBe(true);
    expect(s.isEmpty.get()).toBe(false);
    expect(s.results.get()).toEqual([]);
    expect(s.status.get()).toMatch(/Type to search/);
  });
  it('reports an empty state for a query that matches nothing', () => {
    const s = createSearchState();
    s.query.set('zzzqxjv-nothing-matches');
    expect(s.isIdle.get()).toBe(false);
    expect(s.isEmpty.get()).toBe(true);
    expect(s.status.get()).toBe('No results');
  });
  it('reports a count (singular/plural) derived from the real index', () => {
    const s = createSearchState();
    s.query.set('migration');
    const n = searchContent('migration').length;
    expect(n).toBeGreaterThan(0);
    expect(s.results.get()).toHaveLength(n);
    expect(s.status.get()).toBe(`${n} result${n === 1 ? '' : 's'}`);
  });
  it('closeSearch closes AND clears the query; openSearch opens', () => {
    const s = createSearchState('migration');
    s.openSearch();
    expect(s.open.get()).toBe(true);
    s.closeSearch();
    expect(s.open.get()).toBe(false);
    expect(s.query.get()).toBe('');
    expect(s.isIdle.get()).toBe(true);
  });
});

describe('resultId', () => {
  it('is stable, slugged and unique across the whole index', () => {
    const ids = SEARCH_INDEX.map((d) => resultId(d));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^search-result-[a-z0-9-]+$/);
    expect(resultId({ kind: 'Docs', title: 'A  B!' } as never)).toBe('search-result-docs-a-b');
  });
});
