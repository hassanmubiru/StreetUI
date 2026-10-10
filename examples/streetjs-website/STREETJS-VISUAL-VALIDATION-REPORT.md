# StreetJS Website — Visual Validation Report

**Date:** 2026-10-10
**Rule:** nothing is marked passing unless it was actually executed here. Tools this sandbox lacks are
marked **BLOCKED / NOT EXECUTED**, never simulated.

---

## 1. Root-cause investigation (as requested) — EXECUTED

The light-mode "pale text" and "serif typography" were investigated at the source, not patched blindly:

- Searched the codebase: `appRoot` (base font/colour/background) was defined but **applied nowhere**;
  the shell root was a bare `<div>`. → the serif leak and missing themed surface.
- Inspected the serialized stylesheet and token registration order: confirmed the custom
  `createThemeTokens` block registers **after** the framework defaults and therefore wins both `:root`
  and `[data-theme="dark"]` (last-wins), and that **every** colour is set in both themes so dark never
  falls back to a framework default.
- Confirmed `--content-primary` resolves to a dark value in light (`#0F172A`) and near-white in dark
  (`#F8FAFC`) in the shipped CSS, and that `--font-sans` now resolves to the system sans stack.

## 2. Computed contrast — EXECUTED, PASS (all ≥ WCAG AA)

Ratios computed from the shipped token values (WCAG 2.1 relative luminance):

| Pair | Light | Dark |
|---|---|---|
| Heading on page canvas | 17.06 | 18.10 |
| Body text on canvas | 9.90 | 12.75 |
| Secondary/muted text on canvas | 7.24 | 9.10 |
| Link / accent on canvas | 4.94 | 7.45 |
| Primary-button text on accent | 5.17 | (dark text on `#60A5FA`) 7.4 |
| Nav text on charcoal header | 9.10 | 9.10 |

All ordinary text clears 4.5:1 and all large text / UI clears 3:1, in both themes.

## 3. Rendered inspection — EXECUTED (real browser rendering), PASS

The finished pages were rendered as real pixels (Chromium via the app's artifact view) and inspected:

- **Homepage, light:** charcoal header with blue mark/wordmark and a blue **Get started** CTA; a bold,
  **dark** hero headline on the light canvas; readable dark-slate body; blue kicker; primary/secondary/
  ghost actions; `npm i streetjs` chip; a syntax-highlighted `src/main.ts` code window with a Copy
  button. No pale text, no serif.
- **Homepage, dark:** charcoal `#0B1020` surface (no gray glow), near-white headline, readable light-
  slate body, blue accents, same code window.
- **Documentation (`/docs/http`), light:** dark readable page heading and prose; grouped sticky sidebar
  with the active item marked by a blue rule/background; provenance notice; a code window; comfortable
  article width. Cohesive with the homepage, consistent sans throughout.

(Screenshots were taken this session for dark home, light home and light docs.)

## 4. Type check / tests / build — EXECUTED, PASS

- `tsc --noEmit`: **exit 0** (in project and in a clean-install copy from the `streetui-3.0.1.tgz`
  tarball).
- `vitest run`: **5 files, 73 tests, 0 failures** — covering routing, the active-nav marker, mobile menu,
  theme cycle + persistence, search (keyboard, results, empty, navigate), playground, backend states,
  SSR→hydrate (shell adopted by reference, no stylesheet duplication, every route), and a
  **no-console-error/-warning** pass across every route.
- `tsup`: **exit 0, 0 warnings** (project and clean-install).

## 5. SSR for representative routes — EXECUTED, PASS

Rendered 14 paths: **12 × 200, 2 × 404**; every route has exactly **one `<h1>`**; the stylesheet is
**byte-identical across every route (35,463 B)**, a single `<style data-streetui-css>` block. 404 routes
set `robots=noindex`; every route emits a complete head (title/description/canonical/robots/OG). The
production `server.mjs` serves 200/404 with its CSP + `nosniff` headers.

## 6. Responsive — EXECUTED (structural), real-device pass BLOCKED

Responsive rules are in place and verified in CSS: the nav collapses to a styled charcoal mobile menu
below `lg`; grids fall to one column (`base: '1fr'`); the hero is fluid; code windows scroll horizontally
(`overflow-x:auto`) rather than overflow the page; the docs sidebar/TOC are hidden/stacked at narrow
widths. Exact pixel checks at 1440×900 / 768×1024 / 375×812 in Chrome/Firefox were **not executed** here
(see below) and should be confirmed in the authoritative environment; no horizontal-overflow source was
found in review.

## 7. BLOCKED / NOT EXECUTED

- **axe-core** automated accessibility audit — not installed, network blocked.
- **Firefox**, and **Chrome at the three exact viewport sizes** — the sandbox browser surface cannot
  reach the VM's dev server, so full multi-viewport engine testing was not run. The rendered-pixel
  inspection in §3 used the app's artifact renderer (real Chromium) at the panel width.

These are listed honestly rather than claimed. Everything in §1–§5 was executed in this environment and
passed.

## 8. Known remaining items

- Run axe-core and a Chrome+Firefox multi-viewport pass in the authoritative environment.
- The in-page TOC anchor offset under the sticky header uses a padding/negative-margin pair because the
  style API exposes no `scroll-margin-top`.
- No unprompted motion is used (the style API has no `prefers-reduced-motion` channel); only hover/focus
  transitions, which need no suppression.
