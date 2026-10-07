import { describe, expect, it } from 'vitest';
import {
  ABOUT_FACTS, ABOUT_UNVERIFIED, API_GROUPS, BLOG_POSTS, CHANGELOG, DOCS, DOC_GROUPS, EXAMPLES, GUIDES, PLUGINS, SEARCH_INDEX,
  docBySlug, docNeighbours, searchContent,
} from './content.js';
import { renderWebsite } from './server-entry.js';
import { allPaths } from './routes.js';

const allText = (): string =>
  [
    ...allPaths().map((p) => renderWebsite(p).html),
    JSON.stringify(SEARCH_INDEX),
  ].join('\n');

describe('content integrity', () => {
  it('slugs are unique and every doc belongs to a declared group', () => {
    for (const list of [DOCS, GUIDES, BLOG_POSTS]) {
      expect(new Set(list.map((x) => x.slug)).size).toBe(list.length);
    }
    for (const d of DOCS) expect(DOC_GROUPS).toContain(d.group);
  });

  it('nothing is a placeholder: every page has real content', () => {
    for (const d of DOCS) expect(d.blocks.length, d.slug).toBeGreaterThan(0);
    for (const g of GUIDES) expect(g.blocks.length, g.slug).toBeGreaterThan(0);
    for (const b of BLOG_POSTS) expect(b.blocks.length, b.slug).toBeGreaterThan(0);
    expect(API_GROUPS.length).toBeGreaterThan(0);
    expect(EXAMPLES.length).toBeGreaterThan(0);
    expect(PLUGINS.length).toBeGreaterThan(0);
    expect(CHANGELOG.length).toBeGreaterThan(0);
    expect(ABOUT_FACTS.length).toBeGreaterThan(0);
    const text = allText();
    for (const w of ['lorem ipsum', 'coming soon', 'TODO', 'under construction', 'placeholder content']) {
      expect(text.toLowerCase(), w).not.toContain(w.toLowerCase());
    }
  });

  it('does not contain APIs or names that are known to be wrong', () => {
    const text = allText();
    for (const banned of ['@streetjs/core', 'createStreetApp', 'StreetClient', 'streetjs.dev', 'github.com/streetjs']) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it('the scaffolding command is only ever named as something NOT claimed', () => {
    expect(ABOUT_UNVERIFIED.join('\n')).toContain('npx streetjs create');
    for (const d of DOCS) expect(JSON.stringify(d), d.slug).not.toContain('npx streetjs create');
    for (const g of GUIDES) expect(JSON.stringify(g), g.slug).not.toContain('npx streetjs create');
  });

  it('the install command uses the real package name', () => {
    expect(JSON.stringify(docBySlug('installation'))).toContain('npm install streetjs');
  });

  it('makes no performance, adoption or roadmap claims', () => {
    const text = allText().toLowerCase();
    for (const claim of ['requests per second', 'req/s', 'ops/sec', 'x faster', 'times faster', 'trusted by', 'companies use', 'roadmap', 'coming in v']) {
      expect(text, claim).not.toContain(claim);
    }
  });

  it('changelog only claims 1.2.8, the version actually verified', () => {
    expect(CHANGELOG.map((c) => c.version)).toEqual(['1.2.8']);
  });

  it('prev/next neighbours follow reading order', () => {
    expect(docNeighbours(DOCS[0]!.slug).prev).toBeUndefined();
    expect(docNeighbours(DOCS[0]!.slug).next?.slug).toBe(DOCS[1]!.slug);
    expect(docNeighbours(DOCS[DOCS.length - 1]!.slug).next).toBeUndefined();
  });
});

describe('global search index', () => {
  it('covers Docs, Guides, API, Examples, Plugins, Blog and Changelog', () => {
    const kinds = new Set(SEARCH_INDEX.map((d) => d.kind));
    for (const k of ['Docs', 'Guide', 'API', 'Example', 'Plugin', 'Blog', 'Changelog']) expect(kinds.has(k as never), k).toBe(true);
  });

  it('every indexed href is a real route', async () => {
    const { isKnownPath } = await import('./routes.js');
    for (const d of SEARCH_INDEX) expect(isKnownPath(d.href), d.href).toBe(true);
  });

  it('finds content by a term from each kind', () => {
    const find = (q: string, kind: string) => searchContent(q, SEARCH_INDEX, 50).some((r) => r.kind === kind);
    expect(find('migration', 'Docs')).toBe(true);
    expect(find('hash', 'Guide')).toBe(true);
    expect(find('PgPool', 'API')).toBe(true);
    expect(find('controller', 'Example')).toBe(true);
    expect(find('plugin', 'Plugin')).toBe(true);
    expect(find('rbac', 'Blog')).toBe(true);
    expect(find('1.2.8', 'Changelog')).toBe(true);
  });

  it('is case-insensitive, AND-matched, and empty for a blank or unmatched query', () => {
    expect(searchContent('JWT').length).toBeGreaterThan(0);
    expect(searchContent('jwt')).toEqual(searchContent('JWT'));
    expect(searchContent('   ')).toEqual([]);
    expect(searchContent('zzzqqqxxx')).toEqual([]);
    expect(searchContent('jwt zzzqqqxxx')).toEqual([]);
  });

  it('ranks title matches above keyword-only matches and respects the limit', () => {
    const r = searchContent('jwt', SEARCH_INDEX, 3);
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r[0]!.title.toLowerCase()).toContain('jwt');
  });
});
