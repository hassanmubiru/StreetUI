# StreetUI — API Issues Discovered While Building the Showcase

These are ergonomics/design issues found by *actually building* the showcase
against the public API. None of them is a correctness bug — the framework
produced correct DOM and reactivity in every case, and all showcase tests pass
without any framework change. They are recorded as developer-experience notes,
ranked by how often a real app hits them.

The scope of this task is to *discover and document*, not to redesign. No API
was changed. Each entry proposes a backward-compatible improvement for later
consideration.

---

## Issue 1 — Reactive non-string values require a manual `derived(String(...))`

**Severity:** Medium (hit by almost every app: counters, totals, flags).

**Current API**

`text()` and `button()` accept `Bindable<string>` only. To display a numeric or
boolean signal you must project it to a string yourself:

```ts
const count = signal(0);
const countText = derived(() => String(count.get())); // extra signal
section.text(countText, { id: 'counter-value' });
```

The existing `basic-app` example works around this with a cast
(`section.text(count as unknown as string)`), which is worse — it bypasses the
type system and only renders because the renderer stringifies internally.

**Desired developer experience**

```ts
section.text(count); // Bindable<string | number | boolean> auto-stringified
```

**Suggested improvement**

Widen `Bindable` for text-like sinks to `string | number | boolean` (or accept
`ReadonlySignal<unknown>` and stringify in the builder, which the renderer
already does for the static case). This removes both the extra `derived` and the
unsafe cast in `basic-app`.

---

## Issue 2 — No conditional-rendering primitive

**Severity:** Medium (state-controlled UI is a core need).

**Current API**

There is no `when`/`if`/`show` in the DSL. To show/hide a block based on state,
the showcase drives a reactive list with a derived array of length 0 or 1:

```ts
const detailsItems = derived(() =>
  showDetails.get() ? [{ id: 'details', text: '…' }] : []);

c.listOf('details', detailsItems, (item, _i, content) => {
  content.text(item.text);
});
```

This is correct and reconciles cleanly, but it is a workaround: the intent
("render this subtree only when the signal is true") is encoded as a list of
zero or one synthetic items, and the conditional content must be expressed as an
item template rather than inline.

**Desired developer experience**

```ts
c.when(showDetails, (content) => {
  content.text('…details…');
});
```

**Suggested improvement**

Add a `when(condition: Bindable<boolean>, builder)` (and optionally an `else`
branch) that compiles to the same reactive-list/reconciler machinery already in
place — no new rendering path required, just a friendlier builder surface.

---

## Issue 3 — Controlled inputs require manual two-way wiring

**Severity:** Low–Medium (every form field).

**Current API**

A controlled input needs the value binding *and* a matching `onInput` handler
that writes back to the same signal:

```ts
form.input({
  value: formName,
  onInput: (v) => formName.set(v),
});
```

Forgetting the `onInput` half silently yields a read-only field; forgetting the
`value` half yields an uncontrolled one. The two halves are easy to
desynchronize.

**Desired developer experience**

```ts
form.input({ bind: formName }); // two-way: reads value + writes on input
```

**Suggested improvement**

Accept an optional `bind: Signal<string>` on `InputOptions` that expands to
`value` + `onInput` internally. Keep the explicit `value`/`onInput` form for
cases that need custom write logic.

---

## Issue 4 — `listOf` item rows carry no addressable key/id on their element

**Severity:** Low (mostly affects testing/targeting).

**Current API**

`listOf` computes an internal reconciliation key for each `<li>`, but the item
element itself gets no `id`/`data-key` attribute. To target a specific row from
the outside you must reach a child that *does* have an id and walk up:

```ts
container.querySelector('#feature-1')!.closest('li');
```

**Desired developer experience**

The item container reflects its identity, e.g. `<li data-key="id:1">`, so a row
is directly selectable and inspectable.

**Suggested improvement**

Emit the reconciliation key as a `data-key` attribute on the `list-item`
element. It is already computed; surfacing it costs nothing and aids debugging,
testing, and DOM inspection. (The internal `_sig` prop must remain hidden — only
the stable identity key should be exposed.)

---

## Things that worked well (no change wanted)

- **Signals/derived/effect** composed cleanly; derived values used for the
  counter display, validation message, submitted message, toggle label and the
  conditional list all updated reactively with no manual subscription code.
- **Keyed reconciliation** preserved `<li>`/`<span>` element identity across
  reorder and updated item content in place on a data change — verified by
  `toBe` identity assertions in the tests.
- **Event wiring** (`onClick`, `onInput`, `onChange`, `onSubmit`) passed the
  right payloads; `onInput`/`onChange` receive the input value directly, and
  `onSubmit` auto-`preventDefault`s.
- **Cleanup** was automatic: after `unmount()` the container is emptied and
  post-unmount signal writes are safe no-ops; heavy list churn left no stale
  per-item click handlers in the graph registry (bounded-registry test).
