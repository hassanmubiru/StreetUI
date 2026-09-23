import { describe, it, expect } from 'vitest';
import {
  matchPattern,
  matchRoutes,
  normalizePath,
  splitTarget,
} from './matching.js';

describe('normalizePath', () => {
  it('normalizes empty, missing-slash and trailing-slash forms', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('docs')).toBe('/docs');
    expect(normalizePath('/docs/')).toBe('/docs');
    expect(normalizePath('/docs/getting-started/')).toBe('/docs/getting-started');
  });
});

describe('matchPattern — static routes', () => {
  it('matches identical static paths', () => {
    expect(matchPattern('/', '/')).toEqual({});
    expect(matchPattern('/docs', '/docs')).toEqual({});
    expect(matchPattern('/docs/getting-started', '/docs/getting-started')).toEqual({});
  });

  it('rejects non-matching static paths', () => {
    expect(matchPattern('/docs', '/about')).toBeNull();
    expect(matchPattern('/docs', '/docs/getting-started')).toBeNull();
    expect(matchPattern('/docs/getting-started', '/docs')).toBeNull();
  });
});

describe('matchPattern — dynamic :params', () => {
  it('captures a single param', () => {
    expect(matchPattern('/users/:id', '/users/123')).toEqual({ id: '123' });
  });

  it('captures multiple params', () => {
    expect(matchPattern('/docs/:section/:page', '/docs/guide/intro')).toEqual({
      section: 'guide',
      page: 'intro',
    });
  });

  it('decodes percent-encoded param values', () => {
    expect(matchPattern('/users/:name', '/users/ada%20lovelace')).toEqual({
      name: 'ada lovelace',
    });
  });

  it('does not match when a required segment is missing', () => {
    expect(matchPattern('/users/:id', '/users')).toBeNull();
  });
});

describe('matchPattern — wildcard', () => {
  it('whole-pattern wildcard matches anything', () => {
    expect(matchPattern('*', '/')).toEqual({ '*': '' });
    expect(matchPattern('*', '/anything/here')).toEqual({ '*': 'anything/here' });
  });

  it('trailing wildcard captures the remainder', () => {
    expect(matchPattern('/files/*', '/files/a/b/c')).toEqual({ '*': 'a/b/c' });
  });
});

describe('matchRoutes — ordered resolution', () => {
  const routes = [
    { path: '/' },
    { path: '/docs' },
    { path: '/docs/:section' },
    { path: '/users/:id' },
    { path: '*' },
  ] as const;

  it('resolves each required example', () => {
    expect(matchRoutes(routes, '/')?.route.path).toBe('/');
    expect(matchRoutes(routes, '/docs')?.route.path).toBe('/docs');
    expect(matchRoutes(routes, '/docs/getting-started')?.route.path).toBe('/docs/:section');
    expect(matchRoutes(routes, '/users/123')).toEqual({
      route: { path: '/users/:id' },
      params: { id: '123' },
    });
  });

  it('falls through to the wildcard for unknown paths', () => {
    expect(matchRoutes(routes, '/nope/nope')?.route.path).toBe('*');
  });

  it('honours definition order (first match wins)', () => {
    const ordered = [{ path: '/docs/:section' }, { path: '/docs/api' }] as const;
    // '/docs/:section' is listed first, so it wins even for '/docs/api'.
    expect(matchRoutes(ordered, '/docs/api')).toEqual({
      route: { path: '/docs/:section' },
      params: { section: 'api' },
    });
  });
});

describe('splitTarget', () => {
  it('splits pathname and query, dropping the hash', () => {
    expect(splitTarget('/products?page=2')).toEqual({ pathname: '/products', search: 'page=2' });
    expect(splitTarget('/docs')).toEqual({ pathname: '/docs', search: '' });
    expect(splitTarget('/docs?x=1#frag')).toEqual({ pathname: '/docs', search: 'x=1' });
    expect(splitTarget('docs/')).toEqual({ pathname: '/docs', search: '' });
  });
});
