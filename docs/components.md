# Components

StreetUI does not have a JSX element per tag. Instead you describe UI with a
**builder DSL**: a function receives a builder object and calls methods on it to
add content. A "component" in StreetUI is simply a function that takes a builder
(and whatever data it needs) and populates it. This keeps composition explicit
and keeps the compiled graph free of a virtual DOM.

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

## A note on ergonomics

If you come from React or Vue you may expect free-standing element factories such
as `div(...)` or `button(...)`. StreetUI intentionally does not export those; the
builder DSL is the composition model. See the
[v1.3 report](../V1.3-REAL-WORLD-PERFORMANCE-REPORT.md) for the ergonomics audit
that examined this and concluded the builder model carried the real application
without gaps that justified adding a parallel element API.

Next: [Routing](./routing.md).
