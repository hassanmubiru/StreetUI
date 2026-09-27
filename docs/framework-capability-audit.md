# StreetUI Framework Capability Audit (v1.9 §1)

*Generated 2026-09-27. This audit inspects the **actual** public API, implementation,
and tests of the single public `streetui` package (subpaths `streetui`, `streetui/server`,
`streetui/testing`) — it does not assume or invent gaps. Every EXISTS / PARTIAL / MISSING
verdict is backed by an exported symbol, a source file path, and/or a test, or by a
whole-repo grep proving absence. This is the blocking first step of the v1.9 mission: no
§2–§21 implementation begins until this audit is delivered and feature scope is agreed.*

## How to read this

- **EXISTS** — a real, exported, tested implementation of the capability.
- **PARTIAL** — a genuine mechanism exists but is narrower than a "production UI platform"
  capability (missing sub-features are named precisely).
- **MISSING** — no implementation anywhere in `packages/*/src` (confirmed by grep, dist
  `.d.ts` artifacts excluded as evidence).

Evidence was gathered by reading source + `*.test.ts` across `packages/state`, `dsl`,
`graph`, `compiler`, `renderer`, `runtime`, `events`, `core`, `router`, `forms`, `context`,
`i18n`, `dom`, `devtools`, `testing`, and `cli`.

## Summary table (28 capabilities)

| # | Capability | Verdict | One-line basis |
|---|---|---|---|
| 1 | Reactivity | EXISTS | `signal/derived/effect/batch/createStore` + `resource` (packages/state) |
| 2 | Components | MISSING | no `defineComponent`/component unit; `'component'` node type reserved but never created |
| 3 | Composition | PARTIAL | builders nest + can be extracted as JS functions; no first-class compose primitive |
| 4 | Children / slots | PARTIAL | builder callbacks are the child region; no named `children`/`slot` API |
| 5 | Props | PARTIAL | element/container options bag; no props-into-reusable-unit (no components) |
| 6 | Conditional rendering | EXISTS | `when(cond, builder, elseBuilder)` keyed branches (packages/dsl) |
| 7 | Lists | EXISTS | `listOf` + LIS keyed reconciler with node reuse (packages/dsl, renderer) |
| 8 | Events | EXISTS | `onClick/onInput/onChange/onSubmit` + EventBus/DomEventRegistry |
| 9 | Lifecycle | EXISTS | `NodeInstance` dispose + `CleanupRegistry`; core `Lifecycle` phase API |
| 10 | Router | EXISTS | `createRouter/mountRouter/routerOutlet`; **gaps: no guards, no nested routes, no route meta** |
| 11 | Resources / async data | EXISTS | `resource()` full state machine; **gap: no auto-retry/backoff** |
| 12 | Forms | EXISTS | `createForm` + 5 validators, field isolation, submit lifecycle |
| 13 | Context | EXISTS | `createContext/provide/consume` (build-time scoping) |
| 14 | i18n | EXISTS | `createI18n` reactive/typed `t`, `plural`, locale switch |
| 15 | SSR | EXISTS | `renderToString`, `ServerDOMAdapter`, static-SSR plan, `ServerRawHTML` |
| 16 | Hydration | EXISTS | `hydrateGraph` zero-node adoption + 3 mismatch types + diagnostics |
| 17 | Accessibility | EXISTS | ARIA option surface + `a11yIds` (SSR-stable); **mechanics only, no dialog/menu/tabs patterns** |
| 18 | Overlays (modal/dialog/popover/tooltip/toast) | MISSING | grep: no builders/classes/exports |
| 19 | Portals | MISSING | grep `portal`: no files |
| 20 | Focus management | PARTIAL | `focusById`/`focusFirst`/`FOCUSABLE_SELECTOR`; **no trap/restore/containment/escape** |
| 21 | Transitions (enter/leave/appear) | MISSING | grep: no transition API |
| 22 | Animations (CSS/WAAPI/rAF) | MISSING | grep `animat|requestAnimationFrame`: no files |
| 23 | Head / metadata | MISSING | grep `document.title/<meta>/canonical/openGraph`: no API |
| 24 | Error handling | PARTIAL | `errorBoundary` reactive swap + diagnostic seam; **no renderer/event/SSR/router trap** |
| 25 | Async UI | PARTIAL | composed from `resource()+when()+errorBoundary()`; no single boundary primitive |
| 26 | DevTools | PARTIAL | `inspectApplication`/`createDevTools` headless data + `format()`; **no UI, no DOM panels** |
| 27 | Testing | EXISTS | `render/findByRole/waitFor/renderServerThenHydrate` (streetui/testing) |
| 28 | CLI | EXISTS | `create/dev/build/start`; **no `doctor`/`info`/`analyze`** |

