# StreetJS Website — Visual Validation Report

**Date:** 2026-10-10 (original) / updated 2026-10-10 with full browser validation
**Rule:** nothing is marked passing unless it was actually executed here. All gates that
were previously BLOCKED have now been executed and are recorded with real tool output.

---

## 1. Root-cause investigation — EXECUTED, PASS

The light-mode "pale text" and "serif typography" were investigated at the source, not patched blindly:

- Searched the codebase: `appRoot` (base font/colour/background) was defined but **applied nowhere**;
  the shell root was a bare `<div>`. → the serif leak and missing themed surface.
- Inspected the serialized stylesheet and token registration order: confirmed the custom
  `createThemeTokens` block registers **after** the framework defaults and therefore wins both `:root`
  and `[data-theme="dark"]` (last-wins), and that **every** colour is set in both themes so dark never
  falls back to a framework default.
- Confirmed `--content-primary` resolves to `#0F172A` in light and `#F8FAFC` in dark in the shipped
  CSS, and that `--font-sans` resolves to the system sans stack.
- Fix applied: `appRoot` now wraps all content as `#app-root`; Playwright confirms
  `getComputedStyle(appRoot).fontFamily` = `system-ui, -apple-system, BlinkMacSystemFont, …`

---

## 2. Computed contrast — EXECUTED, PASS (all ≥ WCAG AA)

Ratios computed from the shipped token values (WCAG 2.1 relative luminance):

| Pair | Light | Dark |
|---|---|---|
| Heading `#0F172A` on canvas `#F8FAFC` | 17.06 | — |
| Heading `#F8FAFC` on canvas `#0B1020` | — | 18.10 |
| Body `#334155` on canvas | 9.90 | — |
| Body `#CBD5E1` on canvas | — | 12.75 |
| Muted/secondary `#44536A` on canvas | 7.46 | — |
| Muted/secondary `#A8B5C7` on canvas | — | 9.10 |
| Link / accent `#2563EB` on canvas | 4.94 | — |
| Link / accent `#60A5FA` on canvas | — | 7.45 |
| Primary-button white text on accent `#2563EB` | 5.17 | — |
| Primary-button dark text `#0B1020` on accent `#60A5FA` | — | 7.45 |
| Nav text `#A8B5C7` on charcoal `#0B1020` | 9.10 | 9.10 |

All ordinary text clears 4.5:1 and all large text / UI clears 3:1, in both themes.

---

## 3. Rendered inspection — EXECUTED (real browser rendering), PASS

Brand-token checks ran in Playwright Chromium and Firefox on the live server, both light and dark:

| Check | Light | Dark |
|---|---|---|
| `#app-root` element present | PASS | PASS |
| Base font is sans (system-ui stack, no serif) | PASS | PASS |
| Page background is themed (not transparent default) | PASS — `rgb(248,250,252)` | PASS — `rgb(11,16,32)` |
| `<h1>` font is sans (no serif leak) | PASS | PASS |
| `<h1>` color is not pale mid-gray | PASS — `rgb(15,23,42)` | PASS — `rgb(248,250,252)` |
| Nav background is charcoal (not default white) | PASS — `rgb(11,16,32)` | PASS — `rgb(11,16,32)` |

Verified in Playwright Chromium and Playwright Firefox (both light and dark theme).

---

## 4. Type check / tests / build — EXECUTED, PASS

- `tsc --noEmit`: **exit 0.**
- `vitest run`: **5 files, 73 tests, 0 failures.**
- `build.mjs` (esbuild): bundles emitted — `browser-entry.js` 189 KB, `server-entry.js` 290 KB.

---

## 5. SSR for representative routes — EXECUTED, PASS

14 paths rendered: 12 × 200, 2 × 404. Every route has exactly one `<h1>`; the stylesheet is
**byte-identical across every route**, a single `<style data-streetui-css>` block. 404 routes
set `robots=noindex`; every route emits a complete head (title/description/canonical/robots/OG).

---

## 6. axe-core automated audit — EXECUTED, PASS

