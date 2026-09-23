# StreetUI v0.7 — Hot-Path Analysis (internal, evidence-based)

This is the profiling-driven analysis required by v0.7 §5. Every claim below is
grounded in the v0.6 baseline (`packages/benchmarks/results/baseline.json`, 84
results) and two `--cpu-prof` runs. **No optimization is proposed without
measured evidence.**

## Measurement environment

- Node v22.23.2, linux x64, 12th Gen Intel i7-1255U, 2 vCPU, ~4.1 GB.
- DOM provided by `happy-dom` (pure-JS DOM). This is the load-bearing caveat for
  the whole analysis: **under happy-dom, DOM object construction, tree wiring and
  the resulting GC dominate absolute time**. In a real browser those operations
  are native C++. So absolute mount/list milliseconds here are *environment-bound*
  and only the framework's own JS self-time is a fair optimization target.

## Baseline highlights (median ms)

- render/mount: n=1000 = 5.92, n=5000 = 57.7 (superlinear — see below).
- keyed-lists @ n=5000: append 23.5, prepend 93.4, remove-last 22.8,
  remove-first 23.0, insert-middle 60.0, move 92.6, reverse 93.4,
  replace-all 194.6.
- reactivity/update-subscribers n=1000 = 0.175.
- ssr/render-to-string n=5000 = 14.2; hydration/hydrate n=5000 = 6.9;
  unmount/flat n=5000 = 3.97.

## Profile 1 — mount 5000 nodes ×60 (aggregated self-time)

| bucket | self-time |
|---|---|
| GC | 41.8% |
| happy-dom internals (Node/Element construction & wiring) | majority of remainder |
| `applyNodeProps` (renderer/mount.ts) | 3.5% (128 samples) |
| `mountNode` (renderer/mount.ts) | 3.3% |
| `dispose` | 0.3% |

## Profile 2 — list prepend + reverse, n=2000 ×40 (aggregated self-time)

| bucket | self-time |
|---|---|
| happy-dom node ops (insert/connect/childNode) | 21.7% + 6.8% + 5.5% + … |
| GC | 16.3% |
| `applyNodeProps` | 2.4% |
| `reconcileChildren` (renderer keyed reconciler) | 1.8% |
| `createNode` (mount) | 1.8% |
| `mountNode` | 1.7% |
| `removeChild` (DOM adapter) | 1.5% |
| `setProp` (graph-node.ts) | 1.1% |

## Interpretation

1. The keyed-list reconciler is **not** a bottleneck. `reconcileChildren` is
   1.8% self-time; the cost of prepend/reverse/move is happy-dom moving real DOM
   nodes (native in a browser). Per §11 the algorithm is appropriate and will
   **not** be rewritten — this is documented as an "already appropriate" result.
2. Superlinear mount at large n is dominated by GC + DOM allocation, not by
   framework bookkeeping. The lever the framework controls is **allocation
   pressure** feeding GC.
3. The only framework self-time hot spot that appears in *both* profiles and is
   pure avoidable allocation is `applyNodeProps`.

---

## HOT PATH 1 — `applyNodeProps` per-node Set allocation

- **HOT PATH:** `packages/renderer/src/mount.ts` → `applyNodeProps`, on the mount
  path for every element node (and therefore every SSR node, since SSR runs the
  same `mountNode`).
- **CURRENT COST:** 3.5% self-time (mount profile), 2.4% (list profile). The
  function allocates a fresh `new Set([...15 keys])` on **every** call — i.e.
  once per node, 5000× per mount of the 5000-node app — purely to test key
  membership. That allocation is discarded immediately and feeds the 41.8% /
  16.3% GC buckets.
- **WHY:** The skip-key set is invariant; it does not depend on the node. It is
  rebuilt per node only because it is declared inside the function body.
- **PROPOSED OPTIMIZATION (OPT-1):** Hoist the set to a module-level
  `const SKIP_KEYS = new Set([...])`. Pure motion; identical membership test.
- **EXPECTED EFFECT:** Removes N Set allocations per mount/SSR pass (N = node
  count), lowering GC pressure. Expect a small but real improvement on mount and
  SSR at large n; negligible on tiny apps.