**Tally: 12 EXISTS · 8 PARTIAL · 8 MISSING.** The MISSING/PARTIAL cluster is almost
entirely the "production UI platform" surface (§5–§13): overlays, portals, focus lifecycle,
transitions, animations, head/meta, plus a first-class async/error UX and a real DevTools UI.
The core rendering + reactivity + app-services foundation (§2 primitives, router, resources,
forms, context, i18n, SSR, hydration, testing) is solid and tested.

---

## Group A — Core UI primitives (reactivity, components, composition, children, props, conditionals, lists, events, lifecycle)

### 1. Reactivity — EXISTS
Public API: `signal`, `derived`, `effect`, `batch`, `isBatching`, `signalKind`, `observerCount`,
types `Signal`/`DerivedSignal`/`ReadonlySignal` (`packages/state/src/signal.ts`); `Store`,
`createStore` (`store.ts`); `resource` (`resource.ts`). Pull-based dependency tracking
(`_activeConsumer`), lazy dirty-recompute derived, effect cleanup-return, batch coalescing
(last-write-wins), `Object.is` change guard. Tests: `packages/state/src/state.test.ts`
(`signal`/`derived`/`effect`/`batch`/`Store`).

### 2. Components — MISSING
No reusable component unit. No `defineComponent`/`createComponent`/component builder exists.
The DSL (`AppDSL`/`PageDSL`/`ContainerDSL`, `packages/dsl/src/dsl-types.ts`) exposes only
element/container builders + `page`. `SemanticNodeType` (`packages/core/src/node.ts`) reserves
`'component'`/`'slot'`/`'fragment'` and `tag-map.ts` maps them to `div`, but a repo-wide search
for `createNode('component'|'slot'|'fragment')` returns **no matches** — they are inert
type-union members. The only reuse today is extracting a plain `(scope) => void` builder as a
JS function.

### 3. Composition — PARTIAL
Builders nest structurally: `section`/`container`/`list`/`form`/`when`/`errorBoundary` each take
a `(childScope) => void` callback (`packages/dsl/src/builders.ts`, `ContainerBuilderBase`). Because
those are ordinary functions they can be extracted and reused (demonstrated by
`packages/benchmarks/src/apps.ts` `buildListApp`/`buildConditionalApp`). Nesting tested in
`packages/dsl/src/dsl.test.ts` (`nesting` → `heading.depth === 4`). **Absent:** any
framework-level compose primitive or component boundary; reuse is purely conventional JS
function extraction with no test asserting a builder is reusable as a unit.

### 4. Children / slot-like composition — PARTIAL
The child-region mechanism is the builder callback: `section/container/form/list(key, builder)`,
`listOf(key, items, renderItem)`, `when(cond, builder, elseBuilder)` all pass a fresh child DSL
scope to a caller callback; `renderItem(item, index, content)` is the closest to parameterized
children. **Absent:** no named `children`/`slot` API. The `'slot'` node type is never created;
the "slot" in `hydrate.test.ts` is just a `container` with `id:'slot'` used as a router hydration
boundary, not a DSL slot primitive.

### 5. Props — PARTIAL
Element/container builders accept an options bag applied to the graph node + rendered as
DOM/ARIA attributes: `class`, `id`, `key`, `level`, `disabled`, `value`, `placeholder`, `href`,
`src`/`alt`, plus the full `A11yOptions` set (`dsl-types.ts`, applied by `applyA11yProps`/
`containerProps`; attribute pass in `packages/renderer/src/attributes.ts`). Tests: `dsl.test.ts`
(heading level, input placeholder), `renderer.test.ts` (`applyProp`/`patchProp`). **Absent:**
no way to pass props into a reusable unit (no components); data into an extracted builder is
plain JS parameters, not a framework prop system.

