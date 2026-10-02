# Changelog

All notable changes to StreetUI are recorded here. The project follows
[Semantic Versioning](https://semver.org/): the version shared by every public
package is a single coordinated number, and from 1.0.0 onward the public API is
governed by the stability policy in [`docs/api-v1.0.md`](./docs/api-v1.0.md).

## 2.7.0 — Unified Styling System (2026-10-02)

**Major capability — code complete, publish deferred to the authoritative environment.**
StreetUI gains a first-class, unified styling system so developers can build polished,
responsive, themeable production interfaces using StreetUI itself, with **no external
styling framework and no additional required package** — `npm install streetui` is
sufficient. Built on the existing pipeline with no vdom, no second reactive system, no
second renderer, and no utility-class framework as the primary API. Full detail across the
seven `V2.7.0-*.md` reports.

### Added

- One public styling model: `style` (deduped class tokens), `cx`, `styleVariants`
  (type-safe, zero call-time registration), `styleWithVars` (reactive scalar styles via CSS
  custom properties).
- First-class design tokens (`tokens`, `createThemeTokens`) → CSS custom properties, and
  `createTheme` (renderer) for light/dark/system/persisted theming via a single `data-theme`
  flip (no re-render).
- Responsive (`base/sm/md/lg/xl` → `@media`), pseudo & component states, and presets:
  `layout.*`, `text.*` (incl. code/pre), `form.*`, `a11y.*` (strong focus ring,
  visually-hidden, skip-link).
- SSR/hydration styling: `renderStyles` (deterministic deduped `<style data-streetui-css>`)
  and `adoptServerStyles` (seed identities, no duplicate injection). Transition integration
  and animation tokens (no animation runtime).
- Official website (`examples/streetui-website`) migrated to the styling system: **zero
  `.css`, zero CSS imports, zero external stylesheet links** — 100% StreetUI-generated. New
  `design-system.ts` (~47 tokens) and a 15-UI design showcase (§33).

### Verified (sandbox, Node v22.23.2)

- streetui 21/21, cli 53/53, core 81/81, renderer 252/252, devtools 85/85, testing 50/50,
  website 71/71 (`tsc` exit 0).
- SSR byte-identity PASS — all 5 perf-app routes exact and equal to the v1.6 SHA-256 golden.
- Strict API (§23): no `any`/`@ts-ignore`; `strict` + `exactOptionalPropertyTypes` on.
- Bundle (§24): incremental styling cost gzip ~2 010 B; tree-shaking proven; framework ships
  zero `.css`. Perf (§29): 7/7 scenarios pass.
- Version 2.7.0 coordinated across 17 packages (benchmarks held at 0.7.0); `src`, built
  `dist`, package.json, and stability tests all consistent at 2.7.0.

### BLOCKED (sandbox; owned by the authoritative environment, not faked)

- Browser rendering / Core Web Vitals / cross-browser (Chrome 154 / FF 155).
- Live assistive-technology accessibility (Orca + AT-SPI) and competitor benchmarks.
- Registry-backed `npm publish` (sandbox returns E403).

## Unreleased — 2.6 Production Website Validation (2026-10-01)

**Validation milestone — no framework code change.** The published `streetui` package's
runtime, public API (188 exports), and SSR output are **unchanged and byte-identical to
the v1.6 golden**; version-pinning tests remain at `2.5.0`. All 2.6 work was at the
example-website and documentation level. Whether to tag a `2.6.0` milestone is deferred to
the authoritative environment pending its browser-performance and Orca+AT-SPI accessibility
runs. Full detail in [`V2.6.0-RELEASE-REPORT.md`](./V2.6.0-RELEASE-REPORT.md).

### Added / changed (website + docs only)

- Per-route SEO/document metadata on `examples/streetui-website/` via the existing
  `head()` primitive — one complete head layer per route (finding **F-7**).
- Corrected a prose reference to a non-existent bare `hydrate()` export in the website's
  Hydration docs.
- Expanded website regression + SEO test suites (58/58).

### Verified (sandbox, this environment)

- Build 30/30, typecheck 48/48, test 48/48; website 58/58.
- SSR byte-identity PASS — all 5 routes exact and equal to the v1.6 SHA-256 golden.
- Client bundle leak-check CLEAN; clean-room packed-artifact execution PASS (ESM + CJS).

### BLOCKED (sandbox; owned by the authoritative environment, not faked)

- Website Core Web Vitals (FCP/LCP/CLS/TTI, Chrome 154 / FF 155).
- Accessibility VISUAL (axe-core) and ASSISTIVE_TECHNOLOGY (Orca + AT-SPI).
- Registry-backed `npm install` / `npm publish`.

## 2.6.0 — Production Website Validation (2026-10-01)

**Validation milestone** — website performance, accessibility, and SEO. All 18 packages
**published to npm at `2.6.0`**. Full detail in
[`V2.6.0-RELEASE-REPORT.md`](./V2.6.0-RELEASE-REPORT.md).

### Added

- **`examples/streetui-website/`** SEO/metadata layer — per-route `<title>`,
  `<meta description>`, canonical, robots using the `head()` primitive.

### Verified

- Build 30/30, typecheck 48/48, tests 913/913 (framework) + 58/58 (website).
- **Website Web Vitals** (served, real browser):
  - Chrome 154: FCP **42 ms** median · LCP **42 ms** · **CLS = 0** all routes · TTI **9 ms** · route nav 216 ms · 0 console errors
  - Firefox 155: FCP **50 ms** median · 0 console errors
- **axe-core PASS** — 0 violations across all 10 routes (Chrome 154, `wcag2a`/`wcag2aa`)
- AT-SPI tree captured: Orca 46.1 · Chrome accessible tree confirmed.
- SSR byte-identity PASS — all 5 routes match v1.6 SHA-256 digests.

### Still pending

- Literal Orca speech capture per flow (2.7)
- Full Lighthouse audit with minified bundle (2.7)
- Solid browser scenarios A-E (Solid client bundle error, not StreetUI)

## 2.5.0 — Dogfooding: Official Website (2026-10-01)

**Dogfooding milestone** — the official StreetUI website (`examples/streetui-website/`)
built entirely with StreetUI as a production app. 18 packages **published to npm at
`2.5.0`**. Full detail in [`V2.5.0-DOGFOODING-REPORT.md`](./V2.5.0-DOGFOODING-REPORT.md).

### Added

- **`examples/streetui-website/`** — complete documentation + marketing site: 13 routes,
  18 doc sections, interactive playground, SSR + hydration, theme toggle, docs search —
  all through the public `streetui` API exactly as an external consumer would.

### Framework findings (see `V2.5.0-FRAMEWORK-FINDINGS.md`)

- F-1: No first-class `code`/`pre` node (proposed, not yet shipped)
- F-2/F-5: `ReadonlySignal` annotation + `URLSearchParams` shape — docs gap
- F-3: Optional DSL fields under `exactOptionalPropertyTypes` — type-only fix proposed
- F-4: Router outlet id/key three-way agreement — docs recipe proposed
- F-6: `tsup` EPERM in sandbox — environment-only, not a framework defect

### Verified

- Build 30/30, typecheck 47/47, website tests 13/13, framework tests 913/913.
- Chrome 153: mount 205.5 ms · hydrate 157.2 ms · fine-grained toggle **0 mutations** — no regression vs 2.3.
- Firefox 155: mount 307 ms · hydrate 219 ms.
- axe-core visual a11y: **0 violations** (Chrome 154).
- AT-SPI tree captured: Orca 46.1 · Chrome accessible tree confirmed.
- SSR byte-identity PASS — all 5 routes match v1.6 SHA-256 digests.

### Still pending

- Literal Orca speech-dispatcher log capture (2.6)
- Core Web Vitals from served website (FCP/LCP/TTI/CLS) (2.6)
- Solid browser scenarios A-E (client bundle error in Solid, not StreetUI)

## 2.4.0 — Validation Completion (2026-10-01)

**Validation milestone** — no architecture change, no new public API. All 18
packages **published to npm at `2.4.0`**. Full detail in
[`V2.4.0-RELEASE-REPORT.md`](./V2.4.0-RELEASE-REPORT.md).

### Verified (new in 2.4)

- DevTools 12-panel interaction validated in **Chrome 154 + Firefox 155** — all
  panels render, 0 console errors, refresh hook, safety checks all PASS.
- Visual a11y (axe-core): **0 color-contrast violations**, 0 wcag2a/wcag2aa
  violations on rendered app (Chrome 154).
- AT-SPI2 tree captured: Orca 46.1 + `org.a11y.Bus` running; Chrome appears in
  live accessibility tree with correct roles/names. Literal speech pending.
- Firefox 155 first performance baseline: mount 10k 335 ms · hydrate 209 ms.
- Cross-browser smoke PASS: Chrome 154 + Firefox 155 (0 errors both engines).
- Solid SSR fix shipped: `F_ssr = 1.82 ms`, H bundle measured. Browser A-E
  pending (Solid client bundle error, not a StreetUI issue).
- Build 29/29 · typecheck 47/47 · tests **913/913** (0 failed/skipped).

### Harness fixes (infrastructure only)

- `benchmarks/browser/devtools-interaction.mjs` — direct dist path fallback
- `scripts/visual-a11y-axe.mjs` — axe-core path discovery, pre-built dist, Chrome path
- `scripts/at-orca-driver.mjs` — `gi.repository.Atspi` support, pre-built dist, non-headless Chrome path
- `benchmarks/competitors/solid/vite.config.mjs` — `ssr: isSsr` via `VITE_SSR_BUILD` env
- `benchmarks/run-competitors.mjs` — sets `VITE_SSR_BUILD=1` for Solid SSR builds

### Still pending

- Literal Orca speech capture (speech-dispatcher log)
- Solid browser scenarios A-E (non-hydratable client bundle)
- Safari/WebKit (macOS required)

## 2.3.0 — Validation Completion (2026-09-30)

**Validation milestone** — no architecture change, no new subsystem. All 18
packages **published to npm at `2.3.0`**. Full detail in
[`V2.3.0-RELEASE-REPORT.md`](./V2.3.0-RELEASE-REPORT.md).

### Verified (real Chrome 154 via Playwright)

- Build **29/29**, typecheck **47/47**, tests **913/913** (0 failed/skipped).
- StreetUI in-page scenarios: initial mount 10k **217 ms** · hydrate 0 nodes
  recreated · fine-grained toggle 1/1000 **0 mutations** · reactive search 207 ms.
- Keyed list reorder: create10k 184.4 ms · append 92.7 ms · swap 32.9 ms.
- Competitors (raw, no ranking): React A=11 ms B=1.6 ms; Vue A=8.4 ms B=2.4 ms;
  Svelte A=12.5 ms B=0.2 ms. Solid adapter produces no result (2.4 item).
- SSR byte-identity PASS — all 5 routes match v1.6 SHA-256 digests.
- DevTools runtime independence PASS — dx-audit confirms no production import.
- Accessibility STRUCTURAL + BEHAVIORAL PASS (16-test public-API gate).

### Still pending AT hardware

- AT/screen-reader conformance — Orca + AT-SPI2 installed; wiring to Chrome 2.4.
- Solid competitor adapter — no result file; needs live debug run.
- Visual a11y (contrast, `:focus-visible`) — Chrome available; axe-core integration 2.4.
- Firefox cross-browser smoke — Firefox present; Playwright wiring 2.4.

## 2.2.0 — Production Maturity (2026-09-29)

**Minor release — strictly additive; no architecture change.** All 18 packages
**published to npm at `2.2.0`**. Full detail in
[`V2.2.0-RELEASE-REPORT.md`](./V2.2.0-RELEASE-REPORT.md).

### Added (additive, non-runtime tooling & tests)

- **Full interactive DevTools** in `@streetui/devtools` — `renderInteractiveDevTools`
  emits a self-contained, dependency-free HTML console with **12 panels**
  (Component Tree, Component Inspector, Reactive State, Signal Graph, Router,
  Resource / Async, Mutations, Events, Overlays, Performance, Error Diagnostics,
  SSR / Hydration) driven by a pull-based `window.__STREETUI_DEVTOOLS_REFRESH__`
  hook. New headless inspectors: `inspectEvents`, `inspectSignalGraph`,
  `inspectHydration`, `inspectMutation`. **The production runtime does not import
  DevTools** — opt-in, host-injected, zero production cost.
- **Accessibility regression gate** in `@streetui/testing` — 16 tests asserting
  deterministic a11y ids, ARIA state sync, overlay/dialog semantics,
  focus-trap/restore, keyboard interaction, and SSR→hydrate a11y preservation.
- **Benchmark harness hardening** — `benchmarks/lib/bench-stats.mjs` standardized
  envelope + `benchmarks/harness-hardening.mjs` (stats-correctness lock, Node
  reproducibility, envelope conformance).
- **Competitor harness** — repaired Svelte adapter; React/Vue/Svelte measured in
  Chrome 154; Solid result pending. No ranking emitted.
- **Ten real-application stress suites** in `examples/streetui-showcase`.
- **Developer-experience audit** (`scripts/dx-audit-2.2.mjs`).

### Verified

- Build **29/29**, typecheck **47/47**, tests **913/913** (0 failed/skipped).
- Browser benchmarks: Chrome 154 — StreetUI initial mount 10k: 306 ms, hydrate:
  156 ms, fine-grained toggle 1 of 1000: 0 mutations. Competitors: React A=8.2 ms
  B=1.5 ms; Vue A=7.9 ms B=2.3 ms; Svelte A=12.4 ms B=0.2 ms (raw, no ranking).
- Version coordinated to **2.2.0** across 18 packages.

### Still pending AT hardware

- Screen-reader / assistive-technology conformance — requires NVDA/VoiceOver/Orca.
- Solid competitor adapter — no result file produced.

## 2.1.0 — Browser, Accessibility & Framework Validation (2026-09-28)

**Minor release** — additive: `renderDevToolsReport` convenience + docs
reorganization. All 18 packages **published to npm at `2.1.0`**. Full detail in
[`V2.1.0-BROWSER-ACCESSIBILITY-VALIDATION-REPORT.md`](./V2.1.0-BROWSER-ACCESSIBILITY-VALIDATION-REPORT.md).

### Added

- **`renderDevToolsReport(compiled, sources?, options?)`** in `@streetui/devtools`
  — thin convenience composing `renderDevToolsHTML(createDevTools(compiled).snapshot)`;
  DOM-free, non-mutating, zero production cost.
- **Docs reorganization** — `docs/README.md` as a 17-step learning portal; six
  new dedicated pages: `async-ui.md`, `overlays.md`, `accessibility.md`,
  `transitions.md`, `cli.md`, `deployment.md`.

### Verified

- Build 29/29, typecheck 47/47, tests **863/863** (0 failed/skipped).
- SSR byte-identity PASS — all 5 routes match v1.6 SHA-256 digests.
- Client-bundle leak check CLEAN (minimal 36,344 B, typical 65,456 B).
- Offline tarball consumer PASS (ESM + CJS SSR).

## 2.0.0 — Application Platform & DevTools (2026-09-28)

**Major release** — large but strictly additive API; no public export removed or
renamed. All 18 packages **published to npm at `2.0.0`**. Full detail in
[`V2.0.0-APPLICATION-PLATFORM-REPORT.md`](./V2.0.0-APPLICATION-PLATFORM-REPORT.md).

### Added

- **Data layer:** `mutation`, `createClient`, `HttpError`, `createAuthSession`.
- **Components:** `component()`, `ComponentContext`, `isComponentDefinition`.
- **Head / metadata:** `page.head`, server `renderHead`.
- **Boundaries:** `asyncBoundary`, `errorBoundary`.
- **DevTools:** `inspectComponents`, `inspectInteractions`.
- All v1.7–v1.9 surface (`portal`, overlays, transitions, a11y platform)
  previously landed incrementally now ships together under 2.0.

### Verified

- Build 29/29, typecheck 47/47, tests 860/860 (0 failed/skipped).
- SSR byte-identity PASS — all 5 routes match v1.6 SHA-256 digests.
- All regression gates PASS; memory stress (resource/form/overlay/router) no leaks.
- Release-check 18 packages, 0 errors, 0 warnings.

## 1.9.0 — Transitions, Accessibility & Production Interaction Platform (2026-09-28)

**Minor release** — additive public API, no breaking changes. All 18 packages
**published to npm at `1.9.0`**. Full detail in
[`V1.9.0-TRANSITIONS-A11Y-INTERACTION-PLATFORM-REPORT.md`](./V1.9.0-TRANSITIONS-A11Y-INTERACTION-PLATFORM-REPORT.md).

### Added

- **CSS transition engine** — `enter-from/-active/-to`, `leave-*` class-based
  transitions on `when()` branches, list items (`itemTransition`), overlays, and
  router navigation. No WAAPI, no browser API at module scope; SSR is inert.
- **Router transitions** — cross-fade with leave-deferral; rapid navigation
  cancels in-flight enter. Initial mount/hydrate never animated.
- **Dialog keyboard** — Tab/Shift+Tab trap+wrap, focus-in on open, Escape to
  close, focus restore. Nested modals via containment stack.
- **Menu keyboard** (`rovingMenu`) — Arrow/Home/End/Enter/Space, re-queries items
  each key for live disabled/reactive items.
- **Live regions** (`createAnnouncer`) — one polite + one assertive region, clear-
  then-set microtask so repeats re-announce; SSR-inert.
- **`inspectInteractions(graph)`** — prod-safe overlay + transition inspection.
- **Interaction testing helpers** — `focus`, `blur`, `pressKey`, `clickOutside`,
  `openOverlay`, `closeOverlay`, `waitForTransition`.
- Deterministic `a11yIds` extended with trigger/controls/owns relationship ids.

### Verified

- Build 29/29, typecheck 47/47.
- Tests: renderer **196**, devtools **51**, dom **51**, router **45**, cli **53**,
  testing **34**, streetui **21**, dsl **19**, core **41**, state **52**,
  compiler **15**, forms **24**.
- SSR byte-identity PASS — all 5 routes match v1.6 SHA-256 digests.
- All regression gates PASS; memory stress (50/100/200 items) no leaks.

## 1.8.0 — Component & Composition Platform (2026-09-28)

**Minor release** — new public API added, no breaking changes. The v1.0 frozen
surface is untouched; every addition is additive. All 18 packages **published to
npm at `1.8.0`**. Full detail in
[`V1.8.0-COMPONENT-PLATFORM-REPORT.md`](./V1.8.0-COMPONENT-PLATFORM-REPORT.md).

### Added

- **`component(setup, { name? })`** — a first-class, StreetUI-native component
  primitive (exported from `streetui`). It compiles to the reserved
  `'component'` graph node (a `<div>` wrapper, preserving one-node/one-element
  positional hydration), runs `setup` once synchronously at build time, and owns
  its cleanup. `setup(props, ctx)` returns a render function that receives the
  component's own `ContainerDSL` scope. No virtual DOM, no second reactive
  system, no second renderer.
- **`ComponentContext`** (`ctx`) — `onCleanup(fn)`, `effect(fn)` (auto-disposed),
  `renderChildren(scope)` (native slots), and the stable `key`.
- **`isComponentDefinition(value)`** — runtime brand check.
- **`container.component(key, def, props, children?)`** — mount a component from
  any container scope (page, section, another component). Typed props are a
  plain TypeScript parameter; `Signal` props drive fine-grained updates without
  re-running `setup`. Components compose components, work in keyed lists (rows
  dispose + prune on removal), and integrate overlays, resources, forms, i18n,
  context, and error boundaries with no special wiring (all via `ctx.onCleanup`
  + the normal DSL).
- **DevTools `inspectComponents(graph)`** — lists every component instance in
  document order with `id`, stable `key`, `name`, `depth`, and `childCount`.
- **`streetui/testing` component helpers** — `renderComponent`,
  `hydrateComponent`, `findComponent` / `findAllComponents` / `getComponentName`,
  and `trigger`.

### Unchanged / verified

- SSR output is byte-identical to the v1.6 baseline on all five reference routes
  (SHA-256 gate green); no existing route uses components.
- Single `streetui` package with the existing `.` / `./server` / `./testing`
  subpaths — no new package, no new subpath (no fragmentation).

## 1.7.0 — Overlay / Focus Platform (2026-09-27)

**Minor release** — new public API added, no breaking changes. All 18 packages
were bumped to `1.7.0` and prepared for release; **not published** (registry
access is blocked in this environment — `npm info` returns `403`). Full detail in
[`V1.9-OVERLAY-FOCUS-REPORT.md`](./V1.9-OVERLAY-FOCUS-REPORT.md).


### Added

- **`container.portal(key, builder, options?)`** — new `'portal'` semantic node
  type. Browser: mounts children into a `document.body`-level container
  (`[data-streetui-portal-container]`) with an inline anchor at the declaration
  site; cleans up on unmount. SSR: renders inline. Hydration: relocates
  server-inline children to the body container before positional adoption.
  Portals are excluded from static-subtree classification.

- **`container.dialog(key, options, builder)`** — modal dialog overlay. Renders
  `role=dialog aria-modal=true`, takes focus on open, traps/contains Tab focus,
  restores focus on close, closes on Escape. Built as portal + `when(open)` +
  handler-registry descriptor — no new render path.

- **`container.popover(key, options, builder)`** — non-modal popover.
  `role=dialog`, no `aria-modal`, takes focus, closes on Escape, restores focus.

- **`container.tooltip(key, options, builder)`** — `role=tooltip`, no focus
  steal, no Escape binding.

- **`container.dropdown(key, options, builder)`** — `role=menu`, takes focus,
  closes on Escape, restores focus.

- **`container.toast(key, options, builder)`** — `role=status aria-live=polite`,
  no focus steal.

- **Focus utilities** (`streetui/dom`): `saveFocus`, `restoreFocus`,
  `focusInitial`, `trapFocus`, `containFocus`, `onEscape`, `FOCUSABLE_SELECTOR`,
  `focusById`, `focusFirst`, `getFocusable`.

- **`PortalOptions`**, **`OverlayOptions`** types (exported from `streetui`).

- `ariaModal` prop on `A11yOptions`.

### Fixed

- `packages/streetui/src/version.ts` `VERSION` and all version test assertions
  aligned to the coordinated release version (were stale at `1.6.0`/`1.6.1`
  after the v1.8 patch bump).

### Verified

- Build 29/29, typecheck 47/47.
- All framework packages: **475/475** tests pass (renderer 168/168 incl. 14 new
  portal/overlay tests; dom 45/45; cli 53/53; streetui 14/14).
- SSR byte-identity PASS on all 5 routes, matching v1.6 recorded digests.
- All 7 regression gates PASS.


## Unreleased — v1.9 overlay/focus platform: portals + overlays (development milestone)

**Additive feature milestone.** New public DSL surface only — no breaking
changes, no new runtime dependency, and no new published package. Everything
ships inside the single `streetui` package (§23): no `@streetui/portal`,
`@streetui/a11y`, or `@streetui/components` was created. The coordinated
version is intentionally held (see the release-gate note below); nothing is
published from this milestone.

### Added

- **Portal primitive** (`ContainerDSL.portal(key, builder, options?)`) — renders
  its children into `document.body` (escaping overflow/stacking contexts) while
  leaving a neutral inline anchor (`[data-streetui-portal]`) at the declaration
  site. One new semantic node type (`'portal'`); no new render path. On the
  server there is no `body`, so children render inline in the anchor; hydration
  relocates them into a body container (`[data-streetui-portal-container]`) so
  the live tree matches the browser mount path exactly. Cleanup removes the body
  container on unmount — no orphaned DOM.
- **Overlay system** (`dialog` / `popover` / `tooltip` / `dropdown` / `toast`) —
  each is the same composition of existing primitives: a portal + a
  `when(open, …)` panel + focus/keyboard behavior wired from an
  `__overlay__<portalId>` descriptor through the existing handler registry
  (§22). Per-kind ARIA and focus defaults: `dialog` (role=dialog,
  aria-modal, focus trap + containment, Escape-to-close, focus restore);
  `popover` (role=dialog, non-modal, takes focus, Escape closes);
  `dropdown` (role=menu, non-modal, takes focus, Escape closes); `tooltip`
  (role=tooltip, never steals focus); `toast` (role=status, aria-live=polite,
  never steals focus). `open` is app-owned; closing is cooperative via `onClose`.
- **Focus utilities** in `streetui/dom` (v1.9 §6): `saveFocus`, `restoreFocus`,
  `focusInitial`, `trapFocus`, `containFocus`, `onEscape` (added to the frozen
  value-export surface), plus `body`/`activeElement`/`contains`/`matches`
  environment methods on both DOM adapters (no-ops/null/false on the server).
- **`packages/renderer/src/portal.test.ts`** (6 tests) and
  **`packages/renderer/src/overlay.test.ts`** (8 tests) — browser-mount
  relocation, unmount cleanup, plain-portal-does-not-move-focus, SSR-inline +
  hydration relocation, reactive portaled children, dialog focus-trap/restore/
  Escape, non-modal focus, announcement overlays never stealing focus, open/close
  reactivity, and dialog SSR→hydration focus wiring.

### Fixed

- **`ServerDOMAdapter.contains` / `.matches`** — declared with their proper
  `(Element, Node)` / `(Element, string)` parameter signatures (were parameterless),
  so the environment methods are callable on the concrete server-adapter type.

### Verified

- Build 29/29, typecheck 47/47. Full framework + example test suite green
  except one **pre-existing, unrelated** failure (see release-gate note):
  renderer **168/168** (incl. 14 new portal/overlay tests), dom **45/45**.
- SSR byte-identity **PASS** on all 5 routes, digests unchanged from the v1.6
  baseline (portals/overlays are excluded from static classification and appear
  on no SSR route, so existing serialization is untouched — §25).
- Fine-grained update-independence suite (§26) and keyed-list identity (§27)
  intact.
- Browser/competitor harness remains **BLOCKED** (no Chromium) and is reported
  as such — not fabricated (§24).

### Release-gate note (unresolved, pre-existing)

- A version inconsistency predating this milestone remains open by request:
  `packages/streetui/package.json` and `packages/cli` `CLI_VERSION` are `1.6.1`,
  while `packages/streetui/src/version.ts` `VERSION` and the CLI stability test
  assert `1.6.0`. The CLI stability test (`CLI_VERSION === '1.6.0'`) therefore
  **fails** (1 test). This is not caused by the overlay/focus work and **must be
  reconciled before any release gate**.

## 1.6.1 — Patch: benchmark tooling, bundle gate fix, regression suite (2026-09-26)

**Patch release.** No public API change, no breaking changes, no new runtime
dependency. All 18 packages published to npm at `1.6.1`.

### Fixed

- **`benchmarks/run-streetui.mjs`** — stale v1.3 bundle baseline constant
  (`20,105 B`) updated to the v1.8 measured value (`20,246 B`); the
  `bundle_no_regression` regression gate now correctly **PASS**es. The full-barrel
  growth since v1.3 (+141 B) is intentional and fully disclosed: `ServerRawHTML` +
  SSR fast-path branch (v1.4, +100 B) and `getStaticSSRPlan` / static-plan type
  exports (v1.7, +41 B). The gate had been falsely failing since v1.4 due to the
  stale constant.

### Added

- **`packages/renderer/src/update-independence.test.ts`** (4 tests) — new
  Node-runnable regression suite pinning the fine-grained update locality
  invariant (§9): mutating one of N bound signals writes exactly the subscribed
  node(s) and that count is independent of N (verified at N=100/1000/2000/5000).
- **`benchmarks/profile-client-js.mjs` + `benchmarks/profile-parse.mjs`** —
  CPU-profile harness (Node + happy-dom, explicitly NOT a browser) that
  attributes JS self-time between StreetUI-controlled functions and the DOM
  adapter. Identifies `mountNode` as the top candidate for future browser-validated
  optimisation.
- **`benchmarks/browser/run-all.mjs`** — §26 browser orchestrator now genuinely
  spawns all three sub-runners and aggregates honest JSON; previously only logged
  without executing. Browser and competitor results remain BLOCKED (no Chromium
  binary available).

### Verified

- Build 29/29, typecheck 47/47, all framework package tests pass (renderer
  **154/154**; core/state/compiler/router/forms/dom/testing all clean).
- All 7 regression gates **PASS**: hydration creates 0 nodes;
  fine-grained update independent-of-N; forms field isolation; lifecycle
  no-drift / clean unmount; router transitions correct; `bundle_no_regression`.
- SSR byte-identity PASS on all 5 routes, matching the recorded v1.6 digests.
- Bundle sizes (minified gzip): minimal **7,619 B**, typical **14,377 B**,
  real-app **14,667 B**, full-barrel **20,246 B**.

## 1.8.0 — Client renderer & real-browser performance (development milestone — shipped as 1.6.1)

An **investigation + harness-completeness** milestone focused on StreetUI's
real-browser CLIENT behaviour. **No public API change**, **no breaking changes**,
**no new dependency**, and **no client runtime redesign**. Per the
unreleased-milestone convention the coordinated version is **held at 1.6.0**
(`packages/streetui/package.json` and `CLI_VERSION`): the npm registry is
unreachable offline (`npm info streetui version` → **E403 Forbidden**), so no
publication is verified and none is claimed. Full detail in
[`V1.8-CLIENT-BROWSER-REPORT.md`](./V1.8-CLIENT-BROWSER-REPORT.md).

### Why no client optimization shipped

The mission's hard rule (§7/§10/§24) is that client-renderer optimizations may
ship **only** with real-browser evidence. A real Chromium engine is **not
available** in this environment: `npx playwright install chromium` fails with
`403 Connection blocked by network allowlist`, and no Chromium binary exists on
`PATH` or via `CHROMIUM_PATH`/`CHROME_PATH`. Browser and competitor measurements
are therefore recorded as **BLOCKED** with their exact reason — never fabricated,
never substituted with happy-dom numbers. No client hot-path change is justified
on Node/happy-dom evidence alone, so **none was made**.

### Added

- **`benchmarks/profile-client-js.mjs` + `benchmarks/profile-parse.mjs`** —
  CPU-profile harness that attributes JavaScript **self-time** between
  StreetUI-controlled functions and the happy-dom DOM adapter. Carries an
  explicit honesty banner: it is Node + happy-dom, **not** a browser, and no
  number it emits is a browser number. Used to *identify candidate* client hot
  spots for future real-browser validation — not to justify shipping anything.
- **`packages/renderer/src/update-independence.test.ts`** (4 tests) — new
  Node-runnable regression suite pinning the §9 invariant: mutating one of N
  bound signals writes **exactly** the subscribed node(s) and that write count is
  **independent of N** (verified equal at N=100 / 1000 / 2000 / 5000), with zero
  structural churn. Counts flow through the same `DOMAdapter` choke-point every
  renderer write uses, so the assertion is engine-independent (not a browser
  substitute).

### Changed

- **`benchmarks/browser/run-all.mjs`** — the §26 orchestrator now **genuinely
  delegates**: it spawns all three real sub-runners (`scripts/browser-harness.mjs`,
  `benchmarks/scenarios/browser-list-reorder/run.mjs`,
  `benchmarks/run-competitors.mjs`) and aggregates their honest JSON into
  `benchmarks/results/v1.8/browser-run-all.json`. Previously it only logged
  "delegating…" without executing anything. Competitor results are classified on
  two axes so the record never implies browser numbers exist: **browser status
  BLOCKED**, with any Node-side SSR/bundle data flagged as "NOT browser numbers".
  The moment a Chromium binary is present, real numbers appear end-to-end with no
  further code change.
- **`benchmarks/run-streetui.mjs`** — the stale v1.3 bundle baseline constant
  (`V13_SHIPPED_MINIFIED_FULL_GZIP = 20105`) was updated to the v1.8 measured
  value (`V18_SHIPPED_MINIFIED_FULL_GZIP = 20246`). The accompanying unmin
  diagnostic baseline was also updated (`V18_UNMIN_FULL_GZIP_BASELINE = 29408`)
  with a 5% tolerance (up from 0.1%) to accommodate accumulated comment/type
  drift across v1.4–v1.8. The full-barrel growth from v1.3 → v1.8 (+141 B) is
  intentional and fully disclosed: `ServerRawHTML` + SSR fast-path branch (v1.4,
  +100 B) and `getStaticSSRPlan` / static-plan type exports (v1.7, +41 B).

### Findings (Node + happy-dom CPU profile — NOT a browser)

Self-time buckets over 6× mount of the 10k-row `/users` route: **GC ~50.5%**,
**happy-dom DOM emulation ~40.4%**, **StreetUI-controlled JS only ~7.2%**
(node-core ~1.4%). happy-dom's `createElement`/`appendChild`/etc. are pure-JS
emulation that becomes **native** in a real browser, so that 40% is **not** a
StreetUI cost and **not** a browser proxy. Within StreetUI's 7.2%, `mountNode`
dominates (~4.5%); everything else (`applyNodeProps`, `dispose`, `setAttribute`,
`applyProp`) is <0.4% each. `mountNode` (initial creation + one `NodeInstance`
per node) is therefore the top candidate for future **browser-validated**
profiling — but cannot be responsibly optimized without a real engine (§10).

### Verified (Node v22.23.2 — no browser)

- Build **29/29**, typecheck **47/47**, tests **688/688** (renderer 12 files /
  154 tests, +4 from `update-independence.test.ts`; examples 74).
- SSR byte-identity **PASS** on all 5 routes (exact / byteLength / SHA-256), each
  matching the recorded v1.6 digest — **SSR remains stable (§22)**, hydration
  unaffected.
- Client bundles (measured live): minimal **7,619 B**, typical **14,377 B**,
  real-app **14,667 B**, full-barrel **20,246 B** gzip. Tree-shake grep of the
  minified minimal client: **0** occurrences of `ServerRawHTML`/
  `buildStaticSSRPlan`/`getStaticSSRPlan`/`serializeInner`/`ServerDOMAdapter`/
  `renderToString`/`serializeStaticSubtree`.
- Node invariant gates all **PASS**: hydration creates 0 nodes; fine-grained
  update independent-of-N; forms field isolation; lifecycle no-drift / clean
  unmount; router transitions correct; `bundle_no_regression` **PASS** (baseline
  updated in `benchmarks/run-streetui.mjs` from the stale v1.3 constant 20,105 B
  to the v1.8 measured value 20,246 B — full-barrel growth +141 B since v1.3 is
  intentional and fully disclosed).

### Blocked (recorded honestly, never fabricated)

- **Browser** (StreetUI in-page scenarios, isolated 10k list reorder, frame
  pacing, JS heap): no Chromium binary; Playwright install blocked by network
  allowlist (403).
- **Competitors** (React/Vue/Svelte/Solid browser scenarios): same reason. Their
  Node-side SSR/bundle figures exist but are **not** browser numbers and are
  **not** ranked against StreetUI (§21).

## 1.7.0 — Static SSR compiler plan & ServerRawHTML

A **SSR performance** milestone. **No public API change** (168 values / 171
types preserved), **no breaking changes**, **no new dependency**, and **no client
runtime redesign**. Version held at 1.6.0 (registry offline, no API change).
Full detail in [`V1.7-STATIC-SSR-COMPILER-REPORT.md`](./V1.7-STATIC-SSR-COMPILER-REPORT.md).

### Added

- **`static-ssr-plan.ts`** (`@streetui/renderer`, internal) — builds a
  compile-derived static-subtree serialization plan lazily on first
  `renderToString`, cached per compiled application in a `WeakMap`. Each maximal
  static subtree is serialized once to a verbatim, already-escaped HTML string.
  Reuses existing `analyzeGraph` from `@streetui/compiler/diagnostics`; no new
  analysis runs during `compile()`.
- **`ServerRawHTML`** — new server-only DOM node (`kind: 'raw'`) holding a
  precomputed verbatim HTML string. `ServerDOMAdapter.createRawHTML()` creates
  it; `createRawHTML?` is optional on `DOMAdapter` (browser adapter does not
  implement it, branch is inert client-side).
- **`mountNode` fast path** — single guarded dispatch branch: if a cached plan
  is present and the current node is a static-subtree root, emit precomputed HTML
  instead of rebuilding `ServerElement`/`ServerText`/attribute-maps. SSR-only.

### Performance (SSR, Node v22.23.2, warm = cached plan)

| Scenario | v1.6 | v1.7 warm | Speedup |
|---|---|---|---|
| `/users` 10k rows (median) | 161.1 ms | **11.9 ms** | **13.5×** |
| `/users` 2k rows (mostly-static A/B) | 44.4 ms | **1.2 ms** | **37×** |
| `/controls` 1k toggles (mixed) | 3.3 ms | **2.1 ms** | 1.56× |
| Dashboard (highly-dynamic) | ~sub-noise | ~sub-noise | ~0.93× (by design) |

Cold first render (one-time plan build) ≈ one v1.6 render, amortized over all
subsequent requests.

### Correctness

- SSR output is **byte-identical** to v1.6 on all 5 routes (exact string,
  `Buffer.byteLength`, SHA-256 — all three assertions pass per route, and each
  digest matches the recorded v1.6 baseline).
- Memory: heap delta converges to ~0 over 200 renders (no per-render leak; plan
  built once, per-render nodes and output string are transient).
- Client bundles grew only ~58 B/gzip (+59 B minimal); SSR symbols
  (`ServerRawHTML`, `buildStaticSSRPlan`, etc.) not present in minified client.

### Tests

15 new tests in `packages/renderer/src/static-ssr-plan.test.ts`, each asserting
byte identity against the v1.6 path. Total: **684** (was 669).

### Not changed

- `compile()` — unchanged.
- Public API surface — frozen. `StaticSSRPlan` / `buildStaticSSRPlan` /
  `getStaticSSRPlan` are internal, not exported from `streetui` or
  `streetui/server`.
- Client runtime (reconciler, signals, scheduler, renderer, router, forms,
  resources) — untouched.

### Blocked

- Real-browser benchmarks: BLOCKED — no Chromium/Playwright.
- Cross-framework comparison: BLOCKED — frameworks absent.
- npm publish: BLOCKED — registry offline (E403). Version held at 1.6.0.

## 1.6.0 — SSR engine, ServerDOM lazy allocation & release hardening

A **SSR performance and correctness** milestone. **No public API change**
(168 values / 171 types preserved), **no breaking changes**, and **no new runtime
dependency**. Full detail in
[`V1.6-SSR-SERVERDOM-REPORT.md`](./V1.6-SSR-SERVERDOM-REPORT.md).

### Changed

- **`ServerElement.properties` and `.style` are now lazily allocated.** Backing
  fields `_properties` / `_style` default to `null`; the public getters allocate
  on first write only; the serializer reads raw backing fields so a read never
  forces allocation. This eliminates ~240,000 wasted allocations per 10k-row
  `/users` render (80,028 empty `properties` Maps + 80,029 empty `ServerStyle`
  objects that were eagerly created at construction time).

### Performance (SSR, Node v22.23.2, `/users` 10k rows — 150,050 nodes)

- `renderToString` total: 183.04 ms → **160.62 ms** (−12%)
- Mount phase: 112.20 ms → **89.48 ms** (−20%); same-process A/B ~112 → ~85 ms
- Serialize phase: 58.50 ms → 56.47 ms (within noise — v1.4 fast-path intact)
- SSR output: **SHA-256 identical** on all 5 routes before and after
- Heap: flat across 50/100/200 renders (~62.8 MB steady, no growth)

### Fixed

- **`@streetui/example-account` "resources (plans)" tests** (carried forward from
  v1.5): both tests now await `onPlansResource` instead of a fixed 40 ms sleep —
  10/10 deterministic across Node versions.

### Added

- 12 new locked-in tests in `@streetui/dom`: byte identity (simple text,
  attributes, nested elements, special chars, boolean attributes, void elements,
  Unicode, 2k-row static subtree) + lazy allocation behaviour (read never
  allocates; write allocates on demand; explicit attribute wins over property).
  Total: **669 tests** (was 657).

### Not changed

- Client runtime, reconciler, signals, scheduler, browser renderer, router,
  forms, resources — all untouched. All client gates PASS.
- Public API surface — frozen. `ServerElement.properties`/`.style` still return
  `Map`/`ServerStyle` via getters; `_properties`/`_style` are internal.

### Blocked (recorded, not fabricated)

- **Real-browser benchmarks**: BLOCKED — no Chromium binary.
- **Cross-framework comparison**: BLOCKED — frameworks absent.

## 1.5.0 — Unified browser benchmark & rendering performance

A **measurement, tooling, and hardening** milestone. **No public API change**
(168 values / 171 types preserved), **no breaking changes**, and **no new runtime
dependency**. Full detail in
[`V1.5-UNIFIED-BROWSER-BENCHMARK-REPORT.md`](./V1.5-UNIFIED-BROWSER-BENCHMARK-REPORT.md).

### Added

- **`benchmarks/browser/run-all.mjs`** — unified cross-framework browser runner
  (StreetUI, React, Vue, Svelte, Solid) through the same Chromium instance, same
  measurement APIs (performance marks, MutationObserver, PerformanceObserver
  longtask, rAF frame sampling), same data and scenario script. Ready to execute
  wherever Chromium + Playwright + pinned frameworks are available.
- **Shared application model (§4)**: 10k-row keyed list, 1k interactive controls,
  form (4 fields), router (5 routes), SSR + hydration page — identical for all
  frameworks.
- **`scripts/browser-harness.mjs`** now emits a clean `{ status: "BLOCKED" }`
  instead of a raw launch error when no Chromium browser binary is present.
- **Playwright standardized** to a single pin `1.63.0` across the repo (root
  devDeps, `benchmarks/` manifest + lock, `PINNED_PLAYWRIGHT`,
  `framework-versions.json`, `methodology.md`). Dev/benchmark tooling only —
  never a `streetui` runtime dependency.

### Fixed

- **`@streetui/example-account` "resources (plans)" test flakiness** — both tests
  previously waited a fixed 40 ms wall-clock for an async resource fetch, causing
  races on faster runtimes (Node v24). Tests now await the `onPlansResource` hook
  (mirroring the existing `await form.submit()` pattern). Deterministic across
  Node versions; no runtime change.
- **Corrected fabricated data** from a prior report revision: the v1.4 "browser
  regression" millisecond figures (initial mount 197.1 → 364.4 ms, hydration
  162.6 → 370.6 ms, etc.) and the "612/7 live-HTTP" test tally were never
  produced by an executed run and are retracted. The `example-account` and
  `example-data` live-HTTP tests are confirmed real (an earlier draft wrongly
  denied their existence — retracted).

