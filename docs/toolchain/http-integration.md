# HTTP integration

How a StreetUI app talks to a real HTTP/JSON backend without taking on a
backend framework, a second data system, or a bundled HTTP client.

The reference implementation is `examples/streetui-dashboard`. Its mock data
source and its HTTP data source implement the same `DataSource` interface, so
the UI cannot tell them apart — switching transports is configuration, not a
code change in views.

## What ships

Everything here is already part of `streetui`:

| Primitive | Import from | Role |
|---|---|---|
| `createClient` | `streetui` | Thin, dependency-free wrapper over `fetch`: URL joining, JSON encode/decode, header merging, abort propagation, typed `HttpError`. |
| `fetchWithSignal` | `streetui` | `fetch` + signal, including across mixed DOM/Node `AbortSignal` realms. |
| `resource` | `streetui` | A read: loader → `status`/`data`/`error`, refetch, dispose. |
| `mutation` | `streetui` | A write: explicit `mutate(args)`, last-run-wins, per-run abort signal. |
| `createAuthSession` | `streetui` | `loading` / `authenticated` / `unauthenticated` / `error` composed from `resource` + `mutation`. |
| `HttpError` | `streetui` | `status`, `statusText`, `url`, parsed `body` on non-2xx. |

There is **no** global cache, no automatic invalidation registry and no bundled
axios/fetch polyfill. Invalidation is explicit: a write's `onSuccess` calls the
`refetch()` of the reads it affected.

```ts
import { createClient } from 'streetui';

const api = createClient({ baseUrl: '/api' });

const users = api.resource<User[]>('/users');                 // a read
const create = api.mutation<NewUser, User>('POST', '/users', {
  onSuccess: () => users.refetch(),                           // explicit invalidation
});

await create.mutate({ name: 'Ada', email: 'ada@example.com' });
```

### Response shapes are validated, not assumed

`createClient` decodes JSON but does not know your schema. A status-200 HTML
error page or a truncated payload would otherwise fail deep in the renderer as a
`TypeError`. Validate the fields the UI dereferences and throw a descriptive
error:

```ts
function assertPage(value: unknown): Page<User> {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.total !== 'number') {
    throw new Error('Dashboard API: invalid response from /users');
  }
  return value as Page<User>;
}
```

## Configuration: public base URL vs server-only credentials

Two classes of configuration, and they must never be confused:

| Kind | Prefix | Where it may appear | Example |
|---|---|---|---|
| Public | `STREETUI_PUBLIC_*` | Server **and** browser (inlined into the client bundle by the toolchain) | `STREETUI_PUBLIC_DASHBOARD_API_URL` |
| Secret | anything else | **Server only** — never imported by browser code | `STREETUI_DASHBOARD_API_TOKEN` |

The toolchain replaces `process.env.STREETUI_PUBLIC_<NAME>` with a string
constant in the client bundle (and `undefined` when unset). It does **not**
inline other variables, so a token read from a non-public name stays on the
server — but the discipline is still: browser entry points must never reference
it.

A base URL is not a secret; the browser needs it to make its own requests. A
Bearer token is a secret; only the server process should hold it.

## Server-only authenticated data source

`examples/streetui-dashboard/src/server.ts` builds the data source on the
server and injects it into `createState`. The browser entry (`main.ts`)
rehydrates from the serialized state island and keeps using the public client.

```ts
// server.ts (server only)
import { createServerDataSource } from './http-patterns.js';
import { createState } from './app.js';

export async function render({ url }: { url: string }) {
  const state = createState({ view: viewForPath(url) }, createServerDataSource());
  // …renderTo…

  // serializeState(stateSnapshot) — the token is NOT in the snapshot
}
```

`createServerDataSource` returns:

- the in-process mock when `STREETUI_PUBLIC_DASHBOARD_API_URL` is unset;
- an HTTP data source otherwise, built from a `Client` whose `fetch` is wrapped
  by the bounded read-retry layer and which injects
  `Authorization: Bearer <STREETUI_DASHBOARD_API_TOKEN>` when that variable is
  set.

The token is a header on the server's own requests. It is never written into
HTML, the hydration island, or a client bundle. `http-e2e.test.ts` asserts the
rendered HTML contains neither the token nor the string `Bearer`.

### Prefer HttpOnly cookies for first-party APIs

If the API is served from the same origin (or a subdomain with `SameSite`
cookies), an `HttpOnly; Secure; SameSite=Lax` session cookie is better than a
Bearer token: the browser attaches it automatically, JavaScript cannot read it,
and there is no token for the server to forward. The Bearer path exists for
server-to-server tokens and for tests.

## Read retry, backoff and `Retry-After`

`createReadRetryFetch` wraps `fetch` for **idempotent reads only**:

- retries `429` and `5xx` up to `maxAttempts` (default 3);
- uses a valid `Retry-After` header (seconds or HTTP date) when present,
  otherwise exponential backoff from `baseDelayMs` (default 100 ms);
- passes `GET`/`HEAD` through the loop, and every other method through exactly
  once;
- honours the request's `AbortSignal`, including while waiting between attempts.

```ts
const api = createServerHttpClient({
  baseUrl,
  bearerToken,
  retry: { maxAttempts: 3, baseDelayMs: 100 },
});
```

**Writes are not retried automatically.** A POST/PUT/PATCH/DELETE that timed out
may have already been applied; retrying it can duplicate the effect. If a write
must be retried, give it an idempotency key and implement idempotency on the
server — the client will not invent either.

## Cancellation and what it does *not* mean

`resource` and `mutation` hand their loader a fresh `AbortSignal` per run.
Forward it (as `createClient` does) and an in-flight request is cancelled when:

- a newer run supersedes it (resource refetch, mutation re-`mutate`), or
- the owner is disposed (route teardown, `onCleanup`).

```ts
const search = resource<Result[]>(({ signal }) => api.get('/search', { signal }));
```

Two honest limits, both important:

- **Abort is transport cancellation.** It stops the *client* from waiting. It is
  **not** server-side rollback. A write the server already committed stays
  committed; a long query may keep running server-side. If a write must be
  undone, model that explicitly (a compensating mutation) or make the endpoint
  idempotent.
- **Ignoring the signal is permitted.** A loader that drops `ctx.signal` still
  runs to completion; the late result is discarded by the race guard and never
  applied. Cancellation is an optimisation, not a correctness requirement.

## Mutations and concurrency

A mutation's contract (see `packages/state/README.md`):

- overlapping `mutate()` calls on one instance are **last-run-wins** — the older
  transport is aborted, its late result never writes state, and its callbacks do
  not fire;
- independent mutation instances stay concurrent and never abort each other;
- a cancelled run never resolves the mutation into a false `success`.

## CRUD with explicit refetch

```ts
const list = api.resource<Page<User>>('/users', { query: { page, role } });
const onSuccess = () => list.refetch();
const create = api.mutation<NewUser, User>('POST', '/users', { onSuccess });
const update = api.mutation<{ id: string; changes: Partial<NewUser> }, User>('PATCH', '/users', { onSuccess });
const remove = api.mutation<{ id: string }, void>('DELETE', '/users', { onSuccess });
```

`createDashboardUsersCrud` packages exactly this. Because `onSuccess` is awaited
before `mutate()` resolves, `await create.mutate(...)` means the list is already
up to date.

## Multipart upload (not `createClient`)

`createClient` JSON-stringifies its body and is deliberately **not** an upload
API. Use `fetchWithSignal` with a `FormData` body so the browser supplies the
multipart boundary:

```ts
import { fetchWithSignal, HttpError } from 'streetui';

const body = new FormData();
body.append('file', file, file.name);

const res = await fetchWithSignal(fetch, '/api/uploads', { method: 'POST', body }, signal);
if (!res.ok) throw new HttpError(res.status, res.statusText, '/api/uploads', await res.json());
```

Never set `Content-Type` yourself for `FormData` — that drops the boundary
parameter and the server cannot parse the body.

## Errors in the UI

`HttpError` carries `status` and the parsed `body`. Surface it through an
`errorBoundary` fed by the resource's `error` signal:

```ts
c.errorBoundary('users', (body) => { /* loading / list */ }, {
  source: users.error,
  onRetry: () => void users.refetch(),
  fallback: (fb, error, retry) => {
    const status = error instanceof HttpError ? error.status : 0;
    fb.text(status === 0 ? 'Network error' : `Request failed (${status})`);
    fb.button('Retry', { onClick: retry });
  },
});
```

Error bodies may contain server detail. The framework's diagnostics reporter
never enumerates an error's own properties, so `HttpError.body` does not leak
into a report unless app code reads it deliberately.

## Testing against a real socket

`examples/streetui-dashboard/src/http-e2e.test.ts` runs a test-only
`node:http` server and asserts, over a real socket: query reflection, Bearer
auth success/401, `404`/`409`, bounded `429`/`500` retries with `Retry-After`,
delayed aborts, CRUD-and-refetch, a real multipart body, and SSR rendered from
the live API. `http-patterns.test.ts` unit-tests the retry/auth/upload helpers.
Use dummy tokens only, and close every server in teardown.

## See also

- `packages/state/README.md` — `resource`, `mutation`, cancellation contract.
- `examples/streetui-dashboard/README.md` — running the example in mock and HTTP
  mode.
- [`m15-api-consistency.md`](./m15-api-consistency.md) — the package/subpath API
  inventory the consumer smoke test enforces.