### 6. Conditional rendering — EXISTS
`ContainerDSL.when(condition, builder, elseBuilder?)` (`dsl-types.ts`, impl `builders.ts`
`ContainerBuilderBase.when`) creates a `'conditional'` node; a signal condition wires
`__signal__`/`__listbuild__` and reuses the keyed reconciler (then/else are distinct keyed
branches); static booleans resolve at build time. Tests: `renderer/src/api-improvements.test.ts`
(`when() conditional rendering`, incl. events inside), plus `hydrate.test.ts`, `ssr.test.ts`,
`static-ssr-plan.test.ts`.

### 7. Lists — EXISTS
Static `list(key, builder)` + `ListDSL.item(...)`, and reactive `listOf<T>(key, items, renderItem,
options?)` (`dsl-types.ts`, impl `builders.ts`). `listOf` creates a `'reactive-list'` node,
subscribes to `Signal<T[]>`, emits a lazy `ListPlanEntry[]` plan (`__listplan__<id>`) with identity
key + on-demand `sig()`/`build()` thunks. Keyed reconciler with DOM reuse across reorder in
`packages/renderer/src/reconciliation.ts`. Tests: `renderer.test.ts` (`reactive list — listOf`:
grow/shrink, keyed identity + node reuse on reorder, in-place value change, subscription cleanup)
and `reconcile-perf.test.ts`.

### 8. Events — EXISTS
DSL: `onClick` (button/link), `onInput`/`onChange`/`bind` (input), `onSubmit` (form) →
`registerHandler` + `node.addEvent`. Renderer `wireEvents` (`packages/renderer/src/events.ts`)
attaches DOM listeners (input/change value extraction, submit `preventDefault`) with teardown via
`instance.trackCleanup`. Event subsystem `packages/events`: `EventBus`
(`on/off/once/emit/clear/listenerCount`, `globalEventBus`), `bindDomEvent`/`DomEventRegistry`,
`StreetEvent`/`createStreetEvent`. Tests: `events/src/events.test.ts`; `renderer.test.ts`
(`events — button click`, listeners removed after unmount); `dsl.test.ts` (handler registration).

### 9. Lifecycle — EXISTS
Wired path: `NodeInstance` (`packages/renderer/src/node-instance.ts`) — `trackSignal`,
`trackCleanup`, recursive `dispose()` running a `CleanupRegistry` (`packages/core/src/lifecycle.ts`).
A standalone phase-based `Lifecycle` class (created→mounted→active→updating→unmounting→destroyed
with `onMount`/`onUnmount`/`onDestroy`) also exists in core but is **not** imported by the
renderer (the renderer drives cleanup via `CleanupRegistry`, not the phase API). Tests:
`core/src/core.test.ts` (`Lifecycle`, `CleanupRegistry`); `renderer.test.ts` (`unmount` removes
children, safe double-unmount, listener removal; `listOf` subscription/listener cleanup).

---

## Group B — Application services (router, resources, forms, context, i18n)

### 10. Router — EXISTS (with gaps)
Public API (`packages/router/src/index.ts`): `createRouter`, `mountRouter`, `routerOutlet`,
`ROUTER_OUTLET_ID`, `createBrowserHistory`, `createMemoryHistory`, `matchPattern`, `matchRoutes`,
`normalizePath`, `splitTarget` + types. `createRouter` (`router.ts`): reactive `currentRoute`,
`navigate(to, {replace})`, `back`/`forward`, `isActive(path, {exact})` (derived), built-in 404
(`DEFAULT_NOT_FOUND`, overridable). Matching (`matching.ts`): static/`:param`/`*` catch-all,
ordered first-match. History (`history.ts`): browser pushState/popstate + memory. `mountRouter`
(`mount-router.ts`): persistent shell + outlet, per-route mount/dispose, link interception,
hydration adoption; `RouteContext` exposes `path/pattern/params/query/onCleanup`. Route lifecycle
= two-phase cleanup (`onCleanup` run before DOM teardown). Tests: `router.test.ts`,
`matching.test.ts`, `mount-router.test.ts` (incl. "CRITICAL route lifecycle cleanup"),
`hydrate-router.test.ts`. **Gaps:** no navigation guards (`beforeEnter`/`canActivate`/redirect);
no nested/child route trees (explicitly flat); no route-bound metadata (`RouteDefinition` is
`path` + `builder` only — relevant to §11/§12 head work); no enter/update hooks beyond
`onCleanup`; no optional segments/regex params.

