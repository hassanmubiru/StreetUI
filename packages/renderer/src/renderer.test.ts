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
    return { container, handle, graph: compiled.graph };
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

  // ── TASK 2 — keyed reorder preserves DOM element identity ─────────────────────

  it('reorder A B C → C A B preserves the DOM element identity of every item', () => {
    const items = signal([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);
    const { container } = mountList(items, (item, _i, c) => c.text(item.name));

    const before = Array.from(container.querySelectorAll('li'));
    const oldA = before.find(li => li.textContent === 'A')!;
    const oldB = before.find(li => li.textContent === 'B')!;
    const oldC = before.find(li => li.textContent === 'C')!;

    items.set([
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);

    const after = Array.from(container.querySelectorAll('li'));
    expect(after.map(li => li.textContent)).toEqual(['C', 'A', 'B']);
    const newC = after.find(li => li.textContent === 'C')!;
    const newA = after.find(li => li.textContent === 'A')!;
    const newB = after.find(li => li.textContent === 'B')!;
    expect(newC).toBe(oldC);
    expect(newA).toBe(oldA);
    expect(newB).toBe(oldB);
  });

  // ── TASK 3 — changed item data keeps DOM identity, updates content ────────────

  it('changed item data keeps the same DOM element and updates its content in place', () => {
    const items = signal([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    const { container } = mountList(items, (item, _i, c) => c.text(item.name));

    const beforeLis = Array.from(container.querySelectorAll('li'));
    const oldItem1 = beforeLis.find(li => li.textContent === 'Alice')!;
    const oldItem2 = beforeLis.find(li => li.textContent === 'Bob')!;
    const oldSpan1 = oldItem1.querySelector('span');

    // Same identity (id=1), changed data.
    items.set([
      { id: 1, name: 'Amina' },
      { id: 2, name: 'Bob' },
    ]);

    const afterLis = Array.from(container.querySelectorAll('li'));
    expect(afterLis.length).toBe(2);
    const newItem1 = afterLis.find(li => li.textContent === 'Amina')!;
    const newItem2 = afterLis.find(li => li.textContent === 'Bob')!;

    // The DOM element for item 1 is preserved; only its content changed.
    expect(newItem1).toBe(oldItem1);
    expect(newItem1.textContent).toBe('Amina');
    expect(container.textContent).not.toContain('Alice');
    // The inner element is patched in place (not recreated) for a pure text change.
    expect(newItem1.querySelector('span')).toBe(oldSpan1);
    // The untouched sibling is completely undisturbed.
    expect(newItem2).toBe(oldItem2);
  });

  it('changed item data preserves identity even across a simultaneous reorder', () => {
    const items = signal([
      { id: 1, name: 'one' },
      { id: 2, name: 'two' },
    ]);
    const { container } = mountList(items, (item, _i, c) => c.text(item.name));
    const oldItem1 = Array.from(container.querySelectorAll('li'))
      .find(li => li.textContent === 'one')!;

    items.set([
      { id: 2, name: 'two' },
      { id: 1, name: 'ONE' }, // reordered AND changed
    ]);

    const after = Array.from(container.querySelectorAll('li'));
    expect(after.map(li => li.textContent)).toEqual(['two', 'ONE']);
    const newItem1 = after.find(li => li.textContent === 'ONE')!;
    expect(newItem1).toBe(oldItem1); // same element, moved + updated
  });
});

// ── Reactive list — graph handler registry cleanup (TASK 4) ─────────────────────

describe('reactive list — graph handler registry cleanup', () => {
  function mountButtonList(items: Signal<{ id: number; name: string }[]>) {
    resetIdCounter();
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (page as any).listOf(
        'items',
        items,
        (item: { id: number; name: string }, _i: number, c: {
          text: (t: string) => void;
          button: (l: string, o?: { onClick?: () => void }) => void;
        }) => {
          c.text(item.name);
          c.button('x', { onClick: () => {} });
        },
      );
    });
    const compiled = compile(app);
    const container = makeContainer();
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.mount(compiled, container);
    return { container, handle, graph: compiled.graph };
  }

  const clickHandlerCount = (graph: { handlers: Map<string, unknown> }): number =>
    [...graph.handlers.keys()].filter(k => k.startsWith('click:')).length;

  it('registers exactly one click handler per live item at mount', () => {
    const items = signal([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    const { graph } = mountButtonList(items);
    expect(clickHandlerCount(graph)).toBe(3);
  });

  it('prunes the removed item\'s handler and leaks nothing on rebuild', () => {
    const items = signal([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    const { graph } = mountButtonList(items);
    expect(clickHandlerCount(graph)).toBe(3);

    items.set([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]); // remove id 3
    // No stale entry for the removed item, and no accumulation from the
    // freshly-built-but-unadopted duplicates of the reused items.
    expect(clickHandlerCount(graph)).toBe(2);

    items.set([{ id: 2, name: 'b' }]); // remove id 1
    expect(clickHandlerCount(graph)).toBe(1);

    items.set([]); // clear
    expect(clickHandlerCount(graph)).toBe(0);
  });

  it('handler count stays bounded across many reorders and data changes', () => {
    const items = signal([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    const { graph } = mountButtonList(items);

    items.set([{ id: 3, name: 'c' }, { id: 1, name: 'a' }, { id: 2, name: 'b' }]); // reorder
    items.set([{ id: 3, name: 'C' }, { id: 1, name: 'A' }, { id: 2, name: 'B' }]); // data change
    items.set([{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]); // reorder back

    // Still exactly one handler per live item — no growth despite rebuilding all.
    expect(clickHandlerCount(graph)).toBe(3);
  });

  it('unmount tears down all list handlers registrations for removed items', () => {
    const items = signal([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
    const { graph, handle } = mountButtonList(items);
    expect(clickHandlerCount(graph)).toBe(2);
    items.set([{ id: 1, name: 'a' }]); // remove id 2 → its click handler pruned
    expect(clickHandlerCount(graph)).toBe(1);
    handle.unmount();
    // Post-unmount signal updates are safe no-ops and register nothing.
    expect(() => items.set([{ id: 1, name: 'a' }, { id: 9, name: 'z' }])).not.toThrow();
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
