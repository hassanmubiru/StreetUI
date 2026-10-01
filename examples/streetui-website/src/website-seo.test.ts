/**
 * StreetUI Website — SEO / metadata suite (Phase 6, v2.6).
 *
 * Exercises the website's real `head()` metadata through the public API:
 *   • SSR (`renderWebsite(path).head`) emits a per-route <title>, description,
 *     canonical, robots, Open Graph and Twitter tags — each marked for
 *     hydration adoption,
 *   • the route-level head() OVERRIDES the shell's site-wide defaults (the
 *     emitted title/canonical are the page's own, not the default),
 *   • 404 (and unknown docs/blog) are marked noindex,
 *   • on the client, mounting applies the metadata to document.head and
 *     navigation updates it with no duplicate tags,
 *   • a server render is adopted on hydration without duplicating head tags.
 *
 * ENGINE BOUNDARY: crawler rendering, social-card scraping and real search-engine
 * indexing are out-of-process concerns verified in the authoritative environment;
 * this suite proves the markup the framework emits, not third-party consumption.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryHistory, resetIdCounter } from 'streetui';
import { flushUpdates } from 'streetui/testing';
import { mountWebsite, type MountedWebsite } from './website.js';
import { renderWebsite } from './server-entry.js';
import { SITE } from './metadata.js';

const INDEXABLE: ReadonlyArray<{ path: string; title: string }> = [
  { path: '/', title: 'Build UIs from a semantic graph' },
  { path: '/getting-started', title: 'Getting Started' },
  { path: '/docs', title: 'Documentation' },
  { path: '/docs/core-concepts', title: 'Core Concepts' },
  { path: '/api', title: 'API Reference' },
  { path: '/examples', title: 'Examples' },
  { path: '/playground', title: 'Playground' },
  { path: '/benchmarks', title: 'Benchmarks' },
  { path: '/changelog', title: 'Changelog' },
  { path: '/blog', title: 'Blog' },
  { path: '/blog/no-virtual-dom', title: 'Why there is no virtual DOM' },
  { path: '/about', title: 'About' },
];

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/** Remove any framework head tags between tests (one shared happy-dom document). */
function clearHead(): void {
  for (const el of Array.from(document.head.querySelectorAll('[data-streetui-head]'))) {
    el.remove();
  }
}

let site: MountedWebsite | null = null;
let container: HTMLElement;

beforeEach(() => {
  resetIdCounter();
  clearHead();
  container = makeContainer();
});

afterEach(() => {
  site?.unmount();
  site = null;
  if (container.parentNode !== null) container.parentNode.removeChild(container);
  clearHead();
});

