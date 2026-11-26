# Acme Admin — StreetUI dashboard example

A production-oriented SaaS admin dashboard built **entirely with StreetUI's
public APIs** — no React, Vue, Svelte, JSX, or external styling framework.
It demonstrates the patterns a real application needs: application shell,
multiple routes, reusable typed components, reactive state, resources with
loading/error states, validated forms, filtering and pagination, theming,
responsive layout, accessibility, and SSR with hydration.

## Run it

```bash
npm install
npm run dev          # development server (default http://localhost:3000)
npm run build        # production build → dist/client + dist/server
npm run start        # serve the production build (SSR)
npm test             # unit + SSR tests (no browser needed)
npm run typecheck    # strict TypeScript
```

## What's inside

| Route | Demonstrates |
|-------|--------------|
| `/` (overview) | `resource()` with loading/error/retry, `listOf` for metrics and activity, `MetricCard` component |
| `/users` | Search + role filters with refetch, paginated table, `StatusBadge` and `EmptyState` components, disabled pagination buttons |
| `/projects` | Status filters, card grid with badges and progress |
| `/settings` | Three real `createForm` forms (profile, workspace, security) with validators, error display, submitting state, and success messages |
| `*` (404) | Route fallback with navigation back to the overview |

Other patterns: theme toggle (`data-theme` + CSS custom properties),
`a11yIds`-based form labeling, `role="status"`/`role="alert"` live regions,
keyboard-focus styles, and `prefers-reduced-motion` handling.

## Architecture

```
src/
  app.ts         Universal UI definition (routes + shell + pages)
  state.ts       Signals, resources, forms, snapshots, navigation
  data.ts        Demo data + the DataSource contract (clearly labeled)
  http-data.ts   Real HTTP DataSource via createClient({ baseUrl })
  http-patterns.ts  Server-only auth client, read retry, CRUD, multipart upload
  components.ts  Reusable typed components (MetricCard, StatusBadge, …)
  server.ts      SSR entry: render(url) → HTML + state island + styles
  main.ts        Hydration entry + theme effect + popstate handling
  app.test.ts    Data-layer, route-mapping, SSR, and form tests
  http-data.test.ts  HTTP source + resource reliability (abort/race/retry)
  http-patterns.test.ts  Retry/auth/CRUD/upload helper unit tests
  http-e2e.test.ts   Live socket → auth/retry/CRUD/upload/SSR end-to-end
```

`data.ts` is **demonstration data only**, not a real backend. It defines the
`DataSource` contract the UI consumes and a mock implementation.

## Real HTTP integration

The framework primitives (`createClient`, `resource`, `mutation`) are published
in npm 3.2.2. The additional helpers in `http-patterns.ts` and their real-socket
tests are **unreleased example code**, not APIs published by the `streetui`
package.

`http-data.ts` implements the same contract over a real HTTP/JSON API through
`createClient({ baseUrl })`. Set one public environment variable to switch the
whole app — SSR and the browser bundle both read it — from the mock to the API:

```bash
STREETUI_PUBLIC_DASHBOARD_API_URL=https://api.example.com npm run dev
STREETUI_PUBLIC_DASHBOARD_API_URL=https://api.example.com npm run build
```

Expected endpoints (all `GET`, JSON):

| Endpoint | Response |
|----------|----------|
| `{base}/overview` | `{ metrics: [...], activity: [...] }` |
| `{base}/users?query=&role=&page=&pageSize=` | `{ items, total, page, pageSize, pageCount }` |
| `{base}/projects?status=` | `Project[]` |

The variable carries the `STREETUI_PUBLIC_` prefix because a base URL is not a
secret and the browser needs it too. Credentials never belong in a public
variable — pass them as headers to `createClient` from a server-only
integration point. Non-2xx responses surface as `HttpError`, and payloads that
do not match the expected shapes are rejected with a descriptive error instead
of a `TypeError` in the renderer. Unset the variable and the mock source is
used, so `npm test` and the demo run with no backend.

**Authentication integration point:** the server injects a server-only data
source into `createState` (`src/http-patterns.ts` → `createServerDataSource`).
When `STREETUI_DASHBOARD_API_TOKEN` is set it is sent as a Bearer header on the
server's own requests only — it never reaches HTML, the hydration island, or the
browser bundle. `createAuthSession` (from `streetui`) provides the session
lifecycle (`user`, `authenticated`, `loadUser`, `logout`); wire it to your
identity provider and gate routes in `buildApp` — no auth flow is faked here.
Prefer an `HttpOnly` session cookie when the API is same-origin.

Read [`docs/toolchain/http-integration.md`](../../docs/toolchain/http-integration.md)
for retry/`Retry-After`, cancellation limits (abort is not server rollback), and
multipart upload.

## Docker

```bash
docker build -t streetui-dashboard .
docker run --rm -p 3000:3000 streetui-dashboard
```

The image installs dependencies, runs the production build, and starts the SSR
server on port 3000. `docker stop -t 10` performs a graceful shutdown.

See `docs/toolchain/m12-deployment.md` in the main repository for the full
deployment guide (Node hosting, Docker, static-hosting limits, health checks).
