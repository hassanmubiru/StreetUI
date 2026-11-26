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
  data.ts        Demo data + async data access (clearly labeled)
  components.ts  Reusable typed components (MetricCard, StatusBadge, …)
  server.ts      SSR entry: render(url) → HTML + state island + styles
  main.ts        Hydration entry + theme effect + popstate handling
  app.test.ts    Data-layer, route-mapping, SSR, and form tests
```

`data.ts` is **demonstration data only**, not a real backend. To integrate a
real service, replace `fetchOverview`, `fetchUsers`, and `fetchProjects` with
calls through `createClient({ baseUrl })` against your API — the UI consumes
only the returned shapes.

**Authentication integration point:** `createAuthSession` (from `streetui`)
provides the session lifecycle (`user`, `authenticated`, `loadUser`, `logout`).
Wire it to your identity provider and gate routes in `buildApp` — no auth flow
is faked in this example.

## Docker

```bash
docker build -t streetui-dashboard .
docker run --rm -p 3000:3000 streetui-dashboard
```

The image installs dependencies, runs the production build, and starts the SSR
server on port 3000. `docker stop -t 10` performs a graceful shutdown.

See `docs/toolchain/m12-deployment.md` in the main repository for the full
deployment guide (Node hosting, Docker, static-hosting limits, health checks).
