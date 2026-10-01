/**
 * StreetUI Website — interactive Playground, built in StreetUI itself.
 *
 * Not an embedded React/Vue editor: the Playground is a StreetUI page tree whose
 * demos are driven by real signals and real event handlers. A `demo` selector
 * signal chooses which live example is mounted via when(); each demo mutates its
 * own signals and the keyed reconciler patches the DOM.
 */

import { signal, derived, type Signal } from 'streetui';
import type { ContainerDSL } from 'streetui';

export type DemoId = 'counter' | 'list' | 'greeter';

export interface PlaygroundState {
  readonly demo: Signal<DemoId>;
  readonly count: Signal<number>;
  readonly items: Signal<{ id: number; label: string }[]>;
  readonly name: Signal<string>;
  select(demo: DemoId): void;
  increment(): void;
  decrement(): void;
  reset(): void;
  addItem(): void;
  removeLast(): void;
}

export function createPlaygroundState(): PlaygroundState {
  const demo = signal<DemoId>('counter');
  const count = signal(0);
  const items = signal<{ id: number; label: string }[]>([
    { id: 1, label: 'First' },
    { id: 2, label: 'Second' },
  ]);
  const name = signal('');
  let nextId = 3;

  return {
    demo, count, items, name,
    select(d) { demo.set(d); },
    increment() { count.update((n) => n + 1); },
    decrement() { count.update((n) => n - 1); },
    reset() { count.set(0); },
    addItem() {
      const id = nextId++;
      items.update((arr) => [...arr, { id, label: `Item ${id}` }]);
    },
    removeLast() { items.update((arr) => arr.slice(0, Math.max(0, arr.length - 1))); },
  };
}

export function buildPlayground(content: ContainerDSL, state: PlaygroundState): void {
  // Demo selector.
  content.container('pg-selector', (sel) => {
    sel.button('Counter', { id: 'pg-pick-counter', onClick: () => state.select('counter') });
    sel.button('List', { id: 'pg-pick-list', onClick: () => state.select('list') });
    sel.button('Greeter', { id: 'pg-pick-greeter', onClick: () => state.select('greeter') });
  }, { id: 'pg-selector' });

  // Counter demo.
  content.when(derived(() => state.demo.get() === 'counter'), (c) => {
    c.heading('Counter', { level: 2, id: 'pg-counter-title' });
    c.text(state.count, { id: 'pg-counter-value' });
    c.button('Increment', { id: 'pg-inc', onClick: () => state.increment() });
    c.button('Decrement', { id: 'pg-dec', onClick: () => state.decrement() });
    c.button('Reset', { id: 'pg-reset', onClick: () => state.reset() });
  });

  // Reactive list demo.
  content.when(derived(() => state.demo.get() === 'list'), (c) => {
    c.heading('Reactive list', { level: 2, id: 'pg-list-title' });
    c.listOf('pg-items', state.items, (item, _i, row) => {
      row.text(item.label, { id: `pg-item-${item.id}` });
    }, { id: 'pg-items' });
    c.button('Add', { id: 'pg-add', onClick: () => state.addItem() });
    c.button('Remove last', { id: 'pg-remove', onClick: () => state.removeLast() });
  });

  // Greeter demo (bound input → derived text).
  content.when(derived(() => state.demo.get() === 'greeter'), (c) => {
    c.heading('Greeter', { level: 2, id: 'pg-greeter-title' });
    c.input({ id: 'pg-name', type: 'text', placeholder: 'Your name', bind: state.name });
    c.text(
      derived(() => {
        const n = state.name.get().trim();
        return n === '' ? 'Type your name above.' : `Hello, ${n}!`;
      }),
      { id: 'pg-greeting' },
    );
  });
}
