/**
 * Focused behavior tests for the four backward-compatible API improvements:
 *   1. Widened text-like bindings (string | number | boolean + signals thereof)
 *   2. when() conditional-rendering primitive
 *   3. Controlled input `bind` (two-way convenience)
 *   4. data-streetui-key list-item identity attribute
 *
 * Every test drives the real pipeline (DSL → compiler → graph → renderer → DOM)
 * and asserts observable behavior — not internal implementation details.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';

beforeEach(() => resetIdCounter());

function makeContainer(): HTMLDivElement {
  return document.createElement('div');
}

function mountApp(build: (page: Parameters<Parameters<ReturnType<typeof streetui.app>['page']>[1]>[0]) => void) {
  resetIdCounter();
  const app = streetui.app({ name: 'test' });
  app.page('home', build);
  const compiled = compile(app);
  const container = makeContainer();
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const handle = renderer.mount(compiled, container);
  return { container, handle, graph: compiled.graph };
}

const txt = (el: Element | null) => el?.textContent?.trim() ?? '';
function clickHandlerCount(graph: { handlers: Map<string, unknown> }): number {
  let n = 0;
  for (const k of graph.handlers.keys()) if (k.startsWith('click:')) n++;
  return n;
}

// 1 ── Widened text-like bindings ───────────────────────────────────────────
describe('1. widened text-like bindings', () => {
  it('renders a static string (existing behavior preserved)', () => {
    const { container } = mountApp((p) => p.text('hello', { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('hello');
  });

  it('renders a static number', () => {
    const { container } = mountApp((p) => p.text(42, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('42');
  });

  it('renders a static boolean', () => {
    const { container } = mountApp((p) => p.text(true, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('true');
  });

  it('renders a reactive number signal directly (no derived(String()))', () => {
    const count = signal(0);
    const { container } = mountApp((p) => p.text(count, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('0');
  });

  it('renders a reactive boolean signal directly', () => {
    const flag = signal(false);
    const { container } = mountApp((p) => p.text(flag, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('false');
  });

  it('updates a reactive number after signal.set()', () => {
    const count = signal(1);
    const { container } = mountApp((p) => p.text(count, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('1');
    count.set(2);
    expect(txt(container.querySelector('#t'))).toBe('2');
    count.set(99);
    expect(txt(container.querySelector('#t'))).toBe('99');
  });

  it('updates a reactive boolean after signal.set()', () => {
    const flag = signal(false);
    const { container } = mountApp((p) => p.text(flag, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('false');
    flag.set(true);
    expect(txt(container.querySelector('#t'))).toBe('true');
  });

  it('accepts a numeric button label and heading', () => {
    const { container } = mountApp((p) => {
      p.heading(7, { id: 'h' });
      p.button(3, { id: 'b' });
    });
    expect(txt(container.querySelector('#h'))).toBe('7');
    expect(txt(container.querySelector('#b'))).toBe('3');
  });
});

// 2 ── when() conditional rendering ─────────────────────────────────────────
describe('2. when() conditional rendering', () => {
  it('initial true renders the content', () => {
    const show = signal(true);
    const { container } = mountApp((p) =>
      p.when(show, (c) => c.text('DETAILS', { id: 'd' })),
    );
    expect(container.querySelector('#d')).not.toBeNull();
    expect(txt(container.querySelector('#d'))).toBe('DETAILS');
  });

  it('initial false renders nothing', () => {
    const show = signal(false);
    const { container } = mountApp((p) =>
      p.when(show, (c) => c.text('DETAILS', { id: 'd' })),
    );
    expect(container.querySelector('#d')).toBeNull();
  });

  it('false → true mounts, true → false removes, repeatedly', () => {
    const show = signal(false);
    const { container } = mountApp((p) =>
      p.when(show, (c) => c.text('DETAILS', { id: 'd' })),
    );
    expect(container.querySelector('#d')).toBeNull();
    show.set(true);
    expect(container.querySelector('#d')).not.toBeNull();
    show.set(false);
    expect(container.querySelector('#d')).toBeNull();
    show.set(true);
    expect(container.querySelector('#d')).not.toBeNull();
    show.set(false);
    expect(container.querySelector('#d')).toBeNull();
  });

  it('renders the else branch while false', () => {
    const show = signal(false);
    const { container } = mountApp((p) =>
      p.when(
        show,
        (c) => c.text('ON', { id: 'on' }),
        (c) => c.text('OFF', { id: 'off' }),
      ),
    );
    expect(container.querySelector('#on')).toBeNull();
    expect(container.querySelector('#off')).not.toBeNull();
    show.set(true);
    expect(container.querySelector('#on')).not.toBeNull();
    expect(container.querySelector('#off')).toBeNull();
  });

  it('events inside the conditional work', () => {
    const show = signal(true);
    const clicks = signal(0);
    const { container } = mountApp((p) =>
      p.when(show, (c) =>
        c.button('Hit', { id: 'hit', onClick: () => clicks.set(clicks.peek() + 1) }),
      ),
    );
    (container.querySelector('#hit') as HTMLButtonElement).dispatchEvent(new Event('click'));
    (container.querySelector('#hit') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(clicks.peek()).toBe(2);
  });

  it('removes the inner event handler from the graph when toggled off', () => {
    const show = signal(true);
    const { container, graph } = mountApp((p) =>
      p.when(show, (c) => c.button('Hit', { id: 'hit', onClick: () => {} })),
    );
    expect(clickHandlerCount(graph)).toBe(1);
    show.set(false); // branch removed → its click handler pruned
    expect(clickHandlerCount(graph)).toBe(0);
    show.set(true); // fresh branch → handler back
    expect(clickHandlerCount(graph)).toBe(1);
    void container;
  });

  it('unmount tears down the subtree; post-unmount writes are safe no-ops', () => {
    const show = signal(true);
    const { container, handle } = mountApp((p) =>
      p.when(show, (c) => c.button('Hit', { id: 'hit', onClick: () => {} })),
    );
    expect(container.querySelector('#hit')).not.toBeNull();
    handle.unmount();
    expect(container.children.length).toBe(0);
    // After unmount the live subscription is gone: toggling must not resurrect
    // DOM and must not throw.
    expect(() => show.set(false)).not.toThrow();
    expect(() => show.set(true)).not.toThrow();
    expect(container.children.length).toBe(0);
  });

  it('static boolean condition renders once with no reactive wiring', () => {
    const { container } = mountApp((p) => p.when(true, (c) => c.text('YES', { id: 'y' })));
    expect(container.querySelector('#y')).not.toBeNull();
  });
});

// 3 ── Controlled input bind ─────────────────────────────────────────────────
describe('3. controlled input bind', () => {
  it('reflects the signal initial value into the DOM', () => {
    const name = signal('Ada');
    const { container } = mountApp((p) => p.input({ id: 'f', bind: name }));
    expect((container.querySelector('#f') as HTMLInputElement).value).toBe('Ada');
  });

  it('signal → DOM: updating the signal updates the input value', () => {
    const name = signal('');
    const { container } = mountApp((p) => p.input({ id: 'f', bind: name }));
    name.set('Grace');
    expect((container.querySelector('#f') as HTMLInputElement).value).toBe('Grace');
  });

  it('DOM → signal: typing into the input updates the signal', () => {
    const name = signal('');
    const { container } = mountApp((p) => p.input({ id: 'f', bind: name }));
    const el = container.querySelector('#f') as HTMLInputElement;
    el.value = 'Lin';
    el.dispatchEvent(new Event('input'));
    expect(name.peek()).toBe('Lin');
  });

  it('handles repeated two-way updates', () => {
    const name = signal('a');
    const { container } = mountApp((p) => p.input({ id: 'f', bind: name }));
    const el = container.querySelector('#f') as HTMLInputElement;
    el.value = 'ab';
    el.dispatchEvent(new Event('input'));
    expect(name.peek()).toBe('ab');
    name.set('xyz');
    expect(el.value).toBe('xyz');
    el.value = 'xyz!';
    el.dispatchEvent(new Event('input'));
    expect(name.peek()).toBe('xyz!');
  });

  it('is safe after unmount', () => {
    const name = signal('a');
    const { container, handle } = mountApp((p) => p.input({ id: 'f', bind: name }));
    handle.unmount();
    expect(() => name.set('b')).not.toThrow();
    void container;
  });

  it('still supports the explicit value + onInput API', () => {
    const name = signal('start');
    const { container } = mountApp((p) =>
      p.input({ id: 'f', value: name, onInput: (v) => name.set(v) }),
    );
    const el = container.querySelector('#f') as HTMLInputElement;
    expect(el.value).toBe('start');
    el.value = 'typed';
    el.dispatchEvent(new Event('input'));
    expect(name.peek()).toBe('typed');
    name.set('reactive');
    expect(el.value).toBe('reactive');
  });
});

// 4 ── data-streetui-key list-item identity ──────────────────────────────────
describe('4. data-streetui-key list-item identity', () => {
  interface Row { id: number; name: string }
  function mountRows(items: ReturnType<typeof signal<Row[]>>) {
    return mountApp((p) =>
      p.listOf('rows', items, (row, _i, c) => c.text(row.name, { id: `row-${row.id}` })),
    );
  }

  it('emits the identity key (not internal signature) on each item element', () => {
    const items = signal<Row[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const { container } = mountRows(items);
    const li1 = container.querySelector('li[data-streetui-key="id:1"]');
    const li2 = container.querySelector('li[data-streetui-key="id:2"]');
    expect(li1).not.toBeNull();
    expect(li2).not.toBeNull();
    // Internal signature must never leak onto the element.
    expect(li1!.hasAttribute('_sig')).toBe(false);
    expect(li1!.getAttribute('data-streetui-key')).toBe('id:1');
    expect(container.querySelector('li')!.outerHTML).not.toContain('_sig');
  });

  it('reorder does not change the identity attribute or the element', () => {
    const items = signal<Row[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const { container } = mountRows(items);
    const li1Before = container.querySelector('li[data-streetui-key="id:1"]')!;
    items.set([{ id: 2, name: 'B' }, { id: 1, name: 'A' }]);
    const li1After = container.querySelector('li[data-streetui-key="id:1"]')!;
    expect(li1After).toBe(li1Before);
    expect(li1After.getAttribute('data-streetui-key')).toBe('id:1');
  });

  it('data change (identity unchanged) keeps the identity attribute stable', () => {
    const items = signal<Row[]>([{ id: 1, name: 'A' }]);
    const { container } = mountRows(items);
    const before = container.querySelector('li[data-streetui-key="id:1"]')!;
    items.set([{ id: 1, name: 'A (edited)' }]);
    const after = container.querySelector('li[data-streetui-key="id:1"]')!;
    expect(after).toBe(before);
    expect(after.getAttribute('data-streetui-key')).toBe('id:1');
    expect(txt(container.querySelector('#row-1'))).toBe('A (edited)');
  });

  it('removed items disappear completely', () => {
    const items = signal<Row[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const { container } = mountRows(items);
    items.set([{ id: 1, name: 'A' }]);
    expect(container.querySelector('li[data-streetui-key="id:2"]')).toBeNull();
    expect(container.querySelector('li[data-streetui-key="id:1"]')).not.toBeNull();
  });

  it('uses a value identity for primitive (non-object) items', () => {
    const items = signal<string[]>(['a', 'b']);
    const { container } = mountApp((p) =>
      p.listOf('rows', items, (s, _i, c) => c.text(s)),
    );
    expect(container.querySelector('li[data-streetui-key="val:a"]')).not.toBeNull();
    expect(container.querySelector('li[data-streetui-key="val:b"]')).not.toBeNull();
  });
});