describe('website SEO — SSR emits per-route metadata', () => {
  for (const route of INDEXABLE) {
    it(`emits title / description / canonical / OG for ${route.path}`, () => {
      const { head } = renderWebsite(route.path);
      const expectedTitle = `${route.title} · ${SITE.name}`;
      const canonical = SITE.baseUrl + route.path;

      // A single <title>, carrying the page's own title (override, not default).
      expect(head).toContain('<title');
      expect(head).toContain(expectedTitle);
      // The route head() fully overrides the shell's default title everywhere it
      // appears (title + og:title + twitter:title), so the default never leaks.
      expect(head).not.toContain(SITE.defaultTitle);

      // Description, canonical, robots, Open Graph, Twitter.
      expect(head).toContain('name="description"');
      expect(head).toContain('rel="canonical"');
      expect(head).toContain(`href="${canonical}"`);
      expect(head).toContain('name="robots"');
      expect(head).toContain('content="index,follow"');
      expect(head).toContain('property="og:title"');
      expect(head).toContain(`property="og:url"`);
      expect(head).toContain('name="twitter:card"');
      expect(head).toContain(`content="${SITE.twitterCard}"`);

      // Every emitted tag is marked for hydration adoption.
      expect(head).toContain('data-streetui-head');
      expect(head).toContain('data-streetui-head-key="title"');
    });
  }

  it('emits exactly one canonical and one title per route (dedup collapse)', () => {
    for (const route of INDEXABLE) {
      const { head } = renderWebsite(route.path);
      expect((head.match(/<title/g) ?? []).length, `one <title> for ${route.path}`).toBe(1);
      expect(
        (head.match(/rel="canonical"/g) ?? []).length,
        `one canonical for ${route.path}`,
      ).toBe(1);
    }
  });

  it('marks the 404 page noindex and keeps indexable pages index,follow', () => {
    const notFound = renderWebsite('/this-route-does-not-exist');
    expect(notFound.head).toContain('content="noindex"');
    expect(notFound.head).not.toContain('content="index,follow"');

    const unknownDoc = renderWebsite('/docs/not-a-real-section');
    expect(unknownDoc.head).toContain('content="noindex"');

    const home = renderWebsite('/');
    expect(home.head).toContain('content="index,follow"');
    expect(home.head).not.toContain('content="noindex"');
  });

  it('inherits site defaults (theme-color, favicon, og:site_name) on a route page', () => {
    const { head } = renderWebsite('/about');
    expect(head).toContain('name="theme-color"');
    expect(head).toContain(`content="${SITE.themeColor}"`);
    expect(head).toContain('rel="icon"');
    expect(head).toContain('property="og:site_name"');
    expect(head).toContain(`content="${SITE.name}"`);
  });
});

describe('website SEO — client applies and updates document.head', () => {
  const headTitle = (): string =>
    document.head.querySelector('title[data-streetui-head]')?.textContent?.trim() ?? '';
  const canonicalHref = (): string =>
    document.head
      .querySelector('link[data-streetui-head][rel="canonical"]')
      ?.getAttribute('href') ?? '';

  it('applies the active route metadata to document.head on mount', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/about') });
    await flushUpdates();
    expect(headTitle()).toBe(`About · ${SITE.name}`);
    expect(canonicalHref()).toBe(SITE.baseUrl + '/about');
    // Single title / canonical, no stacking of the shell default + route.
    expect(document.head.querySelectorAll('title[data-streetui-head]').length).toBe(1);
    expect(
      document.head.querySelectorAll('link[data-streetui-head][rel="canonical"]').length,
    ).toBe(1);
  });

  it('updates title and canonical on client navigation with no duplicates', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/about') });
    await flushUpdates();
    site.router.navigate('/api');
    await flushUpdates();
    expect(headTitle()).toBe(`API Reference · ${SITE.name}`);
    expect(canonicalHref()).toBe(SITE.baseUrl + '/api');
    expect(document.head.querySelectorAll('title[data-streetui-head]').length).toBe(1);

    site.router.navigate('/playground');
    await flushUpdates();
    expect(headTitle()).toBe(`Playground · ${SITE.name}`);
    expect(canonicalHref()).toBe(SITE.baseUrl + '/playground');
    expect(document.head.querySelectorAll('title[data-streetui-head]').length).toBe(1);
  });
});

describe('website SEO — hydration adopts server head tags without duplication', () => {
  it('reuses the server-emitted title/canonical instead of appending new ones', async () => {
    // Plant a server render (body + head) into the shared document.
    const { html, head } = renderWebsite('/about');
    container.innerHTML = html;
    document.head.insertAdjacentHTML('beforeend', head);
    expect(document.head.querySelectorAll('title[data-streetui-head]').length).toBe(1);

    resetIdCounter();
    site = mountWebsite(container, {
      history: createMemoryHistory('/about'),
      hydrate: true,
    });
    await flushUpdates();

    // Still exactly one title / canonical — the server tags were adopted.
    expect(document.head.querySelectorAll('title[data-streetui-head]').length).toBe(1);
    expect(
      document.head.querySelectorAll('link[data-streetui-head][rel="canonical"]').length,
    ).toBe(1);
    expect(
      document.head.querySelector('title[data-streetui-head]')?.textContent?.trim(),
    ).toBe(`About · ${SITE.name}`);
  });
});
