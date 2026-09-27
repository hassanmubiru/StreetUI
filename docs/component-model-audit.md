# StreetUI Component & Composition Model — Audit (§2)

**Purpose.** Before designing or implementing any component abstraction, inspect how the
existing StreetUI applications actually compose reusable UI, and identify the *real*
pain points that a first-class component model would remove. Per the mission's §2
directive: "Do not invent problems that real applications do not have."

**Method.** Read the source of the three shipped example apps
(`examples/streetui-performance-app`, `examples/streetui-account` = `@streetui/example-account`,
`examples/streetui-full-app`, `examples/streetui-showcase`) and traced the composition
mechanics down through the pipeline (`packages/dsl`, `packages/graph`, `packages/core`,
`packages/renderer`, `packages/context`, `packages/state`, `packages/forms`,
`packages/i18n`, `packages/router`, `packages/testing`, `packages/devtools`).

This document reports **findings and candidate seams only**. It does not commit to a
design — that follows in §3 after scope confirmation.

---

## 1. How reusable UI is composed today

There is **no component primitive in use anywhere**. A grep across all example apps for
`component(` / `createComponent` / `portal` / `overlay` / `dialog` returns only a comment.
Every reusable unit is a **plain function that receives a builder scope**, following one
of two positional shapes:

- **Page/section builders** take the DSL scope plus a shared dependency bag:
  `function buildUsers(page: PageDSL, deps: AppDeps): void` and, when they own a resource,
  a route context: `function buildUserDetail(page, deps, ctx: RouteContext)`
  (`streetui-performance-app/src/views.ts:13,24,48,90,109,144`).
- **Field/layout helpers** take a `ContainerDSL` plus positional args:
  `textField(scope, fieldName, labelKey, type)` and `pageLayout(scope, opts, body)`
  (`streetui-account/src/account-app.ts:135,186`).

The builder callback pattern the whole framework rests on: every container method
(`section`/`container`/`list`/`listOf`/`when`/`form`/`errorBoundary`/`portal`) calls
`graph.createNode(type, {key, parent, props})` and then **synchronously** invokes the
child builder with a freshly constructed `*BuilderImpl` wrapping the new node
(`packages/dsl/src/builders.ts:355-362`). The entire graph is materialized during these
synchronous calls, at build time, before compile/mount. A "reusable unit" today is simply
a function that participates in that synchronous descent — it has no identity, no
lifecycle, and no state of its own.

---

## 2. Local state

State is almost never created inside a reusable unit. Instead it is **hoisted** to one of
two places:

- **A `createDeps()` factory** at module scope, threaded through as a positional argument.
  Both the performance app and the full app push *all* signals, deriveds, resources, forms
  and i18n into `createDeps()` and pass the whole `AppDeps` object into every builder
  (`streetui-performance-app/src/deps.ts:158-266`, consumed at `views.ts:49`;
  `streetui-full-app/src/deps.ts:68-100`, consumed at `app.ts:14`). Even 1,000 per-control
  signals are pre-allocated in an array and indexed positionally inside the builder
  (`deps.ts:193`, `views.ts:96`).
- **The route builder body**, when state is route-scoped. The account app creates
  `createForm(...)`, `resource(...)` and a `derived` directly inside the `/signup` builder
  (`account-app.ts:219,241,245`).

The showcase app is the degenerate case: raw signals and deriveds at the top of one
factory closure, shared purely by closure capture, with an imperative `actions` object
(`showcase-app.ts:61-128`).

Mechanically this matches how the framework binds state: `bindValue`
(`builders.ts:73-86`) registers a `__signal__<nodeId>:<propKey>` handler at build time and
returns the peeked value; mount only *subscribes*. Signals are created at build time, not
mount time. `errorBoundary` (`builders.ts:510-573`) is the one existing precedent for a
builder method that **creates its own local signals** (`signal()`/`derived()` inside the
callback) — it is the closest thing to a "setup that owns state" in the codebase.

---

## 3. Cleanup / lifecycle

**Reusable units cannot own their own cleanup.** Teardown happens only at *route* or
*app* granularity:

- A unit that owns a resource must accept a `RouteContext` purely to dispose it:
  `buildUserDetail` takes `ctx` solely for `ctx.onCleanup(() => userDetail.dispose())`
  (`views.ts:144,149`); the account route wires `ctx.onCleanup(form.dispose)` and
  `resource(..., { onCleanup: ctx.onCleanup })` (`account-app.ts:238,241-243`).