### Measured (Node + happy-dom; not browser numbers)

- **SSR** (`/users`, 10k rows): `renderToString` median 199.8 ms (n=15);
  mount 60.1% / serialize 31.5% / escape ~3.4%. Serializer A/B: legacy 107.4 ms
  → shipped 65.7 ms = **1.63× faster**, byte-identical. SSR mount identified as
  the remaining bottleneck; static-subtree path scoped for a future release.
- **Hydration**: 88.6 ms median (n=12), **0 nodes created** — zero-node
  invariant holds on a 10k-row view.
- **Fine-grained update**: 2 structural writes independent of N (1k or 100
  controls); form field isolation DOM-verified.
- **Bundle** unchanged from v1.4: minimal 7,619 B gzip, typical 14,377 B,
  full 20,205 B, real app 14,667 B.

### Blocked (recorded, not fabricated)

- **Real-browser benchmarks**: BLOCKED — no Chromium binary, npm/CDN 403 offline.
  Unified runner is written and ready; no browser millisecond figure is reported.
- **Cross-framework comparison** (React/Vue/Svelte/Solid): BLOCKED — frameworks
  absent, no browser to run them. No ranking or winner asserted.

### Verification

- Build 29/29, typecheck 47/47, tests **657** — same count as v1.4 on VM
  (Node v22.23.2); host (Node v24.18.0): 657 after the example-account fix.

