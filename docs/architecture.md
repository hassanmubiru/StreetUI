# StreetUI Architecture

StreetUI owns its entire stack. There is no React, Vue, Preact, JSX, or virtual
DOM anywhere in it. This document explains how a StreetUI application flows from
author-written TypeScript to live DOM, and where each subsystem fits.

## The pipeline

```
Semantic TypeScript DSL
        ↓  compile()
Compiler  (validation + lowering)
        ↓
Semantic Application Graph   (nodes, props, events, state refs)
        ↓  mount()/renderToString()
Runtime   (lifecycle, signal/event integration)
        ↓
DOM Renderer   (mount · patch · keyed reconcile · SSR · hydrate)
        ↓
DOM
```

Every stage produces a single, inspectable representation. Notably there is
exactly **one** graph — the Semantic Application Graph — and DevTools, SSR,
hydration, diagnostics, and the renderer all read from that one graph rather
than building their own.

## Stages

### 1. DSL (`@streetui/dsl`)

The DSL is plain, typed TypeScript. `streetui.app({ name })` returns a builder;
`app.page(key, page => …)` and the element builders (`page.heading`,
`page.button`, `page.text`, `listOf`, `when`, …) describe structure, events, and
reactive bindings. The DSL records intent; it does not touch the DOM.

### 2. Compiler (`@streetui/compiler`)

`compile(app)` validates the DSL and lowers it into the Semantic Application
Graph. Validation emits structured diagnostics (errors and warnings) rather than
throwing on the first problem. The result is a `CompiledApplication`
(`{ name, version, compiledAt, graph, diagnostics }`).

### 3. Semantic Application Graph (`@streetui/graph`)

The graph is the single source of truth: a tree of `GraphNode`s, each carrying a
type, `props`, `events`, `stateRefs` (prop → signal bindings), an optional
`key`, and children. It is traversable (`graph.walk(...)`) and is what every
downstream consumer reads.

### 4. Runtime (`@streetui/runtime`)

The runtime mounts a compiled application, wires signal subscriptions and event
handlers, and manages lifecycle (mount/patch/unmount). It bridges the reactive
layer (`@streetui/state`) and the renderer.

### 5. Renderer (`@streetui/renderer`)

StreetUI's own renderer performs the initial mount, keyed reconciliation on
updates, server rendering (`renderToString`), and hydration (`hydrate`). It talks
to the DOM through a small adapter (`@streetui/dom`) so the same code renders in
a browser (`BrowserDOMAdapter`) or on the server (`ServerDOMAdapter`).

## Reactivity (`@streetui/state`)

Reactivity is signal-based and framework-owned:

- `signal(v)` — a writable `Signal<T>`.
- `derived(fn)` — a lazily-computed, read-only `DerivedSignal<T>`.
- `effect(fn)` — a side effect that re-runs when its dependencies change.
- `resource(fetcher)` — async data with `status`/`loading`/`data`/`error`
  signals, `refetch()`, and SSR seeding/dehydration.

Updates are coalesced by the microtask **scheduler** (`@streetui/scheduler`),
which batches synchronous writes into a single flush and orders work by
priority.

## Lifecycle

1. `compile(app)` → `CompiledApplication`.
2. `mount(compiled, container)` (browser) or `renderToString(compiled)` (server).
3. Signal writes enqueue update jobs on the scheduler.
4. The scheduler flushes; the renderer reconciles only the affected subtrees.
5. `unmount()` tears down subscriptions and DOM.

## SSR and hydration

`renderToString(compiled)` walks the graph on the server (via
`ServerDOMAdapter`) and emits HTML plus any dehydrated resource state.
`hydrate(compiled, container)` adopts the existing server DOM by positional
child matching instead of re-creating it. When a node matches, it is adopted in
place; when it does not, only that subtree is re-mounted (`mountFreshAt`) and any
surplus server nodes are removed. Hydration is **self-repairing and local** — a
mismatch never throws globally. See [Hydration Diagnostics](./observability.md).

## Router (`@streetui/router`)

The router matches the current path against declared route patterns, exposes the
match as a signal (`currentRoute`), and drives navigation and route lifecycle.
On first load it adopts server-rendered route nodes rather than remounting them.

## Resources (`@streetui/state`)

`resource()` models async data as reactive state. It tracks request generations
to ignore stale responses, supports `refetch()` and abort, and can be seeded from
SSR so the client does not re-fetch on hydration.

## CLI (`@streetui/cli`)

The CLI scaffolds projects (`create`), runs a dev server (`dev`), builds for
production (`build`), and serves the built app (`start`). It depends on the
runtime framework packages but **not** on `@streetui/devtools` — DevTools is
never a production or CLI runtime dependency.

## Cross-cutting: diagnostics & observability

Framework code reports through small, optional, privacy-safe boundaries rather
than hard-coded logging or network calls:

- `DiagnosticSink` / `frameworkError` (`@streetui/core`) — contextual errors and
  an app-provided logger seam.
- Hydration diagnostics (`@streetui/renderer`) — opt-in, dev-only mismatch
  reports.
- The scheduler can route swallowed job errors to an app sink.

None of these send anything over the network, and all are inert unless the
application opts in. See [Observability](./observability.md).

## What StreetUI is not

No virtual DOM. No second graph. No second reactive system. No second renderer.
No JSX runtime. No React/Vue/Preact compatibility layer. No streaming SSR. No
hosted telemetry. These are deliberate, enforced boundaries.