- Helpers with no `ctx` leak by construction: `textField` creates a `derived` (`showError`,
  `account-app.ts:149`) it has no way to dispose. Every inline `derived(...)` in the
  performance builders is likewise undisposable.
- Top-level teardown is hand-maintained and fragile. The performance app manually lists
  `mounted.unmount(); router.destroy(); deps.userDetail.dispose(); deps.settingsForm.dispose()`
  (`routed.ts:80-82`). The full app forgets entirely — it has **no** disposals and
  re-creates a whole deps graph on every navigation to `/`
  (`full-app/routed.ts:14 builder: (page) => buildApp(page, createDeps({...}))`).

The renderer *does* have the right anchor for per-unit cleanup — it just isn't exposed to
builders. `NodeInstance` (`packages/renderer/src/node-instance.ts`) has
`trackCleanup(fn)` + a `CleanupRegistry`, and `dispose()` recurses children then runs own
cleanups. It is used for signal-binding unsubscribes, reactive-list subscriptions,
portal-container removal and overlay teardown — but it is created *privately inside*
`mountNode`, with no builder-facing hook.

---

## 4. Props

Props are **positional and untyped per unit**. A unit receives either the entire deps
object (`buildUsers(page, deps)` — uses two fields, gets all of `AppDeps`) or a positional
list (`textField(scope, fieldName, labelKey, type)`). There is no per-unit typed props
contract, no required/optional/default distinction, and no notion of a "reactive prop"
distinct from a plain value.

To avoid prop-drilling into a deeply nested helper, the account app hand-rolls a context:
`FormContext = createContext<FormScope|null>(null, ...)` (`account-app.ts:111`), provided
inline around three field calls (`:251`), with the helper forced to null-check and throw
at runtime (`:144`) because the context has no non-null default. This is boilerplate that
a real props contract would eliminate.

---

## 5. Children / slots

There is **no first-class slot mechanism.** "Slots" are ad-hoc:

- The only genuine slot helper is `pageLayout`, which invents a
  `body: (content: ContainerDSL) => void` parameter and calls it inside its own container
  (`account-app.ts:186-199`).
- Everywhere else, composition rides on the built-in DSL callbacks the framework already
  supplies: `section(id, s => …)`, `when(sig, b => …)`, `listOf(id, sig, (row,i,c) => …)`,
  and `errorBoundary`'s `fallback: (fb, err, retry) => …` (`views.ts:161-164`).

No example declares a reusable unit that accepts *named* regions. The hydration layer
already has a related primitive — a node with prop `_hydrationBoundary === true` is adopted
but its children are left untouched (`hydrate.ts:184-186`), which the router uses for its
outlet (`mount-router.ts:99-101`). That is the existing "a region something else fills"
mechanism and is directly relevant to a `slot` concept.

---

## 6. Router composition

Routes are plain data: an array of `{ path, builder }` where each builder is a thin adapter
closing over `deps` (`streetui-performance-app/src/routed.ts:28-37`). The persistent shell
is a separate builder ending in `routerOutlet(shell)` (`shell.ts:36`). Each route is
compiled as **its own `streetui.app()`** and mounted into the outlet
(`mount-router.ts:150-153`); a per-route `CleanupRegistry` (`RouteContext.onCleanup`) runs
on navigation (`mount-router.ts:129-136,147`). There is no special renderer path for
routes — they are ordinary compiled apps. A component used inside a route is therefore
disposed automatically when the route's `unmount()` runs. **No router rewrite is needed**
(§16 satisfied by construction).

---

## 7. Portals / overlays

The v1.9 platform (`dialog`/`popover`/`tooltip`/`dropdown`/`toast` + `portal`) exists in
the framework but **is not yet used by any example app**. The examples' "modals" are
`when`-mounted inline sections with manual open/close signals:
`s.when(modalOpen, m => m.section('modal', …))` with `modalOpen.set(true/false)` handlers
(`views.ts:132-139`) — no portal, no focus handling, no Escape/backdrop. This is precisely
the friction the v1.9 overlay platform removes, and a component model must integrate with
it (§15) rather than reintroduce inline-modal patterns.

---

## 8. Forms / resources / context / i18n wiring

