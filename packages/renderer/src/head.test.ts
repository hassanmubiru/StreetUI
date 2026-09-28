/**
 * HEAD / metadata platform (2.0 §1–§3).
 *
 * `head({...})` declares document metadata (title/meta/link/canonical/OG/
 * twitter/robots/theme-color/favicon/base) on StreetUI's own graph model. These
 * are structural assertions (engine-independent), deterministic in CI:
 *
 *   • SERVER: `renderHead(compiled)` walks the active graph in document order,
 *     merges every `head()` contribution (last-in-document-order wins per dedup
 *     key), and serializes the effective tags with `data-streetui-head` +
 *     `data-streetui-head-key` markers.
 *   • BROWSER: mounting a `head()` node applies its contribution to
 *     `document.head` via the per-render HeadManager; unmount withdraws it and
 *     re-exposes any shadowed default; reactive title/attrs update live.
 *   • HYDRATION: server-emitted `[data-streetui-head-key]` tags are adopted, so
 *     re-asserting the same contribution produces no duplicates.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';
import { renderHead } from './head.js';

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

// ── Server emission ─────────────────────────────────────────────────────────────

describe('renderHead — server emission', () => {
  it('serializes title/meta/link/canonical/OG/twitter/favicon/base with markers', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'head-server' });
    app.page('home', (page) => {
      page.head({
        charset: 'utf-8',
        base: '/app/',
        title: 'Home — Acme',
        description: 'The Acme home page',
        canonical: 'https://acme.test/',
        robots: 'index,follow',
        themeColor: '#0af',
        viewport: 'width=device-width, initial-scale=1',
        favicon: '/favicon.ico',
        openGraph: { title: 'Acme', type: 'website' },
        twitter: { card: 'summary' },
        meta: [{ name: 'author', content: 'Acme Team' }],
        link: [{ rel: 'stylesheet', href: '/app.css' }],
      });
      page.text('body');
    });
    const compiled = compile(app);
    const head = renderHead(compiled);

    // Every emitted tag carries the framework markers.
    expect(head).toContain('data-streetui-head');
    expect(head).toContain('data-streetui-head-key="title"');
    expect(head).toContain('<title data-streetui-head data-streetui-head-key="title">Home — Acme</title>');
    expect(head).toContain('data-streetui-head-key="meta:charset"');
    expect(head).toContain('charset="utf-8"');
    expect(head).toContain('data-streetui-head-key="base"');
    expect(head).toContain('href="/app/"');
    expect(head).toContain('name="description"');
    expect(head).toContain('content="The Acme home page"');
    expect(head).toContain('rel="canonical"');
    expect(head).toContain('href="https://acme.test/"');
    expect(head).toContain('name="robots"');
    expect(head).toContain('name="theme-color"');
    expect(head).toContain('name="viewport"');
    expect(head).toContain('rel="icon"');
    expect(head).toContain('property="og:title"');
    expect(head).toContain('property="og:type"');
    expect(head).toContain('name="twitter:card"');
    expect(head).toContain('name="author"');
    expect(head).toContain('rel="stylesheet"');
    expect(head).toContain('href="/app.css"');
  });

  it('returns "" when the app declares no head() (SSR output unchanged)', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'no-head' });
    app.page('home', (page) => {
      page.text('body');
    });
    const compiled = compile(app);
    expect(renderHead(compiled)).toBe('');
  });

  it('merges multiple head() nodes: last-in-document-order wins per dedup key', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'head-precedence' });
    app.page('home', (page) => {
      // App-level default declared first.
      page.head({ title: 'Default', description: 'default desc' });
      page.section('main', (main) => {
        // Deeper/later route-level head overrides the title only.
        main.head({ title: 'Route Title' });
      });
    });
    const compiled = compile(app);
    const head = renderHead(compiled);

    // Exactly one <title>, and it is the later (deeper) one.
    const titleMatches = head.match(/<title/g) ?? [];
    expect(titleMatches.length).toBe(1);
    expect(head).toContain('>Route Title<');
    expect(head).not.toContain('>Default<');
    // The un-overridden description from the default survives.
    expect(head).toContain('content="default desc"');
  });

  it('SSR body output is unaffected: a head() renders only a neutral anchor inline', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'head-anchor' });
    app.page('home', (page) => {
      page.head({ title: 'X' });
      page.text('visible');
    });
    const compiled = compile(app);
    const body = renderToString(compiled);
    expect(body).toContain('data-streetui-head-anchor');
    expect(body).toContain('visible');
    // No metadata tag leaks into the body stream.
    expect(body).not.toContain('<title');
  });
});

// ── Browser mount ────────────────────────────────────────────────────────────────

describe('head — browser mount applies to document.head', () => {
  it('creates managed title + meta tags in document.head, leaving an inline anchor', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'head-mount' });
    app.page('home', (page) => {
      page.head({ title: 'Live Title', description: 'live desc' });
      page.text('body');
    });
    const compiled = compile(app);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    renderer.mount(compiled, container);

    // Anchor stays inline in the container, empty.
    const anchor = container.querySelector('[data-streetui-head-anchor]');
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toBe('');

    // Metadata is applied to document.head.
    const title = document.head.querySelector('title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Live Title');
    const desc = document.head.querySelector('meta[name="description"]');
    expect(desc).not.toBeNull();
    expect(desc!.getAttribute('content')).toBe('live desc');
  });

  it('updates document.head when a reactive title signal changes', () => {
    resetIdCounter();
    const title = signal('one');
    const app = streetui.app({ name: 'head-reactive' });
    app.page('home', (page) => {
      page.head({ title });
    });
    const compiled = compile(app);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    renderer.mount(compiled, container);

    expect(document.head.querySelector('title')!.textContent).toBe('one');
    title.set('two');
    expect(document.head.querySelector('title')!.textContent).toBe('two');
    // Still exactly one title (updated in place, not duplicated).
    expect(document.head.querySelectorAll('title').length).toBe(1);
  });

  it('removes managed tags from document.head on unmount', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'head-cleanup' });
    app.page('home', (page) => {
      page.head({ title: 'Gone soon', description: 'temp' });
    });
    const compiled = compile(app);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.mount(compiled, container);

    expect(document.head.querySelector('[data-streetui-head-key]')).not.toBeNull();
    handle.unmount();
    expect(document.head.querySelector('[data-streetui-head-key]')).toBeNull();
  });

  it('re-exposes a shadowed default when the overriding head() unmounts', () => {
    resetIdCounter();
    const show = signal(true);
    const app = streetui.app({ name: 'head-reexpose' });
    app.page('home', (page) => {
      page.head({ title: 'Default' });
      page.when(show, (b) => {
        b.head({ title: 'Override' });
      });
    });
    const compiled = compile(app);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    renderer.mount(compiled, container);

    // Override is live (declared later in document order).
    expect(document.head.querySelector('title')!.textContent).toBe('Override');
    expect(document.head.querySelectorAll('title').length).toBe(1);

    // Remove the override branch → the default is re-exposed.
    show.set(false);
    expect(document.head.querySelector('title')!.textContent).toBe('Default');
    expect(document.head.querySelectorAll('title').length).toBe(1);
  });
});

// ── Hydration ─────────────────────────────────────────────────────────────────

describe('head — hydration adopts server tags without duplication', () => {
  it('re-asserts the contribution onto adopted server tags (no duplicate title/meta)', () => {
    resetIdCounter();
    function build() {
      const app = streetui.app({ name: 'head-hydrate' });
      app.page('home', (page) => {
        page.head({ title: 'SSR Title', description: 'ssr desc' });
        page.text('body');
      });
      return compile(app);
    }

    const compiled = build();
    const body = renderToString(compiled);
    const head = renderHead(compiled);

    // Simulate the server-rendered document: head tags + body anchor.
    resetIdCounter();
    const compiled2 = build();
    document.head.innerHTML = head;
    const container = document.createElement('div');
    container.innerHTML = body;
    document.body.appendChild(container);

    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.hydrate(compiled2, container);

    // Exactly one title / one description after hydration (adopted, not re-created).
    expect(document.head.querySelectorAll('title').length).toBe(1);
    expect(document.head.querySelector('title')!.textContent).toBe('SSR Title');
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(
      document.head.querySelector('meta[name="description"]')!.getAttribute('content'),
    ).toBe('ssr desc');

    // Cleanup still withdraws the tags.
    handle.unmount();
    expect(document.head.querySelector('title')).toBeNull();
  });
});