### 11. Resources / async data — EXISTS (retry absent)
`resource(loader, options): Resource<T>` (`packages/state/src/resource.ts`). Reactive `status`
(`idle|loading|success|error`), `data`, `error`, `loading`, `isRefetching`; `refetch()`,
`dispose()`; monotonic `runId` race guard; AbortController cancellation; `watch` deps; SSR seed
(`initialData`/`initialError`/`initialStatus`); `onCleanup`. Tests: `resource.test.ts` (transitions,
refetch preserving data, race conditions, abort, watch, cleanup, SSR seed). **Gap:** no automatic
retry/backoff — recovery is manual via `refetch()`.

### 12. Forms — EXISTS
Public API: `createForm`, validators `required`/`email`/`minLength`/`maxLength`/`pattern`,
`runValidators` (`packages/forms/src`). `createForm` (`form.ts`): per-field writable `value`
signal + derived `error`/`valid`/`dirty`/`touched`; form-level aggregates + `status`/`submitError`;
`field()`, `setValues()`, `submit()`, `reset()`, `dispose()`. Field isolation: each field its own
signal set; `touched` only on genuine (non-programmatic) change. Tests: `validators.test.ts`,
`form.test.ts` (model, submission lifecycle, cleanup). Design boundaries (not required by audit
list): sync validators only, flat `Record<string,string>` values.

### 13. Context — EXISTS
`createContext(defaultValue, description?): Context<T>` with `id` (symbol), `provide(value, run)`,
`consume()`, `hasProvider()` (`packages/context/src/context.ts`). Build-time provider/consumer
scoping via a value stack pushed for the synchronous `run()` and popped in `finally`; nearest
enclosing provider wins, else default; a context value may itself be a signal (not a second
reactive system). Tests: `context.test.ts` (default, nesting resolution, pop-on-throw, independent
contexts, reactive value). Note: `provide`/`consume` are methods on the context object, and scope
is synchronous build-time (async consumption after `run()` returns falls back to default).

### 14. i18n — EXISTS
`createI18n(config)` + `interpolate` (`packages/i18n/src/i18n.ts`). `I18n<M>`: reactive `locale`,
`setLocale()`, `locales`, `t(key, params)` (derived, typed `keyof M`), `translate` (one-shot),
`plural(key, count, params)` (Intl.PluralRules, derived), `has(key)`. Fallback locale; deterministic
miss (returns key) for SSR/hydration stability. Tests: `i18n.test.ts` (typed keys, reactive locale,
pluralization, has, determinism). Notes: `plural` key typed `string` (not `keyof M`); flat message
map (dotted keys for plural categories).

---

## Group C — Rendering platform & production UI surface (SSR, hydration, a11y, overlays, portals, focus, transitions, animations, head)

### 15. SSR — EXISTS
`renderToString` + `RenderToStringOptions` (`packages/renderer/src/ssr.ts`); `ServerDOMAdapter`
class + `serverDOMAdapter` singleton + `createRawHTML(html)` (`packages/dom/src/server-adapter.ts`);
static-SSR plan `StaticSSRPlan = ReadonlyMap<NodeId,string>`, `buildStaticSSRPlan`,
`getStaticSSRPlan` (`static-ssr-plan.ts`); `ServerRawHTML` (`kind='raw'`, SSR-only) +
`serializeServerNode` verbatim raw handling (`packages/dom/src/server-node.ts`). Tests:
`ssr.test.ts`, `static-ssr-plan.test.ts`, `server-node.lazy-alloc.test.ts`. **Preserve per §25.**

