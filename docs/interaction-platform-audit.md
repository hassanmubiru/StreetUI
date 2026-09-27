# StreetUI — Interaction Platform Capability Audit (§1)

**Scope:** transitions, animation lifecycle, accessibility primitives, keyboard
interaction, focus orchestration, live regions, component interaction state,
and DevTools interaction inspection — the surface targeted by the "Transitions,
Accessibility & Production Interaction Platform" milestone.

**Method:** read the actual source (no assumptions). Each capability is
classified **COMPLETE** (production-grade, no work needed), **PARTIAL** (exists
but insufficient for the milestone), or **MISSING** (must be built). The column
"Do not duplicate" records the existing API that must be reused rather than
re-implemented, honoring the no-fragmentation / no-second-renderer constraints.

---

## Rendering & composition substrate (reused, not rebuilt)

| Capability | Status | Evidence / API to reuse |
|---|---|---|
| Semantic node model | COMPLETE | `SemanticNodeType` (core/node.ts) already reserves `component`, `portal`, `conditional`, `reactive-list`, `slot`, `fragment`, `list-item`. No new node type is required for transitions — they attach to existing removable elements. |
| Keyed reconciler (no vdom) | COMPLETE | `reconcileChildren` / `reconcileChildrenByPlan` (renderer/reconciliation.ts): LIS minimal-move reorder, identity short-circuit, `_sig`/`_item` in-place update. **This is the exact seam** where leave-deferral hooks in. |
| Removal/dispose seam | COMPLETE (seam) | Both reconcile fns do synchronous `removeChild` + `inst.dispose()`, then the mount.ts wrappers `forgetInstance` + `graph.detachNode`. Leave transitions must defer this whole chain until the animation ends. |
| Lifecycle ownership | COMPLETE | `NodeInstance.trackCleanup(fn)` + children-first `dispose()`. Transition listeners/timers are owned here. |
| Handler registry + prune | COMPLETE | DSL registers `__signal__`/`__listbuild__`/`__listplan__`/`__overlay__`/`__component__`; `graph._unregisterNodeHandlers` prunes them. A new `__transition__<id>` descriptor follows the identical pattern and MUST be added to the prune list (§23). |
| `when()` conditional | COMPLETE | builders.ts `when` → `conditional` node holding a keyed then/else branch container. Animating a `when` = attaching a transition to the branch container it mounts/removes. |
| `listOf()` reactive list | COMPLETE | builders.ts `listOf` → `reactive-list` + `__listplan__` + per-item `list-item`. Item enter/leave attaches to the `list-item`. Keyed identity (`reactiveListItemKey`) is preserved across enter/leave. |
| Portal | COMPLETE | mount.ts `portal` branch: browser body-relocation + SSR inline + hydrate relocation. Overlay panels ride on this. |
| Router | COMPLETE | router/mount-router.ts: shell mounted once, outlet subtree disposed+remounted per navigation via `CleanupRegistry` + `runtime.unmount()`. Route transitions must NOT rewrite this — they wrap the outlet content. |
| SSR determinism | COMPLETE | `scripts/verify-ssr-hashes.mjs` + v1.6 SHA-256 digests. Transitions are browser-only, so server output must be unchanged (§21). |
| Hydration | COMPLETE | hydrate.ts positional adopt + `wireOverlayBehavior`/`wireComponentBehavior`. Transition wiring on hydrate must not double-bind (§22). |

## Overlays & focus (partial — the interaction layer to extend)

| Capability | Status | Evidence / gap |
|---|---|---|
| Overlay system | COMPLETE | `dialog`/`popover`/`tooltip`/`dropdown`/`toast` = portal + `when(open)` + `__overlay__` descriptor (builders.ts `_overlay`, OVERLAY_KINDS). |
| Overlay open/close focus | COMPLETE | mount.ts `wireOverlayBehavior`: saveFocus→focusInitial→trapFocus/containFocus/onEscape on open; teardown + restoreFocus on close. |
| **Overlay transitions** | MISSING | The panel mounts/unmounts instantly. Needs enter on open and **leave before unmount**, with focus-restore deferred to AFTER the leave (§10). |
| Focus primitives | COMPLETE | dom/focus.ts: `focusById`/`focusFirst`/`getFocusable`/`saveFocus`/`restoreFocus`/`focusInitial`/`trapFocus`/`containFocus`/`onEscape` — all adapter-based, SSR no-ops. |
| Dialog keyboard (Esc/Tab/Shift-Tab/contain) | COMPLETE | `trapFocus`+`containFocus`+`onEscape` cover §12. Nested-overlay focus-owner correctness needs a regression test (§12) but the mechanism exists. |
| **Menu/dropdown keyboard (Arrow/Home/End/Enter/Space)** | MISSING | `dropdown` sets `role="menu"` and moves focus in, but there is NO arrow-key roving/typeahead. Needs a `menuKeyboard` util wired only for the menu role (§13). |
| **Tooltip hover/focus/dismiss** | PARTIAL | `tooltip` overlay exists (role, no focus steal) but visibility is entirely caller-driven; no hover/focus-in/Escape-dismiss helper. §14 wants an interaction helper, touch/SSR/hydration-safe. |
| **Live regions (polite/assertive)** | PARTIAL | `toast` emits `aria-live="polite"` on its panel; `A11yOptions.ariaLive` supports `off/polite/assertive`. But there is NO imperative `announce()` that manages a shared region and clears stale nodes (§15). |
| **Internal focus-owner concept** | MISSING | Nested overlays each independently trap/contain; there is no explicit "current focus owner" stack. §16 asks for this only IF needed to prevent corruption — to be validated by a nested-dialog test before adding bookkeeping. |