`createForm`, `resource`, `createI18n` and `createContext` are all created *outside* the
reusable presentational unit that renders them — in a `createDeps()` factory (perf/full)
or inside a route builder (account). None is ever created *inside* a reusable field/list
unit, because such a unit has no lifecycle to cancel it. Consequences visible in code:

- The account plans `resource` cancels only because the *route's* `ctx.onCleanup` is handed
  to it (`account-app.ts:243`); the `textField` unit that renders a form field cannot say
  "I own this field's derived and it disposes when I unmount."
- Context is read at build time (`ThemeContext.consume()` at `shell.ts:12`,
  `app.ts:15`) and provided around the whole mount
  (`ThemeContext.provide(theme, () => mountRouter(...))`, `routed.ts:64`). This works
  because `provide()` is a synchronous push/run/pop stack active only for the duration of
  the synchronous `run()` (`packages/context/src/context.ts:45-59`) — the same synchronous
  descent a component's setup would run in.

Each system already exposes the right lifecycle hook for a component to adopt:
`resource(loader, { onCleanup })` (`resource.ts:50`), `form.dispose()` (`form.ts:237`),
`effect()` returns an unsubscribe, `DerivedSignal.dispose()`. What is missing is an *owner*
at the reusable-unit level to route these disposals into.

---

## 9. Duplication across mount paths

Because a builder tied to `PageDSL`/`routerOutlet` can't be reused in the flat single-page
compile path, the performance app's header/nav/sidebar chrome is written **twice** —
verbatim — once as the router shell (`shell.ts:14-33`) and once as `buildComposedPage` for
the SSR single-page compile (`index.ts:35-54`). A unit with a stable identity and a scope
that isn't bound to a specific mount path would be reusable across both.

---

## 10. Pipeline mechanics relevant to a component seam

Key facts that constrain any design (evidence in `packages/*`):

- **`'component'`, `'slot'` and `'fragment'` are already reserved `SemanticNodeType`
  members** (`core/src/node.ts:22-24`), already mapped to `<div>` in the renderer tag map
  (`renderer/src/tag-map.ts:21`), but **never created anywhere**. They are inert union
  members reserved for exactly this work; the capability audit
  (`docs/framework-capability-audit.md:27,73-80,359`) confirms Components = MISSING with
  "`'component'` node type reserved but never created."
- **Node ids are not stable identity.** `GraphNode.id` is a build-order monotonic counter
  (`core/src/identity.ts:6`) reset per render (`resetIdCounter`, used by SSR/hydrate for
  determinism). Reconciled regions (`listOf`/`when`) **re-run their item/branch builders**
  to produce fresh detached nodes with new ids on every change
  (`builders.ts:395-414,482-490`). The reconciler keys by `node.key ?? node.id`
  (`reconciliation.ts:71,79`). ⇒ Component identity must be a persisted **key**, not
  `node.id`, and a component inside a list/branch will have its setup **re-invoked on every
  rebuild** — setup must be idempotent/memoized per key or it leaks signals/effects.
- **`NodeInstance` is the cleanup anchor but is created privately inside `mountNode`**
  (no external hook today). `dispose()` runs children first, then own cleanups
  (`node-instance.ts:39-43`). `wireOverlayBehavior` (`mount.ts:587-635`) is the template
  for reading a per-node descriptor from the handler registry at mount and calling
  `instance.trackCleanup(...)`.
- **Handler-registry convention.** Reactive wiring is registered by the DSL under
  `__signal__` / `__listbuild__` / `__listplan__` / `__overlay__` keys namespaced by node
  id, read by the renderer with local structural types, and **pruned on detach** by
  `graph._unregisterNodeHandlers` (`graph.ts:82-92`). Any new component-cleanup convention
  (e.g. `__component__<id>`) must be added to that prune list or it will leak on detach.
- **SSR is byte-identical through the same mount+serialize pipeline;** `renderToString`
  disposes the root immediately after serialize (`ssr.ts:78`). The **static SSR plan**
  collapses a static subtree (no stateRefs/events/list/conditional/portal) into verbatim
  raw HTML with a *single* NodeInstance for the whole blob (`analyze.ts:93`,
  `mount.ts:69-77`). ⇒ A component that must always run per-instance wiring has to be
  **excluded from static rollup exactly as `portal` is** (`analyze.ts:92`), or it will be
  absorbed and lose per-instance granularity. And setup effects/resources run on the server
  at build time and are torn down at once — setup must be SSR-safe.
