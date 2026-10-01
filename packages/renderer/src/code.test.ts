import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui, type PageDSL } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderContext } from './render-context.js';
import { mountGraph } from './mount.js';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';

beforeEach(() => resetIdCounter());

function makeContainer(): HTMLDivElement {
  return document.createElement('div');
}

function mount(buildFn: (app: ReturnType<typeof streetui.app>) => void): HTMLDivElement {
  resetIdCounter();
  const app = streetui.app({ name: 'code-test' });
  buildFn(app);
  const compiled = compile(app);
  const container = makeContainer();
  const dom = new BrowserDOMAdapter();
  const ctx = createRenderContext(dom, compiled.graph, container);
  mountGraph(ctx);
  return container;
}

function render(buildFn: (app: ReturnType<typeof streetui.app>) => void): string {
  resetIdCounter();
  const app = streetui.app({ name: 'code-ssr' });
  buildFn(app);
  return renderToString(compile(app));
}

// ── Mount: semantic <pre><code> structure ──────────────────────────────────────

describe('code() — browser mount', () => {
  it('renders a semantic <pre><code> containing the source', () => {
    const container = mount((app) => {
      app.page('home', (page) => {
        page.code('const x = 1;');
      });
    });
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    const codeEl = pre?.querySelector('code');
    expect(codeEl).not.toBeNull();
    expect(codeEl?.textContent).toBe('const x = 1;');
    // Exactly one <pre> and one inner <code> — no duplication.
    expect(container.querySelectorAll('pre').length).toBe(1);
    expect(container.querySelectorAll('pre > code').length).toBe(1);
  });

  it('preserves whitespace / newlines verbatim in the source', () => {
    const src = 'line1\n  indented\n\tif (true) {}\n';
    const container = mount((app) => {
      app.page('home', (page) => {
        page.code(src);
      });
    });
    expect(container.querySelector('pre > code')?.textContent).toBe(src);
  });

  it('does NOT inject raw HTML — angle brackets are text, not elements', () => {
    const container = mount((app) => {
      app.page('home', (page) => {
        page.code('<script>alert(1)</script> & <b>x</b>');
      });
    });
    const code = container.querySelector('pre > code') as HTMLElement;
    // The source is text content, so no real <script>/<b> elements were created.
    expect(code.querySelector('script')).toBeNull();
    expect(code.querySelector('b')).toBeNull();
    expect(code.textContent).toBe('<script>alert(1)</script> & <b>x</b>');
  });

  it('emits the optional language hint as data-language on the <pre>', () => {
    const container = mount((app) => {
      app.page('home', (page) => {
        page.code('print("hi")', { language: 'python' });
      });
    });
    const pre = container.querySelector('pre');
    expect(pre?.getAttribute('data-language')).toBe('python');
  });

  it('applies class and id to the outer <pre>', () => {
    const container = mount((app) => {
      app.page('home', (page) => {
        page.code('x', { class: 'snippet', id: 'ex-1' });
      });
    });
    const pre = container.querySelector('pre');
    expect(pre?.getAttribute('class')).toBe('snippet');
    expect(pre?.getAttribute('id')).toBe('ex-1');
  });

  it('omits data-language when no language is given', () => {
    const container = mount((app) => {
      app.page('home', (page) => {
        page.code('x');
      });
    });
    expect(container.querySelector('pre')?.hasAttribute('data-language')).toBe(false);
  });
});

// ── Reactive source ─────────────────────────────────────────────────────────────

describe('code() — reactive source', () => {
  it('updates the inner code text when a bound signal changes', () => {
    resetIdCounter();
    const src = signal('v1');
    const app = streetui.app({ name: 'code-test' });
    app.page('home', (page) => {
      page.code(src);
    });
    const compiled = compile(app);
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);

    expect(container.querySelector('pre > code')?.textContent).toBe('v1');
    src.set('v2');
    expect(container.querySelector('pre > code')?.textContent).toBe('v2');
    // Still a single structure after the update.
    expect(container.querySelectorAll('pre').length).toBe(1);
    expect(container.querySelectorAll('pre > code').length).toBe(1);
  });
});

// ── SSR: escaped <pre><code> ────────────────────────────────────────────────────

describe('code() — server rendering (SSR)', () => {
  it('serializes to <pre><code> with the source escaped', () => {
    const html = render((app) => {
      app.page('home', (page) => {
        page.code('if (a < b && c > d) {}');
      });
    });
    expect(html).toContain('<pre><code>');
    expect(html).toContain('</code></pre>');
    // < > & escaped at serialize time — no raw-HTML injection in SSR output.
    expect(html).toContain('if (a &lt; b &amp;&amp; c &gt; d) {}');
    expect(html).not.toContain('a < b');
  });

  it('serializes the language hint and class as attributes on <pre>', () => {
    const html = render((app) => {
      app.page('home', (page) => {
        page.code('SELECT 1', { language: 'sql', class: 'q' });
      });
    });
    expect(html).toContain('data-language="sql"');
    expect(html).toContain('class="q"');
  });
});

// ── Hydration: adopt the server <pre>, no recreation ────────────────────────────

function prepare(build: (page: PageDSL) => void): {
  container: HTMLDivElement;
  hydrate: () => void;
} {
  resetIdCounter();
  const serverApp = streetui.app({ name: 'app' });
  serverApp.page('home', (page) => build(page));
  const html = renderToString(compile(serverApp));
  const container = document.createElement('div');
  container.innerHTML = html;
  return {
    container,
    hydrate() {
      resetIdCounter();
      const clientApp = streetui.app({ name: 'app' });
      clientApp.page('home', (page) => build(page));
      const compiled = compile(clientApp);
      const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
      renderer.hydrate(compiled, container);
    },
  };
}

describe('code() — hydration', () => {
  it('adopts the exact server <pre> node instead of recreating it', () => {
    const { container, hydrate } = prepare((page) => page.code('const x = 1;'));
    const beforePre = container.querySelector('pre');
    const beforeCode = container.querySelector('pre > code');
    expect(beforePre).not.toBeNull();
    hydrate();
    // Same object identity — hydration adopted the elements, did not rebuild.
    expect(container.querySelector('pre')).toBe(beforePre);
    expect(container.querySelector('pre > code')).toBe(beforeCode);
    expect(container.querySelectorAll('pre').length).toBe(1);
  });

  it('keeps reactive source live after hydration', () => {
    resetIdCounter();
    const src = signal('before');
    const build = (page: PageDSL) => page.code(src);
    const serverApp = streetui.app({ name: 'app' });
    serverApp.page('home', build);
    const html = renderToString(compile(serverApp));
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('pre > code')?.textContent).toBe('before');

    resetIdCounter();
    const clientApp = streetui.app({ name: 'app' });
    clientApp.page('home', build);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    renderer.hydrate(compile(clientApp), container);

    src.set('after');
    expect(container.querySelector('pre > code')?.textContent).toBe('after');
    expect(container.querySelectorAll('pre').length).toBe(1);
  });
});