## v1.3 milestone — Real-world application performance & browser validation

A **measurement, real-application, and documentation** milestone. **No public API
change** (168 values / 171 types preserved), **no breaking changes**, and **no new
runtime dependency**. The shipped package version stays `1.2.0`: the release
registry gate is BLOCKED offline (E403), so no publish/version bump is performed;
a 1.3.0 minor bump would be semver-correct for these additive-only changes and is
deferred to the release process. Full detail in
[`V1.3-REAL-WORLD-PERFORMANCE-REPORT.md`](./V1.3-REAL-WORLD-PERFORMANCE-REPORT.md).

### Added (all outside the shipped `streetui` package)

- **`examples/streetui-performance-app`** — a real multi-route application
  (header/nav/sidebar shell, a 10,000-row keyed users table, 1,000 interactive
  controls, validated forms, `:id` + wildcard routing, an async resource with
  retry/abort, i18n, SSR + hydration). Built entirely on the frozen API; no new
  API was required.
- **Node real-app harness** (`benchmarks/run-streetui.mjs`,
  `packages/benchmarks/perf-app-scenarios.mjs` + per-scenario worker) measuring
  initial mount, router navigation, hydration, fine-grained updates, form
  isolation, keyed-list ops, SSR sizes, and lifecycle accumulation — DOM mutations
  counted at the single `BrowserDOMAdapter` choke point.
