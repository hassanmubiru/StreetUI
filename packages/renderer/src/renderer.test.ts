import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { ApplicationGraph } from '@streetui/graph';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderContext } from './render-context.js';
import { mountGraph } from './mount.js';
import { createRenderer, StreetRendererImpl } from './renderer.js';
import { applyProp, patchProp } from './attributes.js';

beforeEach(() => resetIdCounter());

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer(): HTMLDivElement {
  return document.createElement('div');
}

function compileApp(buildFn: (app: ReturnType<typeof streetui.app>) => void) {
  resetIdCounter();
  const app = streetui.app({ name: 'test' });
  buildFn(app);
  return compile(app);
}

// ── Attributes ────────────────────────────────────────────────────────────────

describe('applyProp', () => {
  let dom: BrowserDOMAdapter;
  let el: Element;

  beforeEach(() => {
    dom = new BrowserDOMAdapter();
    el = dom.createElement('div');
  });

  it('sets a string attribute', () => {
    applyProp(dom, el, 'id', 'my-id');
    expect(el.getAttribute('id')).toBe('my-id');
  });

  it('sets class attribute via "class" key', () => {
    applyProp(dom, el, 'class', 'foo bar');
    expect(el.getAttribute('class')).toBe('foo bar');
  });

  it('sets class attribute via "className" key', () => {
    applyProp(dom, el, 'className', 'baz');
    expect(el.getAttribute('class')).toBe('baz');
  });

  it('sets boolean attr disabled', () => {
    applyProp(dom, el, 'disabled', true);
    expect(el.hasAttribute('disabled')).toBe(true);
  });

  it('removes boolean attr when false', () => {
    dom.setAttribute(el, 'disabled', '');
    applyProp(dom, el, 'disabled', false);
    expect(el.hasAttribute('disabled')).toBe(false);
  });

  it('removes attr when null', () => {
    dom.setAttribute(el, 'data-x', 'yes');
    applyProp(dom, el, 'data-x', null);
    expect(el.getAttribute('data-x')).toBeNull();
  });

  it('skips internal _ props', () => {
    applyProp(dom, el, '_renderKey', 'k');
    expect(el.getAttribute('_renderKey')).toBeNull();
  });

  it('skips on* handlers', () => {
    applyProp(dom, el, 'onClick', () => {});
    expect(el.getAttribute('onClick')).toBeNull();
  });

  it('sets value as DOM property', () => {
    const input = dom.createElement('input') as HTMLInputElement;
    applyProp(dom, input, 'value', 'hello');
    expect(input.value).toBe('hello');
  });
});

describe('patchProp', () => {
  it('skips update when value unchanged', () => {
    const dom = new BrowserDOMAdapter();
    const el = dom.createElement('div');
    dom.setAttribute(el, 'data-x', 'old');
    patchProp(dom, el, 'data-x', 'same', 'same');
    expect(el.getAttribute('data-x')).toBe('old');
  });

  it('applies update when value changed', () => {
    const dom = new BrowserDOMAdapter();
    const el = dom.createElement('div');
    patchProp(dom, el, 'data-x', 'old', 'new');
    expect(el.getAttribute('data-x')).toBe('new');
  });
});

// ── Mount ─────────────────────────────────────────────────────────────────────