### 16. Hydration — EXISTS
`hydrateGraph(ctx)` zero-node adoption ("Match — adopt the existing element"; "repair only this
subtree") (`packages/renderer/src/hydrate.ts`); mismatch types
`'tag-mismatch'|'missing-element'|'surplus-element'` + `HydrationDiagnostic`/
`HydrationDiagnosticSink`/`formatHydrationDiagnostic`/`createHydrationDiagnosticCollector`/
`consoleHydrationDiagnosticSink` (`hydration-diagnostics.ts`). Tests: `hydrate.test.ts`,
`hydrate-router.test.ts`. **Preserve per §26/§28.**

### 17. Accessibility — EXISTS (mechanics only)
SSR-stable id helpers `a11yIds(base)` → `A11yIds` (`input/label/description/error/title/id`),
`toIdToken` (`packages/core/src/a11y-ids.ts`, no counters/randomness). Full ARIA option surface in
DSL `A11yOptions`: `role`, `tabIndex`, `ariaLabel`, `ariaLabelledBy`, `ariaDescribedBy`,
`ariaExpanded`, `ariaControls`, `ariaHidden`, `ariaLive`, `ariaCurrent`, `ariaInvalid`,
`ariaRequired` (`dsl-types.ts`), mapped by `applyA11yProps` (`builders.ts`). Tests: `a11y-ids.test.ts`;
`renderer/src/a11y.test.ts` (server rendering + hydration adoption, identical ids). **Scope note:**
this is the *mechanics* to author accessible markup; there is no framework-provided dialog/menu/tabs/
live-region *pattern* (that is §13 platform work, and depends on §18–§20 overlays/focus which are
MISSING/PARTIAL).

### 18. Overlays (modal/dialog/dropdown/popover/tooltip/context-menu/toast) — MISSING
No overlay components. Case-insensitive grep `overlay|modal|dialog|popover|tooltip|toast` across
`packages/*/src` hit only an ARIA-role doc example (`'dialog'` in `dsl-types.ts`) and comment
references in `core/src/a11y-ids.ts`/`focus.ts`. No builders, classes, or exports.

### 19. Portals — MISSING
Grep `portal` (case-insensitive) across all `packages/*/src`: **no files**. No mount-to-different-
target primitive exists (prerequisite for §5 overlays).

### 20. Focus management — PARTIAL
Two adapter helpers exist: `focusById(dom, root, id)`, `focusFirst(dom, container, selector)`, and
`FOCUSABLE_SELECTOR` (`packages/dom/src/focus.ts`, exported, tested in `focus.test.ts`). **Absent:**
focus trap, restore, containment, escape handling — grep
`trapFocus|restoreFocus|focusTrap|containFocus|lastFocused|previousFocus|Escape` → no matches. The
containment/restore lifecycle needed for accessible dialogs (§6) does not exist.

### 21. Transitions (enter/leave/appear on when()/listOf()/router) — MISSING
No transition API. Grep `transition(|onEnter|onLeave|onAppear|Transition` → no matches. `when()`
and `listOf()` swap DOM immediately with no enter/leave hook.

### 22. Animations (CSS class / Web Animations API / rAF) — MISSING
Grep `animat|WAAPI|requestAnimationFrame` (case-insensitive) across `packages/*/src`: **no files**.
No `animate()`, no WAAPI usage, no rAF animation strategy. (Consistent with §8's constraint to add
no animation library dependency when this is eventually built.)

### 23. Head / metadata (title/meta/description/OG/canonical/favicon/robots) — MISSING
No head/metadata management. Targeted grep
`document.title|setTitle|<meta|MetaTag|openGraph|canonical|createHead|useHead|updateHead` → no
matches. Broad `head` hits are `<head>` literals inside CLI template server files only. No API to
set title, meta, OG, canonical, favicon, or robots, and (per §10) `RouteDefinition` carries no
metadata to drive route-bound head (§11/§12).

---

## Group D — UX, tooling, and developer surface (error handling, async UI, DevTools, testing, CLI)

### 24. Error handling — PARTIAL
`ContainerDSL.errorBoundary(id, builder, options)` with `ErrorBoundaryOptions { fallback, source?,
onRetry? }` (`dsl-types.ts`, impl `builders.ts`). Composed on `when()`: observes a `source` error
signal + a local error signal and catches a **synchronous** throw in the body (surfaced via
`queueMicrotask`); the doc comment states it "does NOT trap arbitrary global errors". Separate
observability seam in core: `frameworkError`, `StreetFrameworkError`, `DiagnosticSink`,
`reportDiagnostic`, `consoleDiagnosticSink` (`packages/core/src/observability.ts`, silent by default);
hydration errors via `hydration-diagnostics.ts`. Tests: `error-boundary.test.ts` (healthy/reactive
fallback/retry/sync throw/with resource/cleanup), `observability.test.ts`. **Absent:** no
renderer-level try/catch around reactive updates or event handlers (grep `catch` in
`packages/renderer/src` → only `dehydrate.ts`); no SSR/router error trapping. Error handling is the
`errorBoundary` reactive swap + an optional diagnostic-logging seam, not a routed error channel
across render/event/resource/router/SSR (the §10 target).

### 25. Async UI — PARTIAL (composed, not first-class)
No dedicated loading/success/error/retry/placeholder boundary primitive. Async UI is assembled from
`resource()` (state machine, §11) + `when()` (§6) + `errorBoundary()` (§24) — demonstrated by
`error-boundary.test.ts` "with a real resource" (`source: products.error`, `onRetry: refetch`).
`ContainerDSL` exposes only `when`/`listOf`/`errorBoundary` as reactive constructs — no
`suspense`/`asyncUI`/`placeholder` builder. **This matches §9's constraint** (reuse existing
primitives, no second async system); a §9 deliverable would be an ergonomic wrapper over these,
not a new engine.