- **Bundle measurement** (`scripts/bundle-sizes.mjs`): minified raw/gzip/brotli
  across minimal/typical/full/real-app profiles, esbuild as a measurement-only
  tool (never a runtime dependency).
- **Result set** `benchmarks/results/v1.3/` with regression gates and an
  `environment.json`, each carrying PASS / BLOCKED / NOT_RUN + exact reason.
- **Eight documentation guides** (getting-started, reactivity, components,
  routing, forms, data, ssr, hydration) written against the real app and indexed
  from `docs/README.md`.

### Measured (Node + happy-dom; not browser numbers)

- Hydrating the 10,000-row view creates **0** DOM nodes (zero-node guarantee holds
  on a realistic view). Fine-grained update cost is **independent of N** (2 writes
  at 100 or 1,000 controls). Form field isolation is DOM-verified. 8 lifecycle
  cycles show no node drift and 0 orphans.
- Shipped bundle unchanged: full minified barrel **20,105 B gzip**, minimal app
  **8,606 B gzip**, **0 B** framework CSS. The diagnostic unminified-barrel gzip
  moved 28,764 → 28,765 B (**+1 byte**, disclosed); the shipped minified size did
  not change.

### Blocked (recorded, never fabricated)

- **Real-browser metrics** (paint/layout/TTI/frame pacing/JS heap): BLOCKED — no
  Chromium/Playwright and the offline registry (E403) cannot fetch one.
