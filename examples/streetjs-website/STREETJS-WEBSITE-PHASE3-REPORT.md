# StreetJS Website — Phase 3 Report

**Date:** 2026-10-07
**Location:** `examples/streetjs-website/`
**Framework:** StreetUI 3.0.0 (also re-verified against the 3.0.1 tarball — see Build)
**Scope:** Unify `streetjs-website` and `streetjs-docs` into ONE canonical site.

---

## 1. Summary

There is now a single StreetJS website. The second application, `examples/streetjs-docs/`,
has been removed entirely. One shell, one router, one theme system, one design system, one
search system, one SSR entry and one browser entry serve every route. All content is derived
from this project's recorded StreetJS v1.2.8 facts; nothing about APIs, plugins, benchmarks,
roadmap or adoption is invented (see the Content Audit for the line-by-line provenance).

No StreetUI source was modified. The framework limitations this app runs into are all worked
around at the application layer and disclosed in §7.

---

## 2. Final route list

Thirteen route patterns are registered (the twelve required plus the wildcard), expanding to
**42 concrete paths**. Two dynamic parents (`/guides/:slug`, `/blog/:slug`) back the Guides and
Blog index links; they are additive and do not replace any required route.

| Pattern | Kind | SSR status |
|---|---|---|
| `/` | Home | 200 |
| `/getting-started` | Static | 200 |
| `/docs` | Docs index | 200 |
| `/docs/:section` | 18 doc sections | 200 (known slug) / 404 (unknown) |
| `/guides` | Guides index | 200 |
| `/guides/:slug` | 6 guides | 200 / 404 |
| `/api` | API reference | 200 |
| `/examples` | Verified examples | 200 |
| `/playground` | Interactive tools | 200 |
| `/plugins` | Plugin mechanisms | 200 |
| `/changelog` | Release notes | 200 |
| `/blog` | Blog index | 200 |
| `/blog/:slug` | 7 posts | 200 / 404 |
| `/about` | About | 200 |
| `*` | 404 fallback | 404 |

Measured: `renderWebsite()` returns 200 for the 14 real paths probed and 404 for both an unknown
top-level path and an unknown doc slug. The SSR server (`server.mjs`) returns the same statuses
over HTTP.

---

## 3. Duplicated code removed

`examples/streetjs-docs/` is deleted. It was a second public site (its own `app.ts`, `shell.ts`,
`routes.ts`, `theme.ts`, `design-system.ts`, `browser-entry.ts`, `server-entry.ts` and a
`docs-content.ts`). Nothing was copied out of it:

- Its documentation **content** was not merged, because the canonical site already carries the
  18 doc sections derived from the recorded v1.2.8 declarations, and `streetjs-docs/docs-content.ts`
  contained invented-API prose (the reason it was not the source of truth).
- Its **components** (shell/theme/design-system) were duplicates of capabilities the canonical
  site already implements once; there was no unique mechanism to preserve.

Also removed from the website folder: the superseded/over-claiming reports
(`COMPLETION-REPORT.md`, `CRITICAL-DISCOVERY.md`, `FINAL-REPORT.md`, `PHASE1-REPORT.md`,
`PHASE3-MERGE-PLAN.md`, `STREETJS-WEBSITE-PHASE2-REPORT.md`, and the earlier content audit),
the unused `dev-server.mjs`, and the old `README.md`.

The single application is 18 non-test source modules (~3,240 lines) plus 5 test files (~860 lines).

---

## 4. Verified StreetJS capabilities (surfaced in the site)

All of the following come from this project's recorded v1.2.8 `.d.ts` notes. Each carries a
provenance disclaimer on the About page: *recorded from the v1.2.8 type declarations; re-verify
against the installed version.* The notes are ~40–48 days old.

- **HTTP application** (`streetjs/http`): `streetApp(...)`, `StreetHttpApp` (`listen`, `close`,
  `registerController`, `use`, `openApiSpec`, `loadPlugin`/`unloadPlugin`, `.server`).
- **Decorators** (`streetjs`): `@Controller`, `@Get/@Post/@Put/@Delete/@Patch`, `@Validate`,
  `@ApiOperation`, `@Config`, `@Command`, `@Roles/@Permissions`, `@Job`.
- **Database** (`streetjs/database`) and **repositories**, including the documented trap that the
  PostgreSQL driver returns every column as a string (booleans `'t'/'f'`, bigints as strings,
  timestamps not ISO 8601).
- **Migrations** (`streetjs/migrations`) and **seeding** (content-hash tracked).
- **Security** (`streetjs/security`): JWT sessions, RBAC, password hashing (scrypt), with the
  recorded traps (global `rbacGuard` allow-all, `hasRole` ignoring hierarchy, no password hashing
  wired by default, `scrypt` maxmem).
- **Jobs** and **health**: `registerHealthRoutes` (`/health/live`, `/health/ready`),
  `registerJobMetricsRoute` (`/api/jobs/metrics`).
- **Config**, **errors/logging** (the 5xx infrastructure-leak and Logger-meta-clobber traps),
  and HTTP hardening.

The API reference presents **12 groups / 48 entries**. The known-traps are also the subject of the
blog (7 posts) and guides (6), so the risky defaults are documented rather than smoothed over.

**Not claimed anywhere** (listed on About as explicitly unverified): licence terms, repository URL,
contributor list / release cadence, production users / adoption numbers, benchmark figures, and a
scaffolding command (`npx streetjs create`).

---

## 5. Backend integration

The site has no backend of its own and fabricates no application data. The only live integration is
the **Backend status panel** on `/playground`, which probes a *visitor-supplied* running StreetJS
app at exactly the three routes the framework itself provides:

```
GET  {base}/health/live
GET  {base}/health/ready
GET  {base}/api/jobs/metrics
```

No other endpoint is assumed. With no URL entered the panel is idle. Invalid URLs are rejected before
any request (no fetch is made). Each probe reports an explicit state: `ok`, `unavailable` (404 — route
not registered), `error` (non-2xx, unreachable, CORS-blocked, or timeout after 5s). The rest of the
page stays fully functional whatever the backend does — verified by a test that drives a stub `fetch`
returning mixed ok / thrown / 404 results and asserts the page section still renders.

---

## 6. Tests and verification (measured in this sandbox)

| Gate | Result |
|---|---|
| `tsc --noEmit` | ✅ exit 0, no errors |
| `vitest run` | ✅ **5 files, 73 tests, 0 failures** |
| SSR — every route | ✅ 14 × 200, 2 × 404 (unknown path + unknown doc slug) |
| SSR stylesheet byte-identical across routes | ✅ 20,511 B on all 16 probed paths |
| SSR head completeness | ✅ title + description + canonical + robots + og:* on every route |
| Hydration | ✅ shell nodes (`#brand`, `#page-outlet`) adopted by reference; no stylesheet duplication; every primary route hydrates |
| 404 | ✅ wildcard + unknown doc slug render the 404 page, `isFallback` true, `robots=noindex` |
| No console errors | ✅ a test navigates every route, searches and hydrates with `console.error`/`console.warn` spied — zero calls |
| Production build (clean install) | ✅ see below |

**Test files:** `content-integrity.test.ts`, `playground-backend.test.ts`, `search.test.ts`,
`website-mount.test.ts` (happy-dom), `website-ssr.test.ts`.

**Clean-install production build.** Built in a throwaway copy with a fresh `node_modules`, from the
offline **`streetui-3.0.1.tgz`** tarball (no workspace linking):

- `tsc --noEmit` exit 0, `vitest` 73/73, `tsup` exit 0 with **0 warnings**.
- Bundles: `browser-entry.js` 172,313 B (streetui inlined), `server-entry.js` 113,462 B,
  `index.js` 119,689 B.
- The browser bundle is **byte-identical** whether built against the installed 3.0.0 or the 3.0.1
  tarball, confirming the app pins no behaviour that drifted between those two.
- `server.mjs` serves all routes with correct status and sends security headers (CSP with a
  per-build inline-script hash, `X-Content-Type-Options`, `X-Frame-Options: DENY`, referrer policy).

### Browser results — BLOCKED / NOT MEASURED

Chrome, Firefox and **axe-core** were **not run**: this sandbox has no Chrome, no Firefox, no
Playwright and no axe-core (network is blocked, so they cannot be installed). These are the authoritative
quality gates for real rendering, real focus behaviour and automated a11y, and they remain **unverified
here**. They are not simulated or reported as passing. happy-dom covers DOM structure, event wiring,
hydration-by-reference and the no-console-error path, but it is not a browser.

---

## 7. Framework limitations encountered (no StreetUI change made)

Each was handled at the application layer and is listed so a maintainer can decide whether StreetUI
should grow the capability:

- **No key-event binding in the builder DSL** → one browser-only document `keydown` listener, with
  the decision logic in pure, unit-tested helpers (`shouldOpenSearch`, `nextFocusId`, `isTypingTarget`).
- **No multi-line input primitive** → the playground tools use single-line inputs with `;` / `,`
  separators (a jsonb value containing `;` would split the decoder input — disclosed).
- **Dialog has no backdrop-click-to-close** → an explicit Close button (Escape still closes).
- **A body-portalled dialog is outside the router container**, so its link clicks bypass router
  interception → an app-level document click handler navigates result links through the router.
- **No hash-anchor navigation** in the router (the skip link targets `#page-outlet` as a plain anchor).
- **`aria-expanded` is static** on the menu toggle (the DSL binds text, not arbitrary reactive ARIA).
- **`listOf` has no key extractor** → rows carry an explicit `id` field.
- **No client-side style injector ships** → `installClientStyles` adopts the server stylesheet when
  hydrating and otherwise injects `renderStyles` once.
- **Theme-label hydration:** SSR uses null storage so the toggle renders "Theme: System"; on a
  hydrating mount the theme signal starts at the server value and the stored choice is applied only
  **after** adoption, so the first client render matches the server markup. Verified by a test that
  hydrates with a stored `dark` choice.

---

## 8. Remaining work

- Run the real-browser gates in the authoritative environment: Chrome + Firefox render/interaction,
  hydration under a real engine, and **axe-core** on every route.
- Re-verify the StreetJS v1.2.8 facts against the currently installed `streetjs` package (the recorded
  notes are ~40–48 days old) and refresh any that drift.
- Changelog carries a single entry (v1.2.8) because that is the only version with recorded facts; add
  earlier/later entries only when their notes are verified.
- `og:image` is intentionally absent (no verified asset) and `SITE_URL` is a configurable placeholder;
  set a real origin at deploy time.
- Consider upstreaming the most reusable gaps from §7 (key binding, reactive ARIA, dialog backdrop,
  a client style injector) if StreetUI should own them.

---

## 9. Constraint compliance

- Built entirely with StreetUI 3.0.0; no React/Next/Vue/Svelte/Tailwind/Bootstrap.
- Only real, recorded StreetJS information; no invented API/feature/benchmark/plugin/roadmap/adoption.
- StreetUI source unmodified.
- Browser/axe gates reported BLOCKED, never fabricated.
