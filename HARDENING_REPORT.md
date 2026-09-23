# StreetUI v0.1 — Hardening Report

Scope: harden the existing framework in place. No rebuild, no monorepo
restructuring, no React/Vue/Preact/virtual DOM, no dependency version changes.
The existing DSL → Compiler → Semantic Application Graph → Runtime → Renderer →
real-DOM pipeline and the existing keyed reconciler are preserved.

## Files changed

- `packages/dsl/src/builders.ts` — reactive-list item keying.
- `packages/renderer/src/reconciliation.ts` — in-place content update for reused items.
- `packages/graph/src/graph.ts` — handler-registry cleanup on detach + inspection API.
- `packages/renderer/src/renderer.test.ts` — +7 regression tests.

## Behavior changes (reactive-list reconciliation)

The reconciliation key for a `listOf` item is now **identity-only**
(`id` → `key` → index → primitive value) via `reactiveListItemKey`. The item's
value signature (`JSON.stringify`) is stored separately as an internal `_sig`
prop via `reactiveListItemSignature`.

Consequences:
- Stable identity → stable DOM element. Reordering `A B C → C A B` with stable
  ids reuses the exact same DOM elements (no replacement).
- Changed item data with unchanged identity (`{id:1,name:"Alice"}` →
  `{id:1,name:"Amina"}`) no longer forces a DOM swap. The reused item keeps its
  `<li>`; only its changed content is patched in place.

The in-place update is done by `reconcileItemChildren`, a positional patch over
the item's subtree: same-type child at a position is reused and its props are
patched (e.g. a text node is rewritten) and then recursed into; a
type-mismatch/new position mounts the fresh child (reparented onto the live item
node so the wholesale detach of the un-adopted freshly-built node doesn't remove
it); surplus old children are disposed. This reuses the existing keyed/positional
strategy — there is no virtual DOM and the list is never destroyed and recreated
wholesale.

## Cleanup changes (handler / instance cleanup)

`ApplicationGraph.detachNode` now transitively prunes the handler registry for
the entire detached subtree. `_removeFromIndex` recurses and calls
`_unregisterNodeHandlers`, which deletes, per node: each event `handlerKey`
(e.g. `click:<id>`), each `__signal__<signalId>` (signalIds are namespaced by
node id, never shared), and `__listbuild__<id>` for reactive lists.

This fixes the prior leak where removed list items — and the
freshly-built-but-unadopted duplicate item subtrees produced on every rebuild —
left stale handler entries in `graph.handlers`.

Encapsulation was not weakened: a public inspection API was added alongside the
existing `getHandler` — `hasHandler(key): boolean` and the `handlerCount` getter
— and the regression tests use those instead of reaching into internals.

## Tests (222 → 229)

- Renderer package: 35 → 42 (+7): keyed-reorder DOM-identity assertions
  (`newC === oldC`, etc.), changed-data-same-DOM (item `<li>` and its `<span>`
  reused, sibling untouched), changed-data + simultaneous reorder, and 4
  graph-handler-registry cleanup tests (count grows to N on populate, shrinks to
  0 on removal with no stale/duplicate entries, stays bounded across
  reorders/data changes, and post-unmount signal updates are safe no-ops).
- Total individual tests: 222 → 229, confirmed by summing per package:
  compiler 9, core 28, devtools 10, dom 15, dsl 17, events 15, graph 26,
  renderer 42, runtime 5, scheduler 12, state 25, testing 13, basic-app 12.
- No existing tests were removed or weakened.

## Verification (executed via existing turbo tooling)

- Build: `turbo run build` → **15 successful, 15 total**.
- Typecheck: `turbo run typecheck` → **26 successful, 26 total**.
- Full test suite: `turbo run test` → **26 successful, 26 total** (229 individual tests pass).

No `any` was introduced to bypass type errors; typecheck is clean under the
existing strict config.

## Remaining limitations (genuine)

- Reactive-list items that are plain objects with no `id`/`key` fall back to
  **index identity**, so reordering that class of items still reuses elements by
  position rather than by identity — a data change at an index updates in place,
  but a true reorder cannot preserve element identity without a stable key.
- The in-item subtree update is **positional**, not a deep structural diff: a
  structural change at a given position remounts that position rather than
  computing a minimal edit. Content/prop changes (text, attributes) patch in
  place; shape changes remount locally.
- Build tooling note: the mounted workspace filesystem forbids unlinks (breaks
  tsup) and pnpm is unavailable in-VM, so verification runs against a deletable
  mirror with a pnpm shim. This is an environment constraint, not a repo change;
  no source, dependency, or config versions were altered.
