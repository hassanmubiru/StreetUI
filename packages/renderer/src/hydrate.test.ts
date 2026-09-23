import { describe, it, expect } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui, type PageDSL } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';

/**
 * Build the SAME application on the "server" and the "client". The server render
 * produces HTML which we place in a container; `hydrate()` then attaches a live
 * client runtime to that exact markup. Signals captured in the closure are
 * shared, so mutating them after hydration exercises the live client lifecycle
 * against the adopted (server-produced) DOM.
 */
function prepare(build: (page: PageDSL) => void): {
  container: HTMLDivElement;
  hydrate: () => ReturnType<ReturnType<typeof createRenderer>['hydrate']>;
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
      return renderer.hydrate(compiled, container);
    },
  };
}

describe('hydrate — DOM adoption (no recreation)', () => {
  it('reuses the exact server DOM node instead of recreating it', () => {
    const { container, hydrate } = prepare((page) => page.heading('Reused'));
    const beforeH1 = container.querySelector('h1');
    expect(beforeH1).not.toBeNull();
    hydrate();
    // Same object identity — hydration adopted the element, did not rebuild it.
    expect(container.querySelector('h1')).toBe(beforeH1);
    expect(container.querySelectorAll('h1').length).toBe(1);
  });

  it('does not clear the container (no delete-then-render)', () => {
    const { container, hydrate } = prepare((page) => {
      page.heading('Title');
      page.section('body', (s) => s.text('kept'));
    });
    const childrenBefore = Array.from(container.children);
    hydrate();
    const childrenAfter = Array.from(container.children);
    expect(childrenAfter).toEqual(childrenBefore); // same nodes, same order
  });
});

describe('hydrate — events', () => {
  it('runs a click handler wired only during hydration', () => {
    let clicks = 0;
    const { container, hydrate } = prepare((page) =>
      page.button('Go', { onClick: () => { clicks++; } }),
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    // Before hydration the server markup has no behavior.
    btn.dispatchEvent(new Event('click'));
    expect(clicks).toBe(0);
    hydrate();
    btn.dispatchEvent(new Event('click'));
    expect(clicks).toBe(1);
  });

  it('wires exactly one handler (no duplicate listeners)', () => {
    let clicks = 0;
    const { container, hydrate } = prepare((page) =>
      page.button('Go', { onClick: () => { clicks++; } }),
    );
    hydrate();
    const btn = container.querySelector('button') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click'));
    expect(clicks).toBe(1);
  });
});

describe('hydrate — reactive updates against adopted DOM', () => {
  it('updates the same heading node when its signal changes', () => {
    const label = signal('a');
    const { container, hydrate } = prepare((page) => page.heading(label));
    const h1 = container.querySelector('h1');
    hydrate();
    expect(container.querySelector('h1')).toBe(h1);
    label.set('b');
    expect(h1?.textContent).toBe('b');
    // Still the same element — updated in place, not replaced.
    expect(container.querySelector('h1')).toBe(h1);
  });
});

describe('hydrate — conditional (when)', () => {
  it('toggles a false branch on after hydration', () => {
    const show = signal(false);
    const { container, hydrate } = prepare((page) =>
      page.when(show, (b) => b.text('NOW')),
    );
    expect(container.textContent).not.toContain('NOW');
    hydrate();
    show.set(true);
    expect(container.textContent).toContain('NOW');
  });

  it('toggles a true branch off after hydration', () => {
    const show = signal(true);
    const { container, hydrate } = prepare((page) =>
      page.when(show, (b) => b.text('NOW')),
    );
    expect(container.textContent).toContain('NOW');
    hydrate();
    show.set(false);
    expect(container.textContent).not.toContain('NOW');
  });
});

describe('hydrate — reactive list keyed identity', () => {
  it('preserves DOM node identity across a reorder after hydration', () => {
    const items = signal([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);
    const { container, hydrate } = prepare((page) =>
      page.listOf('rows', items, (item, _i, c) => c.text(item.name)),
    );
    hydrate();

    const before = Array.from(container.querySelectorAll('li'));
    expect(before.map((li) => li.textContent)).toEqual(['A', 'B', 'C']);
    const a = before.find((li) => li.textContent === 'A')!;
    const b = before.find((li) => li.textContent === 'B')!;
    const c = before.find((li) => li.textContent === 'C')!;

    items.set([
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);

    const after = Array.from(container.querySelectorAll('li'));
    expect(after.map((li) => li.textContent)).toEqual(['C', 'A', 'B']);
    // The very same server-produced elements, reordered — not rebuilt.
    expect(after.find((li) => li.textContent === 'C')).toBe(c);
    expect(after.find((li) => li.textContent === 'A')).toBe(a);
    expect(after.find((li) => li.textContent === 'B')).toBe(b);
  });
});

describe('hydrate — controlled input', () => {
  it('adopts the server value and reflects later signal changes', () => {
    const name = signal('seeded');
    const { container, hydrate } = prepare((page) => page.input({ bind: name }));
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('value')).toBe('seeded');
    hydrate();
    expect(input.value).toBe('seeded');
    name.set('changed');
    expect(input.value).toBe('changed');
  });

  it('propagates typing into the bound signal (two-way)', () => {
    const name = signal('seeded');
    const { container, hydrate } = prepare((page) => page.input({ bind: name }));
    hydrate();
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'typed';
    input.dispatchEvent(new Event('input'));
    expect(name.peek()).toBe('typed');
  });
});

describe('hydrate — cleanup', () => {
  it('tears down listeners and clears the container on unmount', () => {
    let clicks = 0;
    const { container, hydrate } = prepare((page) =>
      page.button('Go', { onClick: () => { clicks++; } }),
    );
    const handle = hydrate();
    const btn = container.querySelector('button') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click'));
    expect(clicks).toBe(1);
    handle.unmount();
    expect(container.children.length).toBe(0);
    // Detached button can no longer fire.
    btn.dispatchEvent(new Event('click'));
    expect(clicks).toBe(1);
  });

  it('mismatch recovery: repairs a locally divergent subtree', () => {
    // Server produced a heading; the client graph expects a heading too, but we
    // corrupt the markup to simulate a divergent/absent node. Hydration must
    // repair only that subtree and still yield a correct, live tree.
    const { container, hydrate } = prepare((page) => page.heading('Title'));
    const h1 = container.querySelector('h1')!;
    // Corrupt: replace the <h1> with an unrelated element.
    const wrong = document.createElement('p');
    wrong.textContent = 'stale';
    h1.replaceWith(wrong);
    hydrate();
    // The mismatched <p> was removed and a correct <h1> mounted in its place.
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('Title');
  });
});
