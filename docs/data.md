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

## Mutations — the write side

`resource` reads; `mutation` writes. A mutation wraps an async writer and exposes
the same shape of reactive state, plus `mutate()` to run it:

```ts
import { mutation } from 'streetui';

const saveUser = mutation<{ id: number; name: string }, User>(
  (patch) => api.put(`/users/${patch.id}`, patch),
  {
    onSuccess: () => userDetail.refetch(),   // explicit, local invalidation
    onError:   (err) => log(err),
    onSettled: () => {},
  },
);

saveUser.status;   // ReadonlySignal<'idle' | 'loading' | 'success' | 'error'>
saveUser.data;     // ReadonlySignal<TResult | undefined>
saveUser.error;    // ReadonlySignal<unknown>
saveUser.pending;  // ReadonlySignal<boolean>

await saveUser.mutate({ id: 1, name: 'Ada' }); // resolves the result, re-throws on failure
saveUser.reset();
saveUser.dispose();
```

There is **no global cache and no auto-invalidation registry**. Invalidation is
explicit and local: a mutation says which read it refreshes by calling that
resource's `refetch()` from `onSuccess`. Concurrent `mutate()` calls are guarded
by a monotonic run id — the newest run wins and stale runs never write state.

## The write path: form → mutation → invalidate → UI

The pieces compose without a second data system. A validated `createForm`
submit runs a `mutation`; its `onSuccess` refetches the `resource` that feeds the
view; the view updates through the ordinary reactive bindings:

```ts
const list = resource<Item[]>(() => api.get('/items'));

const addItem = mutation<string, void>(
  (name) => api.post('/items', { name }),
  { onSuccess: () => list.refetch() },
);

const form = createForm<{ name: string }>({
  initialValues: { name: '' },
  validators: { name: required('Name is required') },
  onSubmit: (values) => { void addItem.mutate(values.name); }, // must return void
});
```

An invalid form never runs the mutation. This exact flow is exercised end to end
(DSL → compiler → renderer → DOM) in `examples/streetui-showcase` and in the
renderer's `data-flow.test.ts`.

## Optional HTTP client

`createClient` is an optional, dependency-free JSON client over the global
`fetch`. It does not import any server framework and adds no dependency; inject a
`fetch` for tests. It also produces `resource`/`mutation` bound to a path:

```ts
import { createClient, HttpError } from 'streetui';

const api = createClient({ baseUrl: '/api', headers: { Authorization: `Bearer ${token}` } });

const users = api.resource<User[]>('/users', { query: { active: true } });
const create = api.mutation<NewUser, User>('POST', '/users', { onSuccess: () => users.refetch() });

try {
  await api.get('/secret');
} catch (e) {
  if (e instanceof HttpError) console.log(e.status, e.body); // typed, carries parsed body
}
```

`get` / `post` / `put` / `patch` / `del` cover the verbs; a non-2xx response
throws a typed `HttpError` carrying `status`, `statusText`, `url`, and the parsed
`body`. The client forwards a resource's abort `signal` to `fetch`, so route
changes cancel in-flight requests exactly as with a hand-written loader.

## Authentication

`createAuthSession` turns a "who am I" loader into the reactive states a sign-in
UI switches on. It is built entirely from `resource` + `mutation` and is
router-agnostic — it handles no credentials itself:

```ts
import { createAuthSession } from 'streetui';

const auth = createAuthSession<User>({
  loadUser: async ({ signal }) => {
    const res = await fetch('/api/me', { signal });
    return res.ok ? res.json() : null;   // null ⇒ unauthenticated
  },
  logout: () => fetch('/api/logout', { method: 'POST' }).then(() => undefined),
});

auth.status;          // 'loading' | 'authenticated' | 'unauthenticated' | 'error'
auth.user;            // ReadonlySignal<User | undefined>
auth.authenticated;   // ReadonlySignal<boolean>
auth.loggingOut;      // ReadonlySignal<boolean>
await auth.refresh(); // re-run loadUser (e.g. after a token refresh)
await auth.logout();  // run the configured logout, then refresh → unauthenticated
```

A refetch keeps the prior user visible (no flicker). Wire navigation into your
router by reading `auth.status` in a route's setup and navigating to the login
route when it is `unauthenticated`; a thrown guard is caught by `errorBoundary`.

Next: [Application platform](./application-platform.md) · [SSR](./ssr.md).