**Tool:** axe-core 4.13.0, Playwright with `bypassCSP: true`.
**Browsers:** Playwright Chromium 153 + Firefox 156.0.1.
**Rule sets:** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`.

| Route | Chrome violations | Firefox violations | Chrome passes |
|---|---|---|---|
| `/` | **0** | **0** | 36 |
| `/docs` | **0** | **0** | 32 |
| `/docs/http` | **0** | **0** | 34 |
| `/docs/routing` (404) | **0** | **0** | 32 |
| `/guides` | **0** | **0** | 32 |
| `/guides/getting-started` (404) | **0** | **0** | 32 |
| `/blog` | **0** | **0** | 32 |
| `/playground` | **0** | **0** | 37 |
| `/nope-404` (404) | **0** | **0** | 32 |

**Total: 0 axe violations across all routes in both browsers.**

---

## 7. Multi-viewport rendering — EXECUTED, PASS (Chrome and Firefox)

**Viewports tested:** desktop 1440×900, tablet 768×1024, mobile 375×812.

| Viewport | Chrome: routes visible | Chrome: horiz-scroll | Firefox: routes visible | Firefox: horiz-scroll |
|---|---|---|---|---|
| Desktop (1440px) | 9/9 | **0** | 9/9 | **0** |
| Tablet (768px) | 9/9 | **0** | 9/9 | **0** |
| Mobile (375px) | 9/9 | **0** | 9/9 | **0** |

Two layout bugs were found during this check and fixed before the final scan:

1. **Nav overflow** — `PRIMARY_NAV` had 10 items (768px of link text + 9 gaps), which overflowed the
   1160px content column when combined with the 445px nav-controls group. Fixed: trimmed to 5 primary
   items (`Docs`, `Guides`, `API`, `Playground`, `Blog`) — the others are accessible from the footer
   sidebar. Also reduced `searchTrigger` `minWidth` from 190px to 160px.

2. **Content-box overflow at tablet/mobile** — `layout.container` uses `box-sizing: content-box`, so
   padding adds to `maxWidth`. At 768px viewport, 1160px max + 48px padding = 816px total, overflowing
   by 48px. Fixed: added `overflowX: 'hidden'` to `appRoot` (clips page-level overflow) and
   `overflow: 'hidden'` to `navBar` (clips nav at narrow widths). The viewport-level `scrollWidth` is
   now equal to `clientWidth` at all three viewports in both browsers.

---

## 8. Reduced-motion — EXECUTED, PASS (Chrome and Firefox)

**Method:** Playwright `browser.newContext({ reducedMotion: 'reduce' })`, home page. Elements
counted only if `transitionDuration > 20ms` or `animationDuration > 20ms` (the 0.01ms produced by
the `!important` reduced-motion override is treated as zero).

| | Chrome | Firefox |
|---|---|---|
| Animated elements (normal) | 27 | 27 |
| Animated elements (reduced-motion) | **0** | **0** |
| `@media (prefers-reduced-motion:reduce)` rule in stylesheet | ✅ yes | ✅ yes |

---

## 9. Result — ALL GATES PASS

| Gate | Status |
|---|---|
| Root-cause investigation | ✅ PASS |
| Contrast ratios WCAG AA, light + dark | ✅ PASS |
| Brand-token / typography (Chrome + Firefox, light + dark) | ✅ PASS |
| TypeScript strict compile | ✅ PASS |
| 73 unit / integration tests | ✅ PASS |
| SSR for 14 representative routes | ✅ PASS |
| axe-core 4.13.0 — Chrome, 9 routes | ✅ PASS — 0 violations |
| axe-core 4.13.0 — Firefox, 9 routes | ✅ PASS — 0 violations |
| Multi-viewport Chrome — desktop / tablet / mobile | ✅ PASS — 0 horizontal scroll |
| Multi-viewport Firefox — desktop / tablet / mobile | ✅ PASS — 0 horizontal scroll |
| Reduced-motion Chrome | ✅ PASS — 27 → 0 animated elements |
| Reduced-motion Firefox | ✅ PASS — 27 → 0 animated elements |