### 26. DevTools — PARTIAL (headless foundation, no UI)
Foundation: `inspectApplication(compiled): ApplicationInspection` (identity/graph/nodeStats/signals/
pages/diagnostics/count-only perf) (`packages/devtools/src/application.ts`); graph inspectors
`inspectGraph`/`printGraph`/`printDiagnostics`/`nodeTypeStats`. Session/panels:
`createDevTools(compiled, sources?, options?): DevToolsSession` with `snapshot`/`refresh()`/
`selectNode(id)`/`format()` (`panels.ts`) — panel shapes `ApplicationPanel`/`SignalsPanel`/
`PerformancePanel`/`DevToolsSnapshot`. Reactive inspectors `inspectSignal`/`inspectResource`/
`inspectRouter`/`inspectForm`/`inspectContext`/`inspectI18n` (`inspect-reactive.ts`); perf
`diagnosePerformance`/`DEFAULT_PERF_THRESHOLDS`. Tests: `application.test.ts`, `panels.test.ts`,
`devtools.test.ts`, `inspect-reactive.test.ts`, `diagnostics.test.ts`, `public-api.stability.test.ts`
(14 frozen exports). **Absent:** any rendered UI — `createDevTools` never subscribes to signals
(explicit `refresh()` pull only), renders no DOM, and nothing in the runtime imports it. "Panels"
are data + a `format()` string. §14–§17 build a UI **on this foundation**.

### 27. Testing — EXISTS
`streetui/testing` surface (`packages/testing/src`): `render(app): RenderResult` (real
renderer/compiler mount; `container`/`handle`/`unmount`/`flush`/`getByTag`/`getByText`/`query`/`find`),
`renderOnce(app, testFn)` (auto-clean + `resetIdCounter`), `flushUpdates()`, `waitFor(check, opts)`,
`findByText`, `findByRole`, `findAllByRole` (implicit ARIA role mapping + accessible-name filter),
and the SSR workflow `renderServerThenHydrate(build, opts)` → `{ container, serverHtml, handle,
diagnostics, flush, unmount }`. Frozen 8-export surface in `public-api.stability.test.ts`. Tests:
`testing.test.ts`, `helpers.test.ts`. All §18-requested helpers present.

