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
| **Overlay transitions** | COMPLETE (shipped §10) | Panel `when(open)` branch carries the transition; enter plays on open, leave plays before unmount via the reconciler's deferred-leave, and focus is restored at close-*request* time so a departing panel never keeps focus. |
| Focus primitives | COMPLETE | dom/focus.ts: `focusById`/`focusFirst`/`getFocusable`/`saveFocus`/`restoreFocus`/`focusInitial`/`trapFocus`/`containFocus`/`onEscape`/`rovingMenu` — all adapter-based, SSR no-ops. |
| Dialog keyboard (Esc/Tab/Shift-Tab/contain) | COMPLETE | `trapFocus`+`containFocus`+`onEscape` cover §12; `getFocusable` re-checks the selector so disabled controls are excluded live; nested dialogs each wire their own listeners on their own panel (innermost handles the event first). |
| **Menu/dropdown keyboard (Arrow/Home/End/Enter/Space)** | COMPLETE (shipped §13) | `rovingMenu` (dom/focus.ts): ArrowUp/Down roving with wrap, Home/End, Enter/Space activation; re-queries items each key (live/disabled-safe). Wired only for the menu role via `OVERLAY_KINDS.dropdown.menu = true` → descriptor `menu` → `wireOverlayBehavior`. |
| **Tooltip hover/focus/dismiss** | COMPLETE (by design, cooperative) | `tooltip` overlay (role=tooltip, never steals focus, no Escape trap). Visibility is caller-driven via the `open` signal wired to the anchor's hover/focus handlers — deliberately NOT a global document listener (§14), so it is touch/SSR/hydration-safe and composes with the app's own state. |
| **Live regions (polite/assertive)** | COMPLETE (shipped §15) | `createAnnouncer(dom)` (dom/live-region.ts): exactly one persistent polite + one assertive region on `<body>`, text mutated to speak (clear-then-set on a microtask so repeats re-announce), reused not accumulated (no stale nodes), `clear()`/`destroy()`. SSR-inert (no region markup). `toast` still emits `aria-live` on its own panel. |
| **Internal focus-owner concept** | COMPLETE (shipped §16, minimal) | Overlay panels relocate to body-level portals (siblings), so two overlapping `containFocus` handlers would fight over every `focusin`. `containFocus` now maintains a module-level containment stack and only the TOP container (the most recently opened modal) enforces containment; cleanup pops it so the previous modal resumes ownership. Internal, torn down on cleanup, nothing retained on the graph (§18). Backed by a nested-dialog regression test. |

## Accessibility ids & interaction state

