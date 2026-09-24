# Data

Asynchronous data is loaded with `resource`. A resource wraps an async loader
and exposes its status, data, and error as reactive signals, plus imperative
controls for refetch, abort, and disposal. It integrates with `when` and
`errorBoundary` so loading and error UI are ordinary conditional rendering.

## Creating a resource

The loader receives an object containing an `AbortSignal`, so a resource can
cancel in-flight work when it is refetched or disposed:

```ts
import { resource } from 'streetui';

const userDetail = resource<UserDetail>(
  async ({ signal }) => {
    const res = await fetch(`/api/users/${id}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  { immediate: true },   // start loading on creation; omit/false to load on demand
);
```

Options include `immediate` (load on construction), `initialData` (a value to
start with), and `watch` (reactive dependencies that trigger a reload when they
change).

## Reading resource state

```ts
userDetail.status;        // ReadonlySignal<'idle' | 'loading' | 'success' | 'error'>
userDetail.data;          // ReadonlySignal<T | undefined>
userDetail.error;         // ReadonlySignal<unknown>
userDetail.loading;       // ReadonlySignal<boolean>
userDetail.isRefetching;  // ReadonlySignal<boolean>

userDetail.refetch();     // reload (aborts any in-flight load first)
userDetail.dispose();     // abort + release watchers
```

## Rendering load / success / error

Compose the states with `when` for loading and success and an `errorBoundary`
for failure with retry:

```ts
import { derived } from 'streetui';

s.errorBoundary('detail-boundary', (b) => {
  b.when(userDetail.loading, (l) => l.text('Loading…', { id: 'detail-loading' }));
  b.when(derived(() => userDetail.data.get() !== undefined), (d) =>
    d.text(derived(() => userDetail.data.get()?.name ?? ''), { id: 'detail-name' }));
}, {
  source: userDetail.error,
  onRetry: () => void userDetail.refetch(),
  fallback: (fb, _err, retry) => {
    fb.text('Failed to load user.', { id: 'detail-error' });
    fb.button('Retry', { id: 'detail-retry', onClick: retry });
  },
});
```

## Abort and route changes

Because the loader is handed an `AbortSignal`, navigating away mid-fetch cancels
the request instead of leaking it. Register the disposal with the route's
cleanup hook:

```ts
function buildUserDetail(page: PageDSL, deps: AppDeps, ctx: RouteContext): void {
  ctx.onCleanup(() => userDetail.dispose());   // aborts an in-flight load
  // ...
}
```

The loader should honour `signal.aborted` (and pass `signal` to `fetch`), which
turns "route change during fetch" into a clean cancellation with no state update
against a torn-down view.

## Server-seeded resources

For SSR you can construct a resource that does not fire on the server and let the
client resume with hydrated state — see [SSR](./ssr.md) and
[Hydration](./hydration.md). The performance app seeds its deps from a state
island so the client rebuilds the same resource configuration the server used.

Next: [SSR](./ssr.md).
