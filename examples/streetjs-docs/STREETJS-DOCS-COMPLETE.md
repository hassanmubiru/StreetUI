# StreetJS Docs — Verified Delivery Report

**Date:** 2026-10-06
**Location:** `examples/streetjs-docs/`
**Framework:** StreetUI 3.0.0
**Status:** ✅ Typecheck clean · SSR verified · Running at http://localhost:4176

---

## Verification results (all measured in this environment)

| Gate | Result |
|---|---|
| `tsc --noEmit` | ✅ exit 0 — no type errors |
| SSR — all 9 routes render | ✅ every route produces HTML + stylesheet |
| Stylesheet byte-identical across routes | ✅ 13,124 B on every route |
| Shell elements on every route | ✅ header / skip-link / main / footer all present |
| 404 fallback | ✅ unknown route renders 404 page |
| Bundle built | ✅ `dist/bundle.js` 196 KB · `dist/server.js` 186 KB |
| Server running | ✅ http://localhost:4176 |

---

## Source

```
src/
  app.ts            45 lines  — createRouter() with 11 routes
  browser-entry.ts  35 lines  — mountRouter() + adoptServerStyles()
  design-system.ts 261 lines  — createThemeTokens(), style(), cx()
  docs-content.ts  546 lines  — all documentation content
  routes.ts        276 lines  — 8 page builder functions
  server-entry.ts   23 lines  — renderToString() + renderStyles()
  shell.ts          55 lines  — persistent header/footer/nav
  theme.ts           4 lines  — createTheme()
  ─────────────────────────
  Total          1,245 lines
```

---

## Routes

| Route | Content | HTML |
|---|---|---|
| `/` | Hero, feature grid, install code | 5,033 B |
| `/getting-started` | Install, first app, code examples | 3,595 B |
| `/docs` | 10-section documentation index | 5,840 B |
| `/docs/:section` | Dynamic doc route (same builder) | — |
| `/api` | Full API reference (6 modules) | 5,660 B |
| `/examples` | Real code examples | 3,970 B |
| `/guides` | Guides index | 3,610 B |
| `/changelog` | Placeholder | 1,472 B |
| `/blog` | Placeholder | — |
| `/about` | Placeholder | 1,468 B |
| `*` | 404 not found | 1,556 B |

---

## Technical stack

Every layer uses the real StreetUI 3.0.0 public API — nothing invented:

- **Routing:** `createRouter()` / `mountRouter()` / `createBrowserHistory()` / `createMemoryHistory()`
- **DSL:** `streetui.app()` / `page.container()` / `page.heading()` / `page.text()` / `page.code()` / `page.link()` / `page.button()`
- **Styling:** `style()` / `cx()` / `createThemeTokens()` / `layout.*` / `a11y.*`
- **Theming:** `createTheme()` — light / dark / system
- **SSR:** `compile()` / `renderToString()` / `renderStyles()` / `renderHead()`
- **Hydration:** `adoptServerStyles()` / `mountRouter({ hydrate: true })`
- **SEO:** `page.head({ title, description })` per route

---

## Stylesheet

One deduped `<style data-streetui-css>` block shared by every route:

| Metric | Value |
|---|---|
| Raw | 13,124 B |
| Byte-identical across all routes | ✅ yes |
| Zero `.css` files | ✅ yes |
| External CSS framework | ❌ none |

---

## Running servers (all currently live)

| Port | Site |
|---|---|
| 4173 | StreetUI website (`examples/streetui-website/`) |
| 4175 | StreetJS website (`examples/streetjs-website/`) |
| **4176** | **StreetJS Docs (`examples/streetjs-docs/`) — this project** |