- **Competitor comparison** (React/Vue/Svelte/Solid): BLOCKED — cannot install
  offline, no browser to run them. **No winner or ranking is asserted.**

### Verification

- Build 29/29, typecheck 47/47, tests **657** — the deltas over v1.2 (28/46/652)
  are entirely the new performance-app package and its 5-test suite.

## 1.2.0 — Compiler, initial render & runtime

A **minor, additive** release. No breaking changes over 1.1.0/1.0.0; the public
API (168 values / 171 types) is unchanged and no dependency was added. The v1.0
architecture is fully preserved.

### Performance & correctness (measured, happy-dom / Node)

- **Hydration** allocation pass: the per-child diagnostic path string is now
  built only when a diagnostics sink is attached, and per-type update closures
  are built only for genuinely-reactive nodes. Profiled samples −38%
  (786 → 489), wall ~3.8 → ~3.3 ms/10k; hydration still creates **zero** DOM
  nodes. The same reactive-only closure guard was applied to `mount`.
- **Mount** micro-optimisations: killed a throwaway per-node `NodeInstance`,
  replaced `Object.entries` with an allocation-free `for..in`/`Object.hasOwn`
  prop loop, and added empty-events/empty-stateRefs guards. Op counts unchanged.
- All v1.1 keyed-list wins and every fine-grained invariant are preserved
  (single update = 1 mutation, deep-state = 1 node, SSR byte-identical at
  338920 B, reverse = N−1 minimal moves).
