# StreetJS Website — Validation Report

**Date:** 2026-10-10
**Rule:** nothing below is claimed unless it was actually executed in this environment. Checks that
require software this sandbox does not have are marked **BLOCKED / NOT EXECUTED**, never simulated.

---

## 1. Type checking — EXECUTED, PASS

`tsc --noEmit` (TypeScript strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`):

- In the project: **exit 0, no errors.**
- In a clean-install copy from the offline `streetui-3.0.1.tgz` tarball: **exit 0.**

## 2. Unit / integration tests — EXECUTED, PASS

`vitest run` (happy-dom): **5 files, 73 tests, 0 failures.**

Coverage relevant to the redesign (all green):

- Shell + routing: persistent shell, one nav link per item with real hrefs, client navigation, the
  active-nav marker on `/docs`, the 404 page for unknown paths and unknown doc slugs, and **every
  primary route mounting with exactly one `<h1>` in the outlet.**
- Mobile menu open/close and close-on-navigate.
- Theme cycle system→light→dark→system, persisted, writing `data-theme` on `<html>`, restored on mount.
- Global search: open via Ctrl/⌘+K and `/` (not while typing), the trigger button, typing through the
  input binding, results across kinds, empty state, Enter-navigates, Arrow focus movement, result-click
  navigation, Close/Escape, and listener teardown on unmount.
- Playground decoder presets and output; backend panel probing only the three real framework routes,
  rejecting invalid URLs without fetching, and rendering ok/error/unavailable states.
- SSR→hydrate: shell nodes adopted by reference, no stylesheet duplication, every primary route
  hydrates, and the theme-label reconciles when a stored choice differs from the server's "System".
- **Console hygiene:** a test navigates every route, searches and hydrates with `console.error`/
  `console.warn` spied — **zero calls.**

> Environment note: `vitest` needs `vite`, which is not present in this example's flat `node_modules`;
> it was made resolvable with a symlink to `benchmarks/node_modules/vite`. This is a test-runner
> environment fix only — it does not affect `tsc`, `tsup`, or the production server.

## 3. SSR for every route — EXECUTED, PASS

Rendered all 17 representative paths (every route pattern incl. dynamic docs/guides/blog and two 404s):

- **Status:** 200 for real paths, 404 for unknown top-level and unknown doc slug.
- **One `<h1>` inside `#page-outlet`** on every route.
- **Complete head** on every route: title, description, canonical, robots, Open Graph (+ Twitter).
  404 routes set `robots=noindex`.
- **Stylesheet byte-identical across every route: 34,336 B**, a single `<style data-streetui-css>`
  block — the design-system discipline (all identities registered at module load) held through the
  redesign.
- The homepage code window renders its chrome (`-bar`, dots, `-name`, `-copy`) and **110 highlighted
  token `<span>`s**; the docs sidebar active link and, on multi-section pages, the `#doc-toc` with its
  links are present.

## 4. Accessibility — contrast EXECUTED (PASS); automated audit BLOCKED

**Contrast ratios computed** (WCAG 2.1 relative luminance) for the shipped palette — all pass AA
(≥4.5 normal text, ≥3.0 large/UI):

| Pair | Ratio |
|---|---|
| Dark heading `#e8eef7` on bg `#0a0e15` | 16.6 |
| Dark body `#aab6c7` on bg | 9.4 |
| Dark muted `#7d8aa0` on bg | 5.5 |
| Dark link/accent `#4c8dff` on bg | 6.0 |
| Dark button text `#06142b` on accent `#4c8dff` | 5.7 |
| Light heading `#0b1a2b` on `#fff` | 17.6 |
| Light body `#44536a` on `#fff` | 7.8 |
| Light muted `#6a7788` on `#fff` | 4.6 |
| Light link `#1766d6` on `#fff` | 5.4 |
| Light button text `#fff` on accent `#1766d6` | 5.4 |

Keyboard/focus behaviour is covered structurally: a visible `:focus-visible` ring on every interactive
element, skip link, `role`/`aria-label` on nav landmarks and the TOC, the search dialog's focus trap and
Escape handling (exercised in tests).

**`axe-core` was NOT executed** — it is not installed and the network is blocked, so it cannot be added.
Automated a11y auditing must be run in the authoritative environment.

## 5. Production build from a clean install — EXECUTED, PASS

In a throwaway copy with a fresh `node_modules` populated from the offline `streetui-3.0.1.tgz`
(no workspace linking): `tsc` exit 0, `tsup` **exit 0 with 0 warnings**, bundles emitted
(`browser-entry.js` ≈ 192 KB with StreetUI inlined, `server-entry.js` ≈ 140 KB). The production SSR
server (`server.mjs`) then served `/`, `/docs`, `/docs/http`, `/playground` as 200 and `/nope` as 404,
with the security headers intact (CSP with a per-build inline-script hash, `X-Content-Type-Options:
nosniff`).

## 6. Real-browser visual + interaction inspection — PARTIAL / BLOCKED

- The **pre-redesign** state was captured as real rendered screenshots (home and docs), which grounded
  the findings in §1 of the Design Report.
- **Live pixel inspection of the finished redesign in Chrome/Firefox was NOT completed in this
  environment.** The in-app preview panel did not front the files for capture during this run, and the
  sandbox browser surface cannot reach the VM's localhost dev server. Rather than fabricate a result,
  the finished design was verified through: full SSR HTML of every route, the computed contrast table
  above, byte-identical-stylesheet and structure assertions, and the 73 happy-dom interaction tests
  (nav, mobile menu, theme, search, keyboard, playground, hydration, no console errors).
- Remaining to run in the authoritative environment: Chrome + Firefox visual pass at desktop/tablet/
  mobile, direct-URL and refresh behaviour under a real engine, `axe-core`, and a reduced-motion check
  (expected to be a no-op, since nothing animates unprompted).

## 7. Result

Type check, tests, SSR for every route, contrast, and a clean-install production build all pass in this
environment. StreetUI was not modified. The outstanding gates (real-browser visual, axe-core) are
listed as not executed here, to be completed where those tools exist.