- **RISK:** Minimal. Semantics identical (same keys, same `.has()` test). No
  public API change. The only consideration is that the constant is now shared
  and must never be mutated — it is read-only in this code path.

## HOT PATH 2 (considered, NOT applied) — `GraphNode.setProp` copy-on-write

- **HOT PATH:** `packages/graph/src/graph-node.ts` → `setProp`, called on every
  reactive patch and every reconcile-built node.
- **CURRENT COST:** 1.1% self-time (list profile only); absent from the mount
  profile. `this.props = { ...this.props, [key]: value }` clones the whole props
  object on every write.
- **WHY / PROPOSED:** In-place `this.props[key] = value` would remove the clone.
- **EXPECTED EFFECT:** ~1% self-time on update-heavy workloads; marginal.
- **RISK: MEDIUM → DEFERRED.** `Graph.serialize()` (graph.ts:196) shares the
  **live** `node.props` reference into its `SerializedNode` snapshot. Today's
  copy-on-write means a snapshot taken before a later `setProp` stays frozen;
  in-place mutation would make retained snapshots observe later writes — a
  semantic change to serialization identity. `patchExistingInstance` and
  `patchNode` are both safe (they capture the scalar `oldValue` before writing,
  and compare across two distinct GraphNode instances), but the serialize sharing
  is enough to make this **not** a clearly-safe, clearly-worth-it change for 1%.
  Per §5/§23 this is documented as *measured, minor, deferred* rather than
  applied speculatively.

## Documented as "measured, not a significant bottleneck"

- `reconcileChildren` / keyed-list algorithm (1.8%) — appropriate, not rewritten (§11).
- `Signal` flush array-copy and SSR `serializeAttributes` `Object.entries` — do
  not appear as hot spots in either profile.
- No evidence supports global event delegation (§12) — events did not surface.

## Plan

Apply **OPT-1 only**. Rebuild the `renderer` package in the /work sandbox, rerun
the render + ssr + hydration + keyed-lists suites, and compare against
`baseline.json`. Keep the change only if it measurably improves and breaks no
semantics (§23 revert-non-improvements).

## OPT-1 RESULT (applied, kept)

Hoisted `applyNodeProps` skip-key set to module-level `SKIP_PROP_KEYS`
(`packages/renderer/src/mount.ts`). Re-ran the affected suites and, for the
large-n cases, three additional times to separate signal from noise:

| benchmark (median ms) | v0.6 base | post-OPT-1 (stable) | delta |
|---|---|---|---|
| ssr/render-to-string n=5000 | 14.23 | 11.6 – 12.2 | **-14% to -19%** |
| ssr/render-to-string n=1000 | 1.22 | 1.02 – 1.05 | **-14% to -16%** |
| render/mount n=5000 | 57.71 | 54.1 – 57.3 | -0.7% to -6% (mild) |
| keyed-lists (all @ n=5000) | — | — | within ±2.4% (neutral) |

**Verdict: KEEP.** The win is clearest and reproducible on **SSR**, where
`mountNode → applyNodeProps` runs for every node with no DOM-move cost to mask
the saved allocations — exactly the path where removing N per-node `Set`
allocations shows up cleanly. Mount n=5000 improves mildly; lists are neutral
(their cost is DOM node movement, not prop application). Small-n swings
(sub-microsecond) and the hydration n=5000 figure are inside the noise band of
this 2-vCPU VM and the single-capture baseline — not attributed to OPT-1.
Semantics preserved: all 111 renderer tests pass, including the 4 new
memory/cleanup cycle tests.

## OPT-2 (`GraphNode.setProp` in-place) — DEFERRED, not applied

Confirmed via `patchNode`/`patchExistingInstance` reads that the *patch* paths
are safe, but `Graph.serialize()` shares the live `props` reference into its
snapshot, so in-place mutation would change serialization identity semantics for
a ~1% self-time gain that never appeared in the mount profile. Per §5/§23,
documented as *measured, minor, deferred* rather than applied on a guess.

