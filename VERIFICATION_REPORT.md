# StreetUI v0.1 — Verification & Hardening Report

_Generated 2026-09-23. Every figure below was produced by running the repo's own tooling in this session, not carried over from a prior report._

## 1. How this was verified

The repo has no usable `pnpm` in this environment (corepack fails with an EACCES symlink error; `npm i pnpm` returns registry 403), and the delivered folder rejects file deletion (which breaks `tsup`'s DTS temp-file cleanup with EPERM). Verification therefore ran against a deletable copy of the repository using the workspace's own pinned binaries (`turbo`, `tsc`, `tsup`, `vitest` from `node_modules/.bin`) plus a small `pnpm run` shim so `turbo` scripts resolve. All source edits were applied to the delivered tree and mirrored into the build copy before each run. No dependency versions were changed.

Commands run: `turbo run build`, `turbo run typecheck`, `turbo run test`.

## 2. Structure and dependency facts

| Metric | Value |
|---|---|
| Workspace units | 15 (12 `packages/*`, 2 `apps/*` — docs + playground, 1 `examples/*` — basic-app) |
| Non-test source `.ts` files | 51 |
| Test files (`*.test.ts`) | 13 |
| External runtime/dev dependencies (whole repo) | `happy-dom`, `tsup`, `typescript`, `vitest` only |

There is **no React, Vue, Preact, Svelte, Solid, virtual-dom, snabbdom, inferno, or lit** anywhere in the workspace — confirmed by scanning every non-`node_modules` `package.json` and every `src/**/*.ts` import. `happy-dom` is present solely as the Vitest DOM environment; it is not a rendering engine. The renderer talks to the real DOM through `BrowserDOMAdapter`, which delegates directly to `document.createElement`, `appendChild`, `insertBefore`, `addEventListener`, etc.

## 3. Test-count discrepancy resolved

The two numbers in the earlier report measured different things and are both correct:

- **Turbo tasks:** `turbo run test` executes **26 tasks** — 15 `test` tasks plus 11 upstream `build` tasks pulled in by `test dependsOn ^build`. `turbo run build` alone is 15 tasks; `turbo run typecheck` is 26. The "26" figure is a *task* count, never a test count.
- **Individual tests:** **222** test cases across the suite — **210** in the 12 library packages plus **12** in `examples/basic-app`. `apps/playground` and `apps/docs` contribute 0 (stub/`no tests` scripts).

Per-package test cases: scheduler 12, core 28, state 25, events 15, dom 15, graph 26, dsl 17, compiler 9, runtime 5, devtools 10, renderer 35, testing 13 (= 210); basic-app 12.

## 4. Build / typecheck / test results

| Pipeline | Result |
|---|---|
| `turbo run build` | 15 / 15 tasks successful |
| `turbo run typecheck` | 26 / 26 tasks successful |
| `turbo run test` | 26 / 26 tasks successful — 222 / 222 individual tests passing |
## 5. The one real bug — and its fix

The live repository **did not build or typecheck** on arrival. `packages/dsl` failed with `TS2420: Class 'ContainerBuilderBase' incorrectly implements interface 'ContainerDSL'. Property 'listOf' is missing`. The `listOf<T>(key, items, renderItem, options)` reactive-list method had been *declared* on the `ContainerDSL` interface but never *implemented* on the builder, so the whole `dsl` package (and everything downstream) failed compilation.

This was fixed by implementing `listOf` — not by deleting the declaration. No other behavioural bugs were found; no style-only changes were made.

## 6. Renderer pipeline — verified real, no virtual DOM

The full path DSL → compiler → graph → runtime → renderer → real DOM is exercised by tests that build an app with the DSL, `compile()` it, mount through `createRenderer` (`BrowserDOMAdapter`), mutate signals, and assert against real DOM nodes and element identity. Reactive scalar bindings (text, heading, button `disabled`, input `value`) patch targeted DOM nodes in place; there is no tree diffing and no vdom. `renderer` package tests: 35 (26 pre-existing + 9 added for reactive lists).

## 7. Reactive list reconciliation (task 6) — implemented end-to-end

`listOf` now builds a `reactive-list` graph node, registers its driving `Signal<T[]>` as a state ref, and renders the initial item subtrees into the graph. On mount the renderer subscribes to that signal; on every change it calls a DSL-registered factory to build the freshly-rendered desired children and feeds them to the **existing keyed reconciler** (`reconcileChildren`) against the live DOM. The reconciler was kept intact — no virtual DOM was introduced.

Because `listOf`'s signature has no explicit key extractor, each item's reconciliation key combines an **identity** part (`item.id` ?? `item.key` ?? array index) with a **value signature** (`JSON.stringify`). This makes reorders of identified/primitive items reuse the same DOM elements, while an item whose data actually changed gets a new key and is re-rendered (correct, given the reconciler patches only top-level props).

Added tests (renderer) cover: initial render, add, remove, clear-to-empty + repopulate, reorder with same-element reuse (keyed identity), value-change replacement, keyed reuse across reorder, subscription cleanup on unmount, and removed-item event-listener teardown.

## 8. Batching (task 5) — verified, not duplicated

`batch()` in `@streetui/state` performs synchronous, transactional coalescing: repeated `set()`s to the same signal inside a batch collapse to one notification with the final value, multiple signals each flush once on the outermost batch exit, nested batches flush only at the outer boundary, and no-op sets never fire. Covered by 5 dedicated tests (state package, 25 tests total). This is a synchronous transaction boundary and is deliberately **distinct from** the async priority `@streetui/scheduler`; it does not create a second async scheduling system.

## 9. Cleanup / unmount (task 7)

Teardown is centralized in `CleanupRegistry` (idempotent — `run()` executes then clears, so double-dispose is safe). `NodeInstance.dispose()` recurses through children and runs their cleanup, unsubscribing signal bindings and removing DOM listeners; `Runtime.unmount()` additionally runs its own cleanup and calls the render handle's `unmount()`, which disposes the instance tree and empties the container. Reactive-list item removals dispose the removed instances (DOM node removed, subscriptions and listeners torn down) and drop their nodes from both the renderer instance map and the graph index. Regression tests confirm: unmount empties the container, a post-unmount `signal.set` is a safe no-op, and a removed list item's click handler can no longer fire.

## 10. SSR (task 8) — intentionally not implemented

No server-side rendering was added. The `DOMAdapter` interface remains the single seam between the renderer and the environment (`BrowserDOMAdapter` is the only implementation), so a future server adapter can slot in without touching the renderer.

## 11. Known limitations

- Reactive-list items that are **plain objects without an `id`/`key`** fall back to index-based identity, so reordering such items does not reuse DOM nodes (identified or primitive items do).
- The keyed reconciler is shallow: it matches and patches at the list-item level. Content correctness on data changes is achieved by the value-aware key (re-render on change) rather than deep child patching.
- When a reactive-list item is removed, its DOM nodes, signal subscriptions and event listeners are cleaned up, but any per-child signal *handler entries* registered in `graph.handlers` are not pruned from that registry (a small, bounded registry-only retention; no DOM or subscription leak).
- No `pnpm` and a delete-restricted delivery filesystem in this environment; see section 1 for the build method used.

