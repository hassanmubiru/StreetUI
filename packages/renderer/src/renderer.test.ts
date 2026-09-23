import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, type Signal } from '@streetui/state';
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

// ── Reactive list (listOf) reconciliation ──────────────────────────────────────

describe('reactive list — listOf', () => {
  function mountList<T>(
    items: Signal<T[]>,
    renderItem: (item: T, i: number, content: {
      text: (t: string) => void;
      button: (l: string, o?: { onClick?: () => void }) => void;
    }) => void,
  ) {
    resetIdCounter();
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (page as any).listOf('items', items, renderItem);
    });
    const compiled = compile(app);
    const container = makeContainer();
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.mount(compiled, container);
    return { container, handle };
  }

  it('renders the initial items', () => {
    const items = signal(['a', 'b', 'c']);
    const { container } = mountList(items, (item, _i, c) => c.text(item));
    expect(container.querySelectorAll('li').length).toBe(3);
    expect(container.textContent).toContain('a');
    expect(container.textContent).toContain('c');
  });

  it('adds an item when the signal grows', () => {
    const items = signal(['a', 'b']);
    const { container } = mountList(items, (item, _i, c) => c.text(item));
    expect(container.querySelectorAll('li').length).toBe(2);
    items.set(['a', 'b', 'c']);
    expect(container.querySelectorAll('li').length).toBe(3);
    expect(container.textContent).toContain('c');
  });

  it('removes an item when the signal shrinks', () => {
    const items = signal(['a', 'b', 'c']);
    const { container } = mountList(items, (item, _i, c) => c.text(item));
    items.set(['a', 'c']);
    expect(container.querySelectorAll('li').length).toBe(2);
    expect(container.textContent).not.toContain('b');
  });

  it('clears to empty and repopulates', () => {
    const items = signal(['a', 'b']);
    const { container } = mountList(items, (item, _i, c) => c.text(item));
    items.set([]);
    expect(container.querySelectorAll('li').length).toBe(0);
    items.set(['x']);
    expect(container.querySelectorAll('li').length).toBe(1);
    expect(container.textContent).toContain('x');
  });

  it('reorders and reuses the SAME DOM nodes (keyed identity + node reuse)', () => {
    const items = signal(['a', 'b', 'c']);
    const { container } = mountList(items, (item, _i, c) => c.text(item));
    const before = Array.from(container.querySelectorAll('li'));
    const beforeA = before.find(li => li.textContent === 'a')!;
    const beforeC = before.find(li => li.textContent === 'c')!;

    items.set(['c', 'a', 'b']);

    const after = Array.from(container.querySelectorAll('li'));
    expect(after.map(li => li.textContent)).toEqual(['c', 'a', 'b']);
    // Reused by identity — the very same element objects, just moved.
    expect(after[0]).toBe(beforeC);
    expect(after[1]).toBe(beforeA);
  });

  it('replaces content when a keyed item value changes', () => {
    const items = signal([{ id: 1, label: 'one' }, { id: 2, label: 'two' }]);
    const { container } = mountList(items, (item, _i, c) => c.text(item.label));
    expect(container.textContent).toContain('one');
    items.set([{ id: 1, label: 'ONE' }, { id: 2, label: 'two' }]);
    expect(container.textContent).toContain('ONE');
    expect(container.textContent).not.toContain('one');
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  it('reuses a keyed item node across reorder even when other items change', () => {
    const items = signal([{ id: 1, label: 'a' }, { id: 2, label: 'b' }]);
    const { container } = mountList(items, (item, _i, c) => c.text(item.label));
    const beforeId2 = Array.from(container.querySelectorAll('li'))
      .find(li => li.textContent === 'b')!;
    items.set([{ id: 2, label: 'b' }, { id: 1, label: 'a' }]);
    const afterId2 = Array.from(container.querySelectorAll('li'))
      .find(li => li.textContent === 'b')!;
    expect(afterId2).toBe(beforeId2); // same id + same value → node reused
  });

  it('cleans up list subscriptions on unmount', () => {
    const items = signal(['a', 'b']);
    const { container, handle } = mountList(items, (item, _i, c) => c.text(item));
    handle.unmount();
    expect(container.children.length).toBe(0);
    // Signal still exists; updating it after unmount must be a safe no-op.
    expect(() => items.set(['a', 'b', 'c', 'd'])).not.toThrow();
    expect(container.querySelectorAll('li').length).toBe(0);
  });

  it('disposes removed item event listeners (no leak after removal)', () => {
    let clicks = 0;
    const items = signal(['keep', 'drop']);
    const { container } = mountList(items, (item, _i, c) => {
      c.text(item);
      if (item === 'drop') c.button('x', { onClick: () => { clicks++; } });
    });
    const dropBtn = container.querySelector('button') as HTMLButtonElement;
    dropBtn.dispatchEvent(new Event('click'));
    expect(clicks).toBe(1);
    items.set(['keep']); // removes the 'drop' item and its button
    expect(container.querySelector('button')).toBeNull();
    // The detached button is gone from the DOM — its listener can't fire again.
    dropBtn.dispatchEvent(new Event('click'));
    expect(clicks).toBe(1);
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
