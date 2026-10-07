import { describe, expect, it } from 'vitest';
import { renderWebsite } from './server-entry.js';
import { allPaths, isKnownPath } from './routes.js';
import { BLOG_POSTS, DOCS, GUIDES, PRIMARY_NAV } from './content.js';

const REQUIRED_ROUTES = [
  '/', '/getting-started', '/docs', '/docs/http', '/guides', '/api', '/examples',
  '/playground', '/plugins', '/changelog', '/blog', '/about',
];

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const meta = (head: string, key: string): string | undefined =>
  new RegExp(`<meta[^>]*${key}[^>]*content="([^"]*)"`).exec(head)?.[1];

describe('SSR — every route', () => {
  it('covers each route in the brief', () => {
    for (const p of REQUIRED_ROUTES) {
      const r = renderWebsite(p);
      expect(r.status, p).toBe(200);
      expect(r.html.length, p).toBeGreaterThan(1000);
    }
  });

  it('renders every content-derived page (docs, guides, posts) with status 200', () => {
    const paths = allPaths();
    expect(paths.length).toBe(11 + DOCS.length + GUIDES.length + BLOG_POSTS.length);
    for (const p of paths) {
      expect(isKnownPath(p), p).toBe(true);
      expect(renderWebsite(p).status, p).toBe(200);
    }
  });

  it('shell is present on every route: skip link, nav, search trigger, outlet, footer', () => {
    for (const p of allPaths()) {
      const { html } = renderWebsite(p);
      expect(html, p).toContain('id="skip-link"');
      expect(html, p).toContain('id="site-nav"');
      expect(html, p).toContain('id="search-trigger"');
      expect(html, p).toContain('id="theme-toggle"');
      expect(html, p).toContain('id="page-outlet"');
      expect(html, p).toContain('id="site-footer"');
      for (const n of PRIMARY_NAV) expect(html, `${p} ${n.id}`).toContain(`id="${n.id}"`);
    }
  });

  it('exactly one h1 per page', () => {
    for (const p of allPaths()) expect(count(renderWebsite(p).html, '<h1'), p).toBe(1);
  });

  it('closed dialog and closed menu render nothing on the server', () => {
    const { html } = renderWebsite('/');
    expect(html).not.toContain('id="search-input"');
    expect(html).not.toContain('id="mobile-menu"');
  });

  it('wildcard and unknown slugs are real 404s with noindex', () => {
    for (const p of ['/nope', '/docs/zzz', '/guides/zzz', '/blog/zzz', '/docs/a/b']) {
      const r = renderWebsite(p);
      expect(r.status, p).toBe(404);
      expect(meta(r.head, 'name="robots"'), p).toBe('noindex');
      expect(r.html, p).toContain('id="nf-home"');
    }
  });
});

describe('SSR — SEO head', () => {
  it('every page declares title, description, canonical, robots and Open Graph exactly once', () => {
    for (const p of allPaths()) {
      const { head } = renderWebsite(p, { siteUrl: 'https://streetjs.test' });
      expect(count(head, '<title'), `${p} title`).toBe(1);
      expect(count(head, 'rel="canonical"'), `${p} canonical`).toBe(1);
      expect(count(head, 'name="description"'), `${p} description`).toBe(1);
      expect(count(head, 'name="robots"'), `${p} robots`).toBe(1);
      expect(meta(head, 'name="robots"'), p).toBe('index,follow');
      expect(head, p).toContain(`href="https://streetjs.test${p === '/' ? '/' : p}"`);
      for (const og of ['og:title', 'og:description', 'og:url', 'og:type']) {
        expect(count(head, `property="${og}"`), `${p} ${og}`).toBe(1);
      }
      expect(meta(head, 'name="description"')!.length, p).toBeGreaterThan(20);
      expect(meta(head, 'name="description"')!.length, p).toBeLessThanOrEqual(160);
    }
  });

  it('titles are unique across the site', () => {
    const titles = allPaths().map((p) => /<title[^>]*>([^<]*)</.exec(renderWebsite(p).head)![1]);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('home uses the site title; others are "<page> · StreetJS"', () => {
    expect(renderWebsite('/').head).toContain('StreetJS — production-grade');
    expect(renderWebsite('/about').head).toContain('About · StreetJS');
  });
});

describe('SSR — styling determinism', () => {
  it('the stylesheet is byte-identical for every route', () => {
    const base = renderWebsite('/').styles;
    expect(base.length).toBeGreaterThan(1000);
    for (const p of allPaths()) expect(renderWebsite(p).styles, p).toBe(base);
  });

  it('rendering is deterministic', () => {
    for (const p of ['/', '/playground', '/docs/http']) {
      expect(renderWebsite(p).html).toBe(renderWebsite(p).html);
    }
  });
});

describe('SSR — internal links', () => {
  it('every internal href on every page resolves to a real route', () => {
    const bad: string[] = [];
    for (const p of allPaths()) {
      const { html } = renderWebsite(p);
      for (const m of html.matchAll(/<a [^>]*href="([^"]*)"/g)) {
        const href = m[1]!;
        if (href.startsWith('#') || /^https?:\/\//.test(href)) continue;
        if (!isKnownPath(href)) bad.push(`${p} → ${href}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('external links are only the official docs site', () => {
    const external = new Set<string>();
    for (const p of allPaths()) {
      for (const m of renderWebsite(p).html.matchAll(/<a [^>]*href="(https?:\/\/[^"]*)"/g)) external.add(m[1]!);
    }
    expect([...external]).toEqual(['https://hassanmubiru.github.io/StreetJS/']);
  });
});

describe('SSR — search dialog markup when open is not server state', () => {
  it('has no search results rendered by default', () => {
    expect(renderWebsite('/').html).not.toContain('id="search-result-');
  });
});