- **Hydration is positional: one node = one element** (`hydrate.ts:10-13`). A `<div>`-wrapper
  component adopts positionally with no changes; a wrapper-*free* (transparent) component
  would break this invariant and is the high-risk path.
- **Testing** already has the base: `render(app)` + query helpers + `unmount()`
  (`test-renderer.ts:45`), and `renderServerThenHydrate` for the SSR seam
  (`helpers.ts:199`). A `renderComponent` helper wraps `render()` of a one-page host app.
- **DevTools** `inspectGraph` is type-agnostic (`inspector.ts:20`); a `component` node
  already flows through as its own tree entry, but a *visible* stable name needs a
  non-underscore prop (`printGraph` hides `_`-prefixed props, `inspector.ts:43`).

---

## 11. Candidate seams (evidence-backed, no design commitment)

The cleanest low-risk seam that satisfies every mission requirement without a second
renderer or reactive system:

1. **Add `component(key, setup, options)` on `ContainerBuilderBase`** that calls
   `graph.createNode('component', {…})` and invokes `setup` synchronously with a builder
   scope — structurally identical to `container`/`errorBoundary`. The reserved node type +
   `<div>` tag map + hydrate/inspector `default` branches accept it **with no renderer
   changes** (wrapper-`<div>` approach).
2. **Own local state at build time inside `setup`** (like `errorBoundary`'s `signal()`),
   exposing a props contract (TypeScript-first, per §5) and an `onCleanup(fn)` collector
   that `resource({onCleanup})` / `form.dispose` / effect-unsubscribes feed into.
3. **Route cleanups into `NodeInstance.dispose`** via a new `__component__<id>` handler
   (mirroring `__overlay__`) + a small `component` branch in mount/hydrate that reads it and
   calls `instance.trackCleanup(...)`; add the key to `_unregisterNodeHandlers` prune list.
4. **Stable identity = persisted `key`** (+ an inspectable id prop), because `node.id`
   churns on rebuild.
5. **Exclude `'component'` from static SSR rollup** (like `portal`) *iff* per-instance
   wiring is mandatory, to preserve setup/cleanup granularity while keeping byte-identity.
6. **Integrate the ecosystem for free**: setup receives a normal `ContainerDSL`, so it can
   call `.portal/.dialog/.when/.form/.errorBoundary` and construct
   `resource()/createForm()/createI18n()/Context.provide()` directly, routing disposals into
   `onCleanup`.

### Traps to carry into design
- Setup re-runs on every list/branch rebuild ⇒ idempotent/memoized-per-key.
- `dispose()` runs children before own cleanup ⇒ verify teardown ordering.
- SSR runs + disposes setup at build time ⇒ SSR-safe/side-effect-free setup.
- Wrapper-free (transparent) components break positional hydration ⇒ default to the
  `<div>` wrapper; treat transparent as a separate, higher-risk decision.
- Synchronous throws in setup need the `queueMicrotask` deferral discipline
  `errorBoundary` uses (`builders.ts:565`) — or component bodies wrapped in an errorBoundary.

---

## 12. Real pain points a component model should solve (ranked, all evidenced)

1. **Reusable units cannot own lifecycle/cleanup** — the single biggest problem. Units that
   create reactive state can only be cleaned up by the enclosing *route* via an injected
   `ctx`; helpers without one (`textField`) leak, and one example disposes nothing at all.
2. **State must be hoisted into a shared deps bag / module scope** because plain builder
   functions can't hold state that survives and cleans up correctly.
3. **Props are positional and untyped per unit** — no required/optional/default/reactive
   contract; units receive the whole deps object.
4. **Dependency injection into nested units requires hand-rolled context + null-guards**
   (the `FormContext<...|null>` throw pattern).
5. **No first-class children/slots** — only ad-hoc `body` callbacks and built-in DSL
   callbacks.
6. **No reuse across mount paths → copy-pasted chrome** (shell vs SSR compose).
7. **Overlays/modals have no ergonomic entry** in real code — inline `when`-sections with
   manual signals, no focus/Escape (now addressable via the v1.9 overlay platform).
8. **Manual, error-prone top-level teardown** that silently rots as features are added.

These are the problems to design against in §3 — and nothing beyond them. Notably, the
existing builder DSL, reactivity, SSR, hydration, router, forms, resources, i18n and
overlays are all sound and must be **reused, not replaced** (§8/§24/§30).

