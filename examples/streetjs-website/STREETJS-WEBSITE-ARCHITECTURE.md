# StreetJS Website — Architecture

**Date:** 2026-10-07
**Stack:** StreetUI 3.0.0 only. No React/Next/Vue/Svelte, no Tailwind/Bootstrap, no vdom.

---

## 1. One application, one of everything

```
browser-entry.ts ─┐                            ┌─ server-entry.ts
                  ├─► website.ts (composition) ─┤
                  │     createWebsite()         │   renderWebsite(path, {siteUrl})
                  │     mountWebsite()          │
                  ▼                             ▼
             ┌───────────────── shared singletons ─────────────────┐
             │ shell.ts    router (routes.ts)   theme.ts            │
             │ design-system.ts (ds tokens)     search.ts +         │
             │                                  search-keys.ts      │
             └──────────────────────────────────────────────────────┘
                              │
                content.ts ── barrel over ──► content-docs.ts, content-reference.ts,
                                               content-types.ts   (+ playground.ts, backend.ts)
```

Both entries build the **same** composition: the persistent shell plus the matched route, compiled
into one StreetUI app. There is exactly one shell, one router, one theme controller, one design
system, one search system, one SSR entry and one browser entry. `index.ts` is the public barrel.

---

## 2. Rendering & hydration

- **SSR** (`server-entry.ts → renderWebsite`): matches the route with a memory-history router, composes
  shell + outlet, runs `compile → renderToString`, and returns `{ html, head, stateScript, styles,
  status }`. The status is 200 for a known path and 404 for the wildcard / unknown slug. The stylesheet
  is produced from the `styleRegistry` and is **byte-identical for every route** (20,511 B), because the
  `ds` design-system identities are all registered at module load.
- **Client** (`browser-entry.ts → start`): finds `#app` and calls `mountWebsite(el, { hydrate:
  el.hasAttribute('data-ssr') })`. On a hydrating mount, `installClientStyles` **adopts** the server
  stylesheet; on a cold mount it injects `renderStyles` once. The shell nodes are adopted by reference
  (verified: `#brand` / `#page-outlet` are the same node objects after hydration).
- **F-7 (one head per route):** the complete head is emitted once, by the page layout, via `renderHead`.
  The shell never adds a second `head()` layer, so the two would not merge.

---

## 3. Router

`createRouter` with the routes from `routes.ts`; `mountRouter(router, { container, outletId:
'page-outlet', hydrate, shell })`. Link interception is bound to the mount container only. The route
patterns are the twelve required plus `/guides/:slug`, `/blog/:slug` and the `*` wildcard. Unknown doc
sections resolve to the 404 page (`isFallback`), not a blank doc.

---

## 4. Theme

`createTheme({ storage, root, initial })` keeps a `light | dark | system` signal and writes
`data-theme` on `<html>` through an effect. `cycle()` goes light → dark → system. Storage key is
`streetjs-theme`. SSR uses a null storage (label renders "Theme: System"). To keep hydration
consistent, a hydrating client mount **starts** the theme at the server value and applies the stored
choice only after the server markup is adopted — so the first client render matches the server.

---

## 5. Search

`search.ts` exposes one state object (`query`, `open`, `results`, `isEmpty`, `isIdle`, `status`,
`openSearch`, `closeSearch`). Results derive from `searchContent()` over the single 55-item index that
spans all 8 content kinds. `search-keys.ts` holds pure, unit-tested helpers (`shouldOpenSearch`,
`nextFocusId`, `isTypingTarget`, `resultId`) and installs the one document-level `keydown`/`click`
listener. Ctrl/⌘-K opens anywhere; "/" opens only when not typing. Arrow keys move focus across
`[input, ...results]`; Enter navigates to the first result; clicking a result navigates through the
router (needed because the dialog is portalled to `<body>`, outside the router container).

---

## 6. Playground & backend panel

`playground.ts` holds the interactive tools (pg row decoder, migration ordering, secret checker) as
pure signal-driven state — single-line inputs with `;`/`,` separators because the DSL has no multi-line
input. `backend.ts` is the only live integration: it probes a visitor-supplied StreetJS app at the
three real framework routes with explicit idle/loading/ok/unavailable/error states, a 5s timeout, and
URL validation before any fetch. The site never fabricates application data.

---

## 7. Build & serve

`tsup.config.ts` produces two outputs: a self-contained **browser** bundle (streetui inlined,
minified) and **node** outputs for `index.ts` + `server-entry.ts` (streetui external, resolved at run
time). `server.mjs` is a small Node SSR server (env `PORT`/`HOST`/`SITE_URL`) that injects
`html`/`head`/`styles`/`stateScript` into `index.html`, serves the hashed bundle, returns correct
200/404 statuses, and sends security headers (CSP with a per-build inline-script hash,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, referrer policy).

---

## 8. Source map

```
src/
  index.ts            public barrel
  website.ts          createWebsite / mountWebsite (one composition)
  server-entry.ts     renderWebsite (SSR)
  browser-entry.ts    start (hydrate or cold mount)
  shell.ts            persistent nav / footer / search dialog
  routes.ts           all route builders
  components.ts        shared page-layout / nav-link helpers
  theme.ts            light/dark/system controller
  design-system.ts    ds tokens (registered at load → byte-identical CSS)
  metadata.ts         per-route head (title/description/canonical/robots/OG)
  search.ts           search state      search-keys.ts  keyboard + click wiring
  playground.ts       interactive tools backend.ts      health/metrics probe
  content.ts          barrel + search index
  content-docs.ts     18 docs / 6 guides   content-reference.ts  API/examples/plugins/changelog/blog/about
  content-types.ts    content model
  *.test.ts           5 files, 73 tests
```

---

## 9. Known framework gaps (worked around at app level; StreetUI unchanged)

Keyboard binding (document listener), multi-line input (separators), dialog backdrop-close (Close
button), portalled-dialog link interception (document click handler), hash-anchor navigation, reactive
ARIA on the menu toggle, `listOf` key extractor (explicit `id`), and a client-side style injector
(`installClientStyles`). See the Phase 3 report §7 for the full rationale and which are candidates to
upstream.