### 28. CLI — EXISTS (no doctor/info/analyze)
`runCli(argv, options)` handles `create <dir>`, `dev`, `build`, `start` + `--help`/`--version` +
unknown-flag rejection (`packages/cli/src/index.ts`). Commands: `createProject`, `runDev`,
`buildProject`, `runStart`; support `serve.ts`, `config.ts` (`defineConfig`/`loadConfig`), `env.ts`,
`project.ts`, `args.ts`, `templates.ts`. Tests: `cli.test.ts`, `e2e.test.ts` (create→build→start→
request), `serve.test.ts` (static assets, path-traversal containment), `args.test.ts`, others +
`public-api.stability.test.ts` (18 frozen exports). **Absent:** `doctor`/`info`/`analyze` commands
(grep found none) — the §19 audit-hint capabilities are not implemented.

---

## Cross-cutting integrity findings (discovered during audit)

**Version state is inconsistent in the working tree — needs a decision before v1.9 ships.** The
audit surfaced a mismatch that also affects the "688/688 tests pass" claim carried in prior records:

- `packages/streetui/package.json` → `"version": "1.6.1"`
- `packages/cli/src/index.ts` → `export const CLI_VERSION = '1.6.1'`
- `packages/streetui/src/version.ts` → `export const VERSION = '1.6.0'`
- `packages/cli/src/public-api.stability.test.ts:24` → `expect(CLI_VERSION).toBe('1.6.0')`

So `package.json`/`CLI_VERSION` (1.6.1) disagree with `version.ts` (1.6.0), and the CLI stability
test asserts 1.6.0 — meaning that test **would fail** against the current `CLI_VERSION = '1.6.1'`.
This is inconsistent with the recorded green build. The npm registry also returns E403 (the package
is not actually published), so any "1.6.1 published" statement elsewhere in the repo's reports is
not verifiable here. **Recommendation:** before any v1.9 work, reconcile the version to a single
value across all four locations (and re-run `turbo run test`), and correct any report that claims a
publish that E403 prevents. This audit does not change versions on its own — it is a decision for
the maintainer given the release history.

## Preservation checklist mapped to this audit (§25–§28)

- **§25 SSR** — capability 15 EXISTS (static plan / `ServerRawHTML` / WeakMap cache); must stay
  byte-identical (`node scripts/verify-ssr-hashes.mjs`, all 5 hashes).
- **§26 fine-grained reactivity** — capabilities 1/6/7 EXISTS; `update-independence.test.ts` pins
  one-signal → one-write, independent of N. No new feature may introduce rerender-all.
- **§27 keyed identity** — capability 7 EXISTS (LIS reconciler, node reuse across append/prepend/
  swap/reverse/targeted-update/cleanup); overlays/transitions must not bypass it.
- **§28 tests** — every EXISTS capability above is test-backed; new features add tests, none
  weakened. (See the version finding above for a currently-inconsistent assertion to reconcile.)

## What this implies for the v1.9 build scope (§2–§21)

The foundation (Groups A–B, plus SSR/hydration/a11y-mechanics/testing/CLI-core) is **solid and
tested** — most of §2's primitives already exist in some form. The genuine build surface is:

- **Net-new, currently MISSING:** overlays (§5), portals (§5), transitions (§7), animations (§8),
  head/metadata + route-bound head (§11/§12). These are the largest, highest-risk items and must be
  built as `streetui`/`streetui/server` additions only (§23 — no `@streetui/*` fragmentation).
- **Upgrade-from-PARTIAL:** a first-class component/composition/children/props model (§2–§4) atop the
  existing builder DSL (without exposing `GraphNode` or cloning React); focus lifecycle
  trap/restore/containment (§6); a routed error experience (§10) over the existing `errorBoundary`;
  an ergonomic async-UI boundary (§9) over `resource()+when()`; and a real DevTools **UI** (§14–§17)
  on the headless `inspectApplication`/`createDevTools` foundation.
- **Additive-only, gated on demonstrated need (§18–§19):** testing helpers and CLI
  `doctor`/`info`/`analyze`.

Because §2–§21 is large and involves genuine API-design judgment (component model shape, overlay
mount semantics, transition integration points), the recommended next step is to agree the concrete
build scope for this release before implementing — this audit is the input to that scoping decision.

