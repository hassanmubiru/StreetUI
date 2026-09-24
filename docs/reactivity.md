# Reactivity

StreetUI ships one reactive system. There is no second store library, no proxy
magic, and no virtual DOM. Three primitives cover the whole model: `signal`,
`derived`, and `effect`, with `batch` for grouping writes.

## Signals

A `signal` holds a value and tracks who reads it.

```ts
import { signal } from 'streetui';

const query = signal('');
query.get();          // read — tracked when called inside a derived/effect
query.peek();         // read — never tracked
query.set('ada');     // write — notifies dependents
query.subscribe((v) => console.log('query is now', v)); // returns an unsubscribe fn
```

`get()` versus `peek()` is the distinction to internalize:

- Use **`get()`** when the current computation should re-run if the value
  changes. Inside a `derived` or `effect`, or inside a DSL `derived(() => ...)`
  binding, that is what you want.
- Use **`peek()`** when you need the value but must *not* create a dependency —
  most commonly inside an event handler that reads-then-writes:

```ts
s.button('inc', { id: 'inc', onClick: () => count.set(count.peek() + 1) });
```

Reading `count.get()` there would be harmless but pointless; `peek()` states the
intent clearly: "just give me the value, don't subscribe me."

## Derived values

A `derived` computes a value from other reactive reads. It recomputes only when
one of the signals it actually read changes, and it caches its result otherwise.

```ts
import { signal, derived } from 'streetui';

const rows = signal(users);
const query = signal('');
const visible = derived(() => rows.get().filter((u) => u.name.includes(query.get())));

visible.get();  // recomputes only after rows or query changes
```

`derived` is a `ReadonlySignal` — it has `get`/`peek`/`subscribe` but no `set`.
Chained deriveds are fine; the graph tracks dependencies transitively, so a
derived over a derived only recomputes when a leaf it depends on changes.

In the performance app the entire 10,000-row table is driven by one derived:

```ts
const visibleRows = derived(() =>
  selectRows(rows, { query: query.get(), role: roleFilter.get(),
    sortKey: sortKey.get(), sortDir: sortDir.get() }));
```

Changing the search query recomputes `visibleRows`, and the keyed-list renderer
reconciles only the rows that actually moved, appeared, or disappeared.

## Effects

An `effect` runs a side effect and re-runs when its reactive reads change. It is
for talking to the outside world (logging, imperative DOM you own, network
kicks) — not for updating StreetUI's own DOM, which the renderer handles.

```ts
import { effect } from 'streetui';

const stop = effect(() => {
  document.title = `${count.get()} items`;
});
stop(); // dispose when done
```

Effects created inside a mounted component are disposed automatically on unmount
(see [Components](./components.md)); a free-standing effect returns a disposer
you call yourself.

## Batching

Multiple writes in the same tick already coalesce, but `batch` makes a group of
writes settle as one update, so dependents recompute once:

```ts
import { batch } from 'streetui';

batch(() => {
  firstName.set('Ada');
  lastName.set('Lovelace');
}); // dependents of both run a single time
```

`flushSync` is available when you need updates applied synchronously before the
next line (for example in a test asserting DOM state immediately after a write).

## Why this matters for the DOM

Because a binding subscribes to exactly the signals it reads, a write updates
exactly the DOM regions bound to that signal. Toggling one of a thousand
controls in the performance app produces a constant, tiny number of DOM writes
regardless of how many controls exist — see the fine-grained proof in the
[performance results](../benchmarks/results/v1.3/streetui-node.json). That is a
property of the reactive graph, not of a diff.

Next: [Components](./components.md).