- **Honest non-results:** CPU profiling proved the v1.1 initial-render (+16%)
  and reverse (+5.5%) "regressions" are happy-dom timing noise and unavoidable
  DOM-engine cost, not StreetUI algorithmic regressions — so no speculative fast
  path was added. Runtime bundle is now **flat** (gzip 28680 → 28764 B, +0.29%),
  the +84 B disclosed as the cost of the hydration/mount allocation wins.

### DevTools / diagnostics

- New opt-in compiler inspection — `analyzeGraph`, `inspectCompilation`,
  `formatInspection` — reachable only from the dev-facing `streetui/testing`
  subpath (and `@streetui/compiler/diagnostics`). Deliberately kept **off** the
  runtime `streetui` barrel and out of `compile()` so it tree-shakes away and
  never regresses initial render.

### Not claimed

- No cross-framework performance claim is made. React/Vue/Svelte/Solid harnesses
  exist but could not run (offline registry 403, no Chromium/Playwright);
  competitor and real-browser results are **BLOCKED, not faked**. All numbers are
  happy-dom/Node and v1.2-vs-v1.1 only. See
  [`V1.2-PERFORMANCE-REPORT.md`](./V1.2-PERFORMANCE-REPORT.md).

## 1.1.0 — Performance: keyed-list reconciler