## Accessibility ids & interaction state

| Capability | Status | Evidence / gap |
|---|---|---|
| Deterministic a11y ids | PARTIAL | core/a11y-ids.ts `a11yIds(base)` → `input/label/description/error/title` + `id(suffix)`. §17 wants `controls`/`owns` relationship ids and a convenience aria-attribute bag. Additive extension. |
| ARIA relationship options | PARTIAL | dsl `A11yOptions` has `ariaLabelledBy`/`ariaDescribedBy`/`ariaControls`. Missing `ariaOwns`/`ariaActiveDescendant`/`ariaHasPopup` used by menus/comboboxes (§17). |
| Interaction state (open/focused/…) | MISSING (as framework state) | Apps model open/selected via their own `signal`s (correct — §18 prefers signal/derived). No framework-managed transient interaction state is retained on nodes. §18 = document this + keep any new transient state internal. |

## DevTools & testing

| Capability | Status | Evidence / gap |
|---|---|---|
| Component inspection | COMPLETE | devtools/inspector.ts `inspectComponents(graph)` (id/key/name/depth/childCount), reads only `data-streetui-component`. |
| Application inspection | COMPLETE | devtools/application.ts `inspectApplication` (identity/graph/nodeStats/signals/pages/perf). Reads handler keys for `__listplan__` counts — same pattern to count overlays/transitions. |
| **Interaction inspection (focused?/open?/overlay kind/transition state)** | MISSING | No view surfaces overlay/transition/focus state. §19 = add a prod-safe, DOM-non-retaining `inspectInteractions(graph)` reading public attrs + descriptors. |
| Testing helpers (render/find/waitFor) | COMPLETE | streetui/testing: `renderComponent`/`hydrateComponent`/`findComponent`/`trigger` (+ prior render/findByRole/waitFor/flushUpdates). |
| **Interaction testing helpers (focus/blur/pressKey/clickOutside/openOverlay/waitForTransition)** | MISSING | §20 — add only high-value helpers on top of existing `trigger`/`waitFor`. |

## Transitions & animation (the headline — all MISSING)

| Capability | Status | Notes |
|---|---|---|
| Transition primitive | MISSING | No `transition` option anywhere. Engine decision (confirmed): **CSS class-based** (enter/enter-from/enter-active/enter-to + leave-*), no WAAPI dependency, SSR-deterministic. |
| Transition lifecycle | MISSING | mount→enter→active→leave→unmount→cleanup; node must NOT be disposed before leave completes (§3). |
| Cancellation matrix | MISSING | enter→leave, leave→enter, enter→unmount, leave→unmount — no stale callbacks / dup cleanup / orphan DOM / dup listeners (§6). |
| List / component / router / overlay transitions | MISSING | All ride the same primitive via the reconciler leave-deferral + overlay `when` (§7–§10). |

---

## Design consequences (drive §2–§30)

1. **Engine:** CSS class-based controller, browser-only. Wired only when
   `dom.body() !== null` (the exact SSR-guard `wireOverlayBehavior` already
   uses). happy-dom fires no `transitionend`, so the controller carries a
   fallback timeout to stay deterministic under the test DOM (§24 — no browser).
2. **Descriptor:** DSL registers `__transition__<nodeId>` (resolved class sets +
   flags). Transition *runtime* state lives in the controller/hooks, **not** in
   the reactive graph (§2). Add `__transition__<id>` to
   `graph._unregisterNodeHandlers` (§23).
3. **Leave seam:** `reconcileChildren`/`reconcileChildrenByPlan` gain an optional
   `TransitionHooks` ({ `takeLeaving`, `beginLeave`, `onEnter` }); when a removed
   instance has a transition and we are in the browser, `beginLeave` defers the
   DOM-remove + dispose + forget + detach chain to animation end. A re-entering
   key is reclaimed via `takeLeaving` (leave→enter cancellation).
4. **Overlays:** the panel's `when(open)` already mounts/unmounts through the
   reconciler, so overlay transitions come "for free" once the branch container
   carries a transition; focus-restore is moved to fire AFTER the leave (§10).
5. **Additive only:** every new export lands in existing packages
   (`dsl`/`dom`/`renderer`/`devtools`/`core`) which are re-exported by the single
   `streetui` barrel; the frozen v1.0 surface is untouched; stability tests only
   assert presence (§25/§27).

**Classification totals:** COMPLETE 17 · PARTIAL 5 · MISSING 10.
The MISSING/PARTIAL set is exactly the milestone's work; nothing in it duplicates
an existing API — each item extends or hooks a substrate that already exists.
