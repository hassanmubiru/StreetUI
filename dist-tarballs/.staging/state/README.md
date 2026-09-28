# @streetui/state

StreetUI's reactive core: signals, derived values, effects, batching, stores —
and `resource()`, the framework-native primitive for async data.

This document focuses on `resource()` and its error-handling companion,
`errorBoundary` (which lives in `@streetui/dsl` because it is a DSL block). For
the signal primitives (`signal`, `derived`, `effect`, `batch`) see the inline
docs in `src/signal.ts`.

## Why a resource primitive

Async data has the same three hard problems in every app: *state* (is it
loading, did it fail, what's the value?), *races* (a slow request must not
overwrite a newer one), and *lifecycle* (a request must stop touching the UI
once its owner is gone). `resource()` solves all three on top of StreetUI's
existing signals — no second reactive system, no virtual DOM, and no HTTP client
baked in. The loader is any `Promise`-returning function, so `fetch()` works
directly and any transport is supported.

## `resource(loader, options?)`

```ts
import { resource } from '@streetui/state';

const users = resource<User[]>(
  ({ signal }) => fetch('/api/users', { signal }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<User[]>;
  }),
);
```

`resource<T>(...)` returns a strongly typed `Resource<T>` — `data` is
`T | undefined`, and `error` is `unknown` (never `any`).

### Loader

```ts
type ResourceLoader<T> = (ctx: { signal: AbortSignal }) => Promise<T> | T;
```

The loader receives an `AbortSignal`. Forward it to `fetch` (or any
signal-aware operation) so in-flight work is cancelled when the resource is
superseded or disposed. Cancellation is opt-in: ignoring the signal is fine, it
just means the request runs to completion (its late result is discarded, never
applied).

### State (all reactive signals)

| Member | Type | Meaning |
|---|---|---|
| `status` | `ReadonlySignal<'idle' \| 'loading' \| 'success' \| 'error'>` | Lifecycle state |
| `data` | `ReadonlySignal<T \| undefined>` | Latest successful value |
| `error` | `ReadonlySignal<unknown>` | Latest error (`undefined` when none) |
| `loading` | `ReadonlySignal<boolean>` | `status === 'loading'` |
| `isRefetching` | `ReadonlySignal<boolean>` | Loading *while* previous `data` is retained |

These are read-only views over internal signals — consumers cannot `.set` them.
Because they are ordinary signals, `when(...)`, `listOf(...)`, `derived(...)`
and effects all work with them unchanged.

**Refetching is not a separate status.** A refetch enters `status === 'loading'`
but keeps the previous `data`; use `isRefetching` (or `loading && data !== undefined`)
to show a "refreshing" affordance without hiding the current data.

### Methods

- `refetch(): Promise<void>` — start a new request. The previous `data` is
  preserved during the reload (and on failure), so the UI never flashes empty.
- `dispose(): void` — abort any in-flight request, drop `watch` subscriptions,
  and permanently stop the resource from writing state. Idempotent.

### Options

```ts
interface ResourceOptions {
  immediate?: boolean;                              // default true — load on creation
  watch?: ReadonlyArray<ReadonlySignal<unknown>>;   // explicit dependencies
  onCleanup?: (fn: () => void) => void;             // auto-register dispose
}
```

- **`immediate`** — set `false` to stay `'idle'` until the first `refetch()`.
- **`watch`** — dependencies are *explicit*. When any listed signal changes, the
  resource refetches. There is no hidden auto-tracking, so there is no way to
  create an accidental infinite refetch loop.
- **`onCleanup`** — pass a route's `ctx.onCleanup` (or any registrar) and
  `dispose` is registered for you.

```ts
const query = signal('');
const results = resource(
  ({ signal }) => search(query.get(), signal),
  { watch: [query], onCleanup: ctx.onCleanup },
);
```

## Guarantees

- **Race safety.** Each run gets a monotonic id; when a response arrives its id
  is compared to the latest. An older response can never overwrite a newer one.
- **Abort.** Every run creates an `AbortController`; superseding a run or
  disposing the resource aborts the previous one. A self-triggered `AbortError`
  is swallowed (it is not a real failure and is never surfaced as `error`).
- **Lifecycle.** After `dispose()` no further state writes happen — a late
  resolution or rejection is ignored. Wire `dispose` to the owner's cleanup and
  the resource can never update detached DOM.

## Error boundaries (`errorBoundary`, from `@streetui/dsl`)

`errorBoundary` contains failures to a region of the tree instead of letting one
failed async area take down the app:

```ts
c.errorBoundary('users', (body) => {
  body.when(users.loading, (l) => l.text('Loading…'));
  body.listOf('list', derived(() => users.data.get() ?? []), (u, _i, x) =>
    x.text(u.name),
  );
}, {
  source: users.error,                     // one signal or an array of them
  onRetry: () => void users.refetch(),
  fallback: (fb, error, retry) => {
    fb.text(`Failed: ${(error as Error).message}`);
    fb.button('Retry', { onClick: retry });
  },
});
```

Behaviour:

- Enters the error state when any observed **`source`** signal becomes non-null,
  **or** when the body builder throws synchronously while building.
- **`retry()`** clears the local error, invokes `onRetry` (typically
  `resource.refetch`), and re-attempts the body — without rebuilding the app.
- Reuses the same reactive `when()` machinery, so the fallback subtree and every
  handler/subscription inside it is torn down on removal.
- It does **not** trap arbitrary global errors, and errors remain observable via
  the resource's `error` signal.

## SSR seeding

For server rendering, `resource()` accepts a server-resolved result so the
client does not re-fetch on hydration:

```ts
const users = resource(loadUsers, {
  initialData: seed,        // from the SSR state island (see @streetui/renderer)
  // initialError: err,     // or seed an error instead
  // initialStatus: 'success',
});
```

When any of `initialData` / `initialError` / `initialStatus` is provided, the
resource starts in the corresponding non-`idle` state (`'success'` from
`initialData`, `'error'` from `initialError`, or an explicit `initialStatus`)
and **skips the automatic initial load**. It can still `refetch()` on demand;
pass `immediate: true` if you deliberately want a client-side refetch right after
hydration. Read the seed out of the SSR island with `readState` from
`@streetui/renderer`.

## What this is *not*

`resource()` is deliberately small. It is not a caching layer, query library,
mutation framework, global store, suspense integration, or devtools. Those are
separate concerns that can be composed on top if and when they are needed.