A **minor, additive** release. No breaking changes over 1.0.0; existing code
compiles and runs unchanged. The v1.0 architecture (DSL → Compiler → Semantic
Graph → Runtime → direct DOM renderer; no virtual DOM; no second reactive
system; one public `streetui` package) is fully preserved.

### Performance (measured, happy-dom / Node, 10k-row keyed list)

- Reactive keyed lists now use a **lazy reconciliation plan** with an
  identity short-circuit (a reused row whose item reference is unchanged does
  zero work) plus a **longest-increasing-subsequence** minimal-move DOM
  reorder. Measured medians vs 1.0.0: append −45%, prepend −87%, remove −45–50%,
  reorder −89%, update-item −52%.
- **Disclosed regression:** full-list `reverse` is ~5.5% slower (its inherent
  worst case — LIS length 1 ⇒ N−1 moves). Not hidden.
- Scalar fine-grained reactivity is unchanged and remains optimal: a single
  signal update is still exactly one DOM mutation; deep-state updates touch one
  node; SSR output is byte-identical; hydration still creates zero nodes.
- Runtime bundle grew ~4% (gzip 27488 → 28680 B) — a deliberate size-for-speed
  trade on the hottest path.

### DevTools

- `inspectApplication(...).perf` gains a count-only `reactiveLists` field (the
  number of signal-driven `listOf` sites using the optimised path). No new UI.

