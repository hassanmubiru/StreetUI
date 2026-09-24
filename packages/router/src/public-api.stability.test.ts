/**
 * v1.0 public API contract — @streetui/router.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import { matchPattern, matchRoutes, normalizePath, splitTarget } from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'createBrowserHistory', 'createMemoryHistory', 'createRouter', 'matchPattern',
  'matchRoutes', 'mountRouter', 'normalizePath', 'ROUTER_OUTLET_ID',
  'routerOutlet', 'splitTarget',
] as const;

describe('@streetui/router — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});

describe('@streetui/router — matching behavior stability', () => {
  it('normalizePath is idempotent and slash-normalizing', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('a')).toBe('/a');
    expect(normalizePath('/a/')).toBe('/a');
    expect(normalizePath('/a')).toBe('/a');
  });

  it('matchPattern captures named params and rejects non-matches', () => {
    expect(matchPattern('/users/:id', '/users/5')).toEqual({ id: '5' });
    expect(matchPattern('/users/:id', '/posts/5')).toBeNull();
    expect(matchPattern('/home', '/home')).toEqual({});
  });

  it('matchRoutes selects the first matching route', () => {
    const routes = [{ path: '/a' }, { path: '/users/:id' }];
    const hit = matchRoutes(routes, '/users/7');
    expect(hit?.route.path).toBe('/users/:id');
    expect(hit?.params).toEqual({ id: '7' });
  });

  it('splitTarget separates pathname from search', () => {
    expect(splitTarget('/x?q=1').pathname).toBe('/x');
  });
});
