# Components

StreetUI does not have a JSX element per tag. Instead you describe UI with a
**builder DSL**: a function receives a builder object and calls methods on it to
add content. The lightest-weight "component" in StreetUI is simply a function
that takes a builder (and whatever data it needs) and populates it. This keeps
composition explicit and keeps the compiled graph free of a virtual DOM.

When a reusable unit needs to **own** things — local state, an effect, a
resource, a form, or any cleanup that must run when it leaves the screen — reach
for the first-class [`component()`](#first-class-components-component) primitive
instead. Both models compile into the same pipeline (DSL → graph → renderer);
there is no second reactive system and no second renderer.

## The page and section builders

The top-level unit is a page. Inside it you open sections, and inside sections
you add leaf content or more sections.

```ts
import { streetui, derived } from 'streetui';

const app = streetui.app({ name: 'demo' });
app.page('home', (page) => {
  page.section('header', (h) => {
    h.heading('Dashboard', { id: 'h', level: 1 });
    h.text(derived(() => `theme:${theme.name}`), { id: 'theme' });
    h.button('refresh', { id: 'refresh', onClick: onRefresh });
  }, { id: 'app-header' });
});
```

The common builder methods, all of which accept an `id` and other props in the
trailing options object:

- `heading(text, { id, level })` — a semantic heading.
- `text(value, { id, class })` — a text node; `value` may be a string or a
  reactive `derived(...)`.
- `button(label, { id, onClick, disabled })` — `label` and `disabled` may be
  reactive.
- `link(label, { id, href })` — navigable link (intercepted by the router).
- `input({ id, bind, type, placeholder })` — an input; see [Forms](./forms.md).
- `section(name, builder, { id })` — a nested region; the second argument is
  another builder function. This is how "children" work.

## Composition: components are functions

Because a builder is just an argument, you factor UI by writing functions that
take a builder. The performance app's routes are exactly this — each is a
`(page, deps) => void`:

```ts
import { derived, type PageDSL } from 'streetui';

export function buildOverview(page: PageDSL, deps: AppDeps): void {
  page.section('overview', (s) => {
    s.heading(deps.i18n.t('navHome'), { id: 'overview-heading', level: 2 });
    s.text(derived(() => `Total users: ${deps.totalCount.get()}`), { id: 'overview-total' });
    s.link(deps.i18n.t('navUsers'), { href: '/users', id: 'overview-go-users' });
  }, { id: 'route-overview' });
}
```

To reuse a piece, pass the current builder into another function:

```ts
function metricCard(s: SectionDSL, label: string, value: ReadonlySignal<number>): void {
  s.text(derived(() => `${label}: ${value.get()}`), { class: 'metric' });
}

page.section('metrics', (m) => {
  metricCard(m, 'Total', deps.totalCount);
  metricCard(m, 'Active', deps.activeCount);
}, { id: 'metrics' });
```

There is no props/children ceremony: "props" are the function's parameters, and
"children" are whatever you add inside the builder callback.

## Conditional rendering: `when`

`when(condition, builder)` mounts a subtree while a reactive condition is true
and tears it down when it becomes false. The condition is any boolean
`ReadonlySignal` (often a `derived`).

```ts
s.button('open', { id: 'open-modal', onClick: () => modalOpen.set(true) });
s.when(modalOpen, (m) => {
  m.section('modal', (d) => {
    d.text('Are you sure?', { id: 'modal-body' });
    d.button('confirm', { id: 'modal-confirm', onClick: confirm });
  }, { id: 'modal' });
});
```

When `modalOpen` flips to `false`, the modal's nodes are removed and any effects
or subscriptions created inside are disposed.

## Lists: `listOf`

`listOf(name, source, itemBuilder, { id })` renders a reactive, keyed list. The
`source` is a signal or derived of an array; the item builder runs per item.
StreetUI reconciles with a minimal-move (LIS-based) algorithm, so re-sorting or
filtering moves only the rows that actually changed position.

```ts
s.listOf('rows', visibleRows, (row, _index, c) => {
  c.text(`${row.id}`, { class: 'cell cell-id' });
  c.text(row.name, { class: 'cell cell-name' });
  c.text(row.email, { class: 'cell cell-email' });
}, { id: 'users-table' });
```

The performance app renders 10,000 rows this way; a search that narrows the list
removes only the filtered-out rows rather than rebuilding the table.

## Error boundaries

`errorBoundary(name, builder, { source, onRetry, fallback })` renders its
primary builder unless the `source` signal (typically a resource's `error`)
holds an error, in which case it renders the `fallback`.

```ts
s.errorBoundary('detail-boundary', (b) => {
  b.when(userDetail.loading, (l) => l.text('Loading…', { id: 'detail-loading' }));
  b.when(derived(() => userDetail.data.get() !== undefined), (d) =>
    d.text(derived(() => userDetail.data.get()?.name ?? ''), { id: 'detail-name' }));
}, {
  source: userDetail.error,
  onRetry: () => void userDetail.refetch(),
  fallback: (fb, _err, retry) => {
    fb.text('Failed to load user.', { id: 'detail-error' });
    fb.button('retry', { id: 'detail-retry', onClick: retry });
  },
});
```

## First-class components: `component()`

A plain builder function is enough for pure markup, but it cannot *own* anything
— local state has to be hoisted to a route or a shared deps bag, and there is no
place to register cleanup. `component()` closes that gap. It defines a reusable
unit with typed props, its own local state, native children, and automatic
teardown, and it compiles to a single `<div>` wrapper node in the existing graph
(so server rendering and positional hydration keep working unchanged).

```ts
import { streetui, component, signal } from 'streetui';

const Counter = component<{ start: number }>((props, ctx) => {
  // setup runs once, synchronously, at build time — like a constructor.
  const count = signal(props.start);
  ctx.onCleanup(() => console.log('Counter went away'));

  // Return the render function: it receives the component's own scope.
  return (c) => {
    c.text(count, { id: 'count' });
    c.button('inc', { id: 'inc', onClick: () => count.set(count.peek() + 1) });
  };
}, { name: 'Counter' });
```

Mount it from any container scope — a page, a section, another component — with a
stable `key`, the definition, and its props:

```ts
app.page('home', (page) => {
  page.component('c1', Counter, { start: 0 });
});
```

The wrapper carries an inspectable `data-streetui-component="Counter"` attribute,
which is what DevTools and the testing helpers use to find instances.

### Typed props

Props are an ordinary TypeScript parameter — there is no runtime schema. Passing
the wrong shape at a call site is a compile error:

```ts
page.component('c1', Counter, { start: 'nope' }); // ✗ type error: start is a number
```

Props can be plain values *or* reactive `Signal`s. A `Signal` prop drives a
fine-grained update **without re-running `setup`** — the render body subscribes
to it directly, exactly like any other binding:

```ts
const Name = component<{ name: Signal<string> }>((props) => (c) => {
  c.text(props.name, { id: 'n' }); // updates in place when the signal changes
}, { name: 'Name' });
```

### Local state and lifecycle

Inside `setup` you use the same reactivity primitives as everywhere else —
`signal`, `derived`, `effect`, `batch`. The lifecycle `ctx` gives you ownership
hooks:

- `ctx.onCleanup(fn)` — run `fn` when the component unmounts (route change, a
  `when` flipping false, a keyed-list row being removed, or a full unmount).
- `ctx.effect(fn)` — like the global `effect`, but its disposer is registered
  for cleanup automatically. `fn` may return a teardown function.
- `ctx.renderChildren(scope)` — render the caller-supplied children here (slots,
  below).
- `ctx.key` — the stable identity key passed at the call site.

Cleanups run children-first, so a parent component tears down after everything
it contains. Because a resource, form, i18n binding, or context provider created
in `setup` is just a normal object, routing its disposer through `ctx.onCleanup`
is all that ownership requires:

```ts
import { component, resource } from 'streetui';

const UserCard = component<{ id: string }>((props, ctx) => {
  const user = resource(() => fetchUser(props.id), { onCleanup: ctx.onCleanup });
  return (c) => c.text(user.data as Signal<string>, { id: 'name' });
}, { name: 'UserCard' });
```

### Children and slots

The optional fourth argument to `.component(...)` is a builder for the
component's children. The component decides where they land by calling
`ctx.renderChildren`:

```ts
const Panel = component<{ title: string }>((props, ctx) => (c) => {
  c.heading(props.title, { level: 2 });
  c.container('body', (slot) => ctx.renderChildren(slot), { class: 'panel-body' });
}, { name: 'Panel' });

page.component('p', Panel, { title: 'Settings' }, (slot) => {
  slot.text('Anything the caller passes lands in the panel body.');
});
```

### Composing components

A component's render scope is a normal `ContainerDSL`, so it can mount other
components — composition is just calling `.component(...)` again:

```ts
const List = component((_props) => (c) => {
  c.component('a', UserCard, { id: '1' });
  c.component('b', UserCard, { id: '2' });
}, { name: 'List' });
```

Overlays (`dialog`, `popover`, `tooltip`, `dropdown`, `toast`), error boundaries,
forms, and i18n all work inside a component with no special wiring — see
[Data & Resources](./data.md), [Forms](./forms.md), and [SSR](./ssr.md).

### Inspecting and testing components

DevTools exposes `inspectComponents(graph)`, which lists every instance in
document order with its stable `key`, human-readable `name`, depth, and child
count. See [DevTools](./devtools.md).

The `streetui/testing` entry adds component-aware helpers on top of `render`:

```ts
import { renderComponent, findComponent, trigger, hydrateComponent } from 'streetui/testing';

const r = renderComponent(Counter, { start: 0 });
trigger(r.find('#inc'), 'click');
r.flush();
expect(r.find('#count').textContent).toBe('1');
r.unmount();
```

`renderComponent(def, props, children?)` mounts one component in a throwaway host
app and returns the usual result plus its root element; `hydrateComponent(build)`
does the SSR-then-hydrate round trip; `findComponent` / `findAllComponents` /
`getComponentName` locate instances by name; `trigger(el, type, init?)` dispatches
a bubbling DOM event. See [Testing](./testing.md).



If you come from React or Vue you may expect free-standing element factories such
as `div(...)` or `button(...)`. StreetUI intentionally does not export those; the
builder DSL is the composition model. See the
[v1.3 report](../V1.3-REAL-WORLD-PERFORMANCE-REPORT.md) for the ergonomics audit
that examined this and concluded the builder model carried the real application
without gaps that justified adding a parallel element API.

Next: [Routing](./routing.md).
