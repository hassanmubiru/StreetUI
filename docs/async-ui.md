# Async UI

```
npm install streetui
```

StreetUI models asynchronous data with the reactive `resource` primitive and
renders it with two container helpers — `asyncBoundary` and `errorBoundary`.
Both are **sugar over `resource` + `when()`**: there is no second async system,
no fiber scheduler, and no port of React Suspense. Exactly one branch is live at
a time, and each branch's subtree (with all its handlers and subscriptions) is
torn down when it leaves.

## The `resource` primitive

A resource wraps an async loader and exposes its state as signals:

```ts
import { resource } from 'streetui';

const user = resource(() => fetch(`/api/users/${id}`).then((r) => r.json()), {
  immediate: true,     // start loading on creation (default)
  // initialData: seed // seeds the success branch for SSR/hydration
});

user.status;   // 'idle' | 'loading' | 'success' | 'error' (signal)
user.data;     // ReadonlySignal<T | undefined>
user.error;    // ReadonlySignal<unknown>
user.refetch(); // re-run the loader
user.dispose(); // cancel + release (wire to an owner scope's onCleanup)
```

## `asyncBoundary` — loading / error / success in one place

`asyncBoundary(key, resource, branches)` renders exactly one branch based on the
resource's reactive state. The `success` branch receives the data as a
`ReadonlySignal<T>`, so it updates **in place** on refetch without remounting,
and the old value stays visible while a refetch is in flight.

```ts
page.asyncBoundary('user', user, {
  loading: (c) => c.text('Loading…'),
  error: (c, err, retry) => {
    c.text('Could not load user.');
    c.button('Retry', { onClick: retry });
  },
  success: (c, data) => {
    // data is a ReadonlySignal<T> — bind it, do NOT read .get() eagerly
    c.heading(data); // stays reactive; re-renders in place on refetch
  },
});
```

Because it is built from `when()`, SSR renders whichever branch matches the
resource's current (peeked) state. A server that awaits the resource before
serializing emits the resolved `success` branch, and hydration — seeded via the
resource's `initialData` — reuses it with no duplicate fetch.

Resource cancellation is the resource's own concern: pass its `dispose` to the
owning scope's cleanup (e.g. a component's `ctx.onCleanup(user.dispose)`).

## `errorBoundary` — swap to a fallback on error

`errorBoundary(id, builder, options)` renders `builder` normally, but swaps to
`options.fallback` when the boundary enters an error state. It enters that state
when (a) any observed `source` signal (typically a resource's `error`) becomes
non-null, or (b) the body builder throws synchronously while building.

```ts
page.errorBoundary('profile', (c) => {
  c.asyncBoundary('user', user, { /* … */ });
}, {
  source: user.error,
  onRetry: () => user.refetch(),
  onError: (err) => reportError(err), // observe-only production hook
  fallback: (c, err, retry) => {
    c.text('Something went wrong.');
    c.button('Try again', { onClick: retry });
  },
});
```

The fallback receives the current error and a `retry()` that clears the local
error, runs `onRetry`, and re-attempts the body. `onError` fires each time the
boundary *enters* its error state (including re-entry after a failed retry); it
observes only and never changes behavior. This is **not** a global error trap —
errors remain observable, and the boundary tears down its subtree's
handlers/subscriptions on removal.

## Inspecting a resource

`inspectResource(resource)` returns a non-subscribing snapshot of a resource's
current state for DevTools and diagnostics — it reads, it never pushes.

See also: [Data](data.md) for the write side (`mutation`, `createClient`) and
[DevTools](devtools.md) for inspecting async state.