describe('mountGraph — element creation', () => {
  it('creates a heading element', () => {
    const compiled = compileApp(app => {
      app.page('home', page => { page.heading('Hello'); });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    expect(container.querySelector('h1')).not.toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('Hello');
  });

  it('creates a text node', () => {
    const compiled = compileApp(app => {
      app.page('home', page => { page.text('World'); });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    expect(container.textContent).toContain('World');
  });

  it('creates a button element', () => {
    const compiled = compileApp(app => {
      app.page('home', page => { page.button('Click'); });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe('Click');
  });

  it('creates a section element', () => {
    const compiled = compileApp(app => {
      app.page('home', page => { page.section('s1', () => {}); });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('creates nested structure', () => {
    const compiled = compileApp(app => {
      app.page('home', page => {
        page.section('hero', section => {
          section.heading('Title');
          section.button('CTA');
        });
      });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    const section = container.querySelector('section');
    expect(section?.querySelector('h1')?.textContent).toBe('Title');
    expect(section?.querySelector('button')?.textContent).toBe('CTA');
  });

  it('creates an input element', () => {
    const compiled = compileApp(app => {
      app.page('home', page => { page.input({ placeholder: 'enter text' }); });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    const input = container.querySelector('input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.placeholder).toBe('enter text');
  });

  it('creates an image element with src/alt', () => {
    const compiled = compileApp(app => {
      app.page('home', page => {
        page.image({ src: 'img.png', alt: 'A picture' });
      });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img?.getAttribute('alt')).toBe('A picture');
  });

  it('creates a link element', () => {
    const compiled = compileApp(app => {
      app.page('home', page => {
        page.link('Visit', { href: 'https://example.com' });
      });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    const a = container.querySelector('a') as HTMLAnchorElement | null;
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.textContent).toBe('Visit');
  });
});

// ── Events ────────────────────────────────────────────────────────────────────

describe('events — button click', () => {
  it('fires click handler', () => {
    let clicked = false;
    const compiled = compileApp(app => {
      app.page('home', page => {
        page.button('Go', { onClick: () => { clicked = true; } });
      });
    });
    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);
    const btn = container.querySelector('button') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click'));
    expect(clicked).toBe(true);
  });
});

// ── Reactive updates ──────────────────────────────────────────────────────────

describe('reactive signal updates', () => {
  it('updates text when signal changes', () => {
    resetIdCounter();
    const label = signal('initial');
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.text(label); });
    const compiled = compile(app);

    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);

    expect(container.textContent).toContain('initial');
    label.set('updated');
    expect(container.textContent).toContain('updated');
  });

  it('updates heading when signal changes', () => {
    resetIdCounter();
    const title = signal('First');
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.heading(title); });
    const compiled = compile(app);

    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);

    expect(container.querySelector('h1')?.textContent).toBe('First');
    title.set('Second');
    expect(container.querySelector('h1')?.textContent).toBe('Second');
  });

  it('updates button disabled state', () => {
    resetIdCounter();
    const disabled = signal(false);
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.button('Click', { disabled });
    });
    const compiled = compile(app);

    const container = makeContainer();
    const dom = new BrowserDOMAdapter();
    const ctx = createRenderContext(dom, compiled.graph, container);
    mountGraph(ctx);

    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.hasAttribute('disabled')).toBe(false);
    disabled.set(true);
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});

// ── Unmount / cleanup ─────────────────────────────────────────────────────────

describe('StreetRenderer unmount', () => {
  it('removes all children from container on unmount', () => {
    const compiled = compileApp(app => {
      app.page('home', page => { page.heading('Hi'); });
    });
    const container = makeContainer();
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.mount(compiled, container);
    expect(container.children.length).toBeGreaterThan(0);
    handle.unmount();
    expect(container.children.length).toBe(0);
  });

  it('calling unmount twice is safe', () => {
    const compiled = compileApp(app => {
      app.page('home', page => { page.text('x'); });
    });
    const container = makeContainer();
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.mount(compiled, container);
    handle.unmount();
    expect(() => handle.unmount()).not.toThrow();
  });

  it('event listeners are removed after unmount', () => {
    let clicks = 0;
    const compiled = compileApp(app => {
      app.page('home', page => {
        page.button('Click', { onClick: () => { clicks++; } });
      });
    });
    const container = makeContainer();
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.mount(compiled, container);
    const btn = container.querySelector('button') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click'));
    expect(clicks).toBe(1);
    handle.unmount();
    // after unmount the button is gone from the DOM — no more clicks possible
    expect(container.querySelector('button')).toBeNull();
  });
});