| Capability | Status | Evidence / gap |
|---|---|---|
| Deterministic a11y ids | COMPLETE (extended §17) | core/a11y-ids.ts `a11yIds(base)` → `input/label/description/error/title` **plus `trigger`/`controls`/`owns`** relationship ids + `id(suffix)`. Pure derivation (no counter/randomness) so ids are byte-identical on server and client. |
| ARIA relationship options | COMPLETE | dsl `A11yOptions` carries `ariaLabelledBy`/`ariaDescribedBy`/`ariaControls`; `a11yIds` supplies the matching id tokens (`label`→labelledby, `description`→describedby, `controls`, `owns`). Menus additionally expose `role="menu"` + roving focus. |
| Interaction state (open/focused/…) | RESOLVED — app-owned (§18) | Apps model open/selected/expanded via their own `signal`/`derived` (the framework's fine-grained reactivity), which is exactly what §18 prescribes. No transient interaction state is retained on graph nodes; the only new runtime state (transition run bookkeeping, overlay listener sets, announcer regions) lives in controllers/closures and is torn down on cleanup. |

## DevTools & testing

| Capability | Status | Evidence / gap |
|---|---|---|
| Component inspection | COMPLETE | devtools/inspector.ts `inspectComponents(graph)` (id/key/name/depth/childCount), reads only `data-streetui-component`. |
| Application inspection | COMPLETE | devtools/application.ts `inspectApplication` (identity/graph/nodeStats/signals/pages/perf). Reads handler keys for `__listplan__` counts — same pattern to count overlays/transitions. |
| **Interaction inspection (focused?/open?/overlay kind/transition state)** | COMPLETE (shipped §19) | `inspectInteractions(graph)` (devtools/inspector.ts): walks the graph and reads only the `__overlay__<id>` / `__transition__<id>` handler descriptors + public node structure. Reports overlays (id/key/open-peeked/modal/takesFocus/menu/closeOnEscape/restoreFocus/depth) and transitions (id/key/nodeType/duration/appear/depth). Peeks the `open` signal without subscribing, retains no DOM, mutates nothing → prod-safe; a detached overlay's pruned handler simply stops appearing. |
| Testing helpers (render/find/waitFor) | COMPLETE | streetui/testing: `renderComponent`/`hydrateComponent`/`findComponent`/`trigger` (+ prior render/findByRole/waitFor/flushUpdates). |
| **Interaction testing helpers (focus/blur/pressKey/clickOutside/openOverlay/waitForTransition)** | COMPLETE (shipped §20) | streetui/testing helpers.ts: `focus`/`blur`/`pressKey`/`clickOutside`/`openOverlay`/`closeOverlay`/`waitForTransition`, built on `trigger`/`flushUpdates`/signal `set`. `waitForTransition` dispatches the `transitionend` the controller listens for (happy-dom fires none) then flushes so deferred leave-teardown completes; `clickOutside` throws on an inside target rather than silently no-op'ing. |

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

**Classification totals:** COMPLETE 19 · PARTIAL 5 · MISSING 8.
The MISSING/PARTIAL set is exactly the milestone's work; nothing in it duplicates
an existing API — each item extends or hooks a substrate that already exists.

---

## §11 Accessibility conformance — scope and honest limits

StreetUI does **not** claim WCAG or ARIA-APG conformance, and using these
primitives does not by itself make an application accessible. Accessibility is a
property of the finished UI — its content, contrast, labels, reading order and
real assistive-technology testing — not of a framework. What the framework
provides is a set of correct, deterministic building blocks; the remaining
responsibility stays with the application author.

**What the framework guarantees (verified by tests):**

- **Deterministic ids.** `a11yIds(base)` derives `input`/`label`/`description`/
  `error`/`title`/`trigger`/`controls`/`owns` purely from the base string — no
  counters, no randomness — so an id referenced by `aria-labelledby` /
  `aria-describedby` / `aria-controls` / `aria-owns` is byte-identical on the
  server and after hydration and never breaks the association.
- **Dialog keyboard (§12).** Modal overlays trap Tab / Shift+Tab with wrap-around,
  contain focus that escapes the panel, move focus in on open (initial-focus id
  or first focusable, disabled elements skipped), close on Escape, and restore
  focus to the opener on close. Nested modals compose: each panel owns its own
  listeners and the innermost open panel handles the event first.
- **Menu keyboard (§13).** `role="menu"` overlays (dropdown) get roving focus:
  Arrow Up/Down (wrap), Home/End, and Enter/Space activation, re-querying items
  each keypress so reactive/disabled items are handled live. Escape closes.
- **Live regions (§15).** `createAnnouncer` maintains a single polite and single
  assertive region, mutating text to announce and reusing the same nodes, so
  announcements are reliable and never leave a growing pile of stale nodes.
- **Focus-restore timing with transitions (§10).** On close, focus is restored at
  close-request time, before/independent of a leave animation, so a panel that is
  animating out never retains focus.
- **SSR/hydration safety.** Every focus/menu/announcer/transition operation is a
  no-op when there is no DOM (`dom.body() === null`); server output carries no
  focus, transition, or live-region artifacts, and hydration does not double-bind
  or replay enter animations (§22).

**What remains the application's responsibility (not claimed):**

- Meaningful accessible names and descriptions (the framework supplies id tokens
  and `aria-*` option passthrough, not the copy).
- Correct roles/semantics for custom widgets beyond the shipped overlay kinds
  (e.g. tabs, comboboxes, tree grids, `aria-activedescendant` patterns).
- Colour contrast, motion-reduction preferences (`prefers-reduced-motion`), text
  sizing, and visible focus indicators — all CSS/content concerns.
- Tooltip trigger wiring (§14): the `tooltip` overlay is intentionally
  cooperative — the app connects hover/focus/blur/Escape on the anchor to the
  `open` signal. The framework does not attach global document listeners, which
  keeps it touch-, SSR-, and hydration-safe but means dismissal behaviour is the
  app's to define.
- Real assistive-technology testing. The test suite runs against happy-dom, which
  models the DOM but not a screen reader; the browser/AT gate is BLOCKED in this
  environment (§24) and is **not** simulated or asserted as passing.

### §16 — the minimal focus-owner (containment stack)

Nested modal overlays exposed a real defect that justified a focus-owner concept.
Overlay panels are relocated into body-level portal containers, so an inner
dialog's panel is a *sibling* of the outer dialog's panel, not a descendant.
Each modal's `containFocus` listens for `focusin` on `<body>`; with two open at
once, the outer handler would see focus land in the inner panel, judge it
"outside", and yank focus back — the two handlers fight indefinitely.

The fix is deliberately the smallest thing that works: a module-level
containment stack in `dom/focus.ts`. Each `containFocus` pushes its container on
creation and only redirects while its container is the top of the stack; cleanup
pops it, so closing the inner modal hands ownership back to the outer one. This
is internal transient state confined to the focus module, torn down on cleanup,
and never attached to graph nodes — consistent with §18. A global registry with
richer bookkeeping was **not** added; the stack is sufficient and a nested-dialog
regression test (`overlay.test.ts`) pins the behaviour.