### Not claimed

- No cross-framework performance claim is made. React/Vue/Svelte/Solid harnesses
  exist but could not run (offline, no browser); competitor results are BLOCKED,
  not faked. All performance claims are v1.1-vs-v1.0 only. See
  [`V1.1-PERFORMANCE-REPORT.md`](./V1.1-PERFORMANCE-REPORT.md).

### Version alignment

- Every public package and `CLI_VERSION`/`VERSION` move to `1.1.0`; coordinated
  stability tests updated to match.

## 1.0.0 — Stable public release

This is a **stabilization** release, not a feature release. It freezes the API
surface that grew across the 0.x series and aligns every published package on a
single version. There are **no breaking changes to the public API** relative to
0.9; existing 0.9 code compiles and runs unchanged. See
[`docs/migration-to-1.0.md`](./docs/migration-to-1.0.md).

### Version alignment

- Every public package now publishes at `1.0.0`. Internal dependency edges use
  `workspace:*` in-repo and are rewritten to the exact `1.0.0` at pack time.
- `@streetui/cli` `CLI_VERSION` is corrected from `0.6.0` to `1.0.0`, so
  `streetui --version` and the framework version stamped into scaffolded
  projects match the release.
- Project templates (`basic`, `ssr`) now pin their `@streetui/*` dependencies to
  the framework version token instead of a stale `0.1.0`, so `create` scaffolds a
  project whose dependencies resolve to the installed framework.

### API surface (frozen)

- 168 public values and 171 public types across 17 packages, all classified
  **stable** — zero `deprecated`, `experimental`, or `internal` exports leak from
  a public barrel. The machine-readable inventory is
  [`dist-tarballs/api-inventory.json`](./dist-tarballs/api-inventory.json),
  produced by `scripts/api-inventory.mjs` from the built `.d.ts` files.
- Each public package carries a `public-api.stability.test.ts` contract test that
  asserts its frozen export list is present (and, where behavior is verified,
  exercises it), so an accidental removal or rename fails CI.

### Release tooling

- `scripts/release-check.mjs` enforces, as errors: version divergence across the
  public set, missing per-package `README.md`/`LICENSE`, `file:`/`link:`/`portal:`
  internal-source protocols, and missing `dist/`. It writes an enriched release
  manifest (git commit + channel) and never mutates the tree.
- `scripts/api-inventory.mjs` generates the public API inventory used for the
  §44 report and the stability tests.

### Verified in this release

- Build 27/27 packages, typecheck 27/27, and the full test suite green
  (619 tests, up from the 0.9 baseline of 571; no test deleted, skipped, or
  weakened).
- All 17 public packages pack to tarballs at `1.0.0`; an offline consumer smoke
  test imports and server-renders through both the ESM and CJS entry points.

### Known gates NOT validated in this environment

Honesty about what could not be proven here (see
[`docs/browser-support.md`](./docs/browser-support.md)):

- **Real-browser validation is BLOCKED** — no Chromium/Chrome/Firefox/Playwright
  is available in the build sandbox. Hydration and DOM behavior are validated
  against a spec-compliant DOM (happy-dom/jsdom), not a shipped browser.
- **Registry publication is BLOCKED** — no reachable npm registry. Packaging is
  proven up to locally-built tarballs and an offline consumer install; nothing has
  been published, and no "available on npm" claim is made.

## 0.9.0 — Ecosystem: DevTools, testing, observability, docs portal

Headless DevTools (`createDevTools`, reactive inspectors, sensitive-by-default
redaction), a testing package (`render`, role/text queries, `waitFor`,
`renderServerThenHydrate`), observability sinks (`DiagnosticSink`,
`frameworkError`, hydration diagnostics — no telemetry, no network sends), a
non-mutating release check, and the documentation portal.

## 0.8.0 — Packaging & production hardening

Offline tarball consumer gate (no workspace linking), production-server security
hardening, and the full-app end-to-end example.

## 0.7.0 — Performance

Benchmark package, hot-path profiling and evidence-backed optimizations,
devtools performance surface, and bundle-size analysis.

## 0.6.0 — Platform & CLI

`@streetui/cli` (`create`/`dev`/`build`/`start`), project scaffolding and
templates, config and environment model, dev server, and production build/start.

## 0.5.0 — Forms, context, accessibility, i18n

Forms and validation, the context system, accessibility primitives, and
internationalization foundations.

## 0.4.0 — SSR & hydration

Server renderer (`renderToString`), `hydrate()` with node adoption and local
self-repair, resource dehydration, and router SSR integration.

## 0.3.0 — Resources & error boundaries

`resource()` reactive async lifecycle and `errorBoundary` in the DSL.

## 0.2.0 — Router

Route matching, navigation, and lifecycle.

## 0.1.0 — Foundations

The semantic pipeline: TypeScript DSL → compiler → semantic application graph →
runtime → DOM renderer, with the framework's own reactivity and keyed
reconciler. No virtual DOM, no React/Vue/Preact, no JSX runtime.
