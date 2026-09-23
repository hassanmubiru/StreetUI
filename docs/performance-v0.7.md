# StreetUI v0.7 — Performance Report (measured)

This document records the **actual measurements** taken for the v0.7
performance pass, the single optimization that survived the "revert
non-improvements" rule, and the many paths that were measured and found **not**
to be bottlenecks. Every number here came from `@streetui/benchmarks`; none is
estimated.

> Methodology note, stated up front: all runs were taken on a **2-vCPU, ~4 GB
> Linux VM** using `happy-dom` as the DOM. Under happy-dom, DOM object
> construction and the resulting GC dominate absolute time; in a real browser
> those are native. So absolute milliseconds are environment-bound, small-n
> benchmarks are noisy (±tens of %), and only **controlled, repeated, large-n**
> comparisons are treated as signal.

## 1. Environment

- Node **v22.23.2**, linux (6.8.0), **x64**.
- CPU: 12th Gen Intel(R) Core(TM) i7-1255U, **2 logical cores**.
- Memory: ~4.1 GB. DOM: `happy-dom` (pure-JS).
- Harness: `node:perf_hooks` `performance.now()`; warmup + measurement
  iterations per benchmark; median/p95/min/max/mean/ops-per-sec reported.

## 2. Baseline (v0.6)

Captured to `packages/benchmarks/results/baseline.json` — 84 benchmark results.
Highlights (median ms):

| benchmark | n | median ms |
|---|---:|---:|
| render/mount | 1000 | 5.92 |
| render/mount | 5000 | 57.71 |
| reactivity/update-subscribers | 1000 | 0.175 |
| lists/append | 5000 | 23.55 |
| lists/prepend | 5000 | 93.42 |
| lists/reverse | 5000 | 93.44 |
| lists/replace-all | 5000 | 194.58 |
| ssr/render-to-string | 5000 | 14.23 |
| hydration/hydrate | 5000 | 6.90 |
| unmount/flat | 5000 | 3.97 |

## 3. Profiling → hot paths

Two `--cpu-prof` runs (mount 5000×60; list prepend+reverse 2000×40), aggregated
by self-time. Full analysis in [`performance-hotpaths.md`](./performance-hotpaths.md).
Key findings:

- **GC + happy-dom DOM construction dominate** absolute time (GC alone 41.8% of
  the mount profile). These are native in a browser; the framework's lever is
  **allocation pressure**.
- The **keyed-list reconciler is not a bottleneck** — `reconcileChildren` is
  ~1.8% self-time. Prepend/reverse/move cost is happy-dom moving real DOM nodes.
  Per §11 the algorithm is appropriate and was **not** rewritten.
- The one avoidable-allocation framework hot spot present in **both** profiles
  was `applyNodeProps`, which allocated a fresh `Set` of skip-keys **per node**.

## 4. Optimization implemented

### OPT-1 — hoist `applyNodeProps` skip-key set (KEPT)

- **Problem:** `applyNodeProps` (renderer `mount.ts`) ran
  `new Set([...15 keys])` on every element node — i.e. N allocations per mount
  and per SSR pass — purely for a membership test, feeding GC.
- **Evidence:** 3.5% self-time in the mount profile, 2.4% in the list profile;
  the set is invariant across nodes.
- **Change:** moved the set to a module-level `const SKIP_PROP_KEYS`
  (`ReadonlySet<string>`). Membership test unchanged.
- **Result (controlled, repeated large-n):** stable **-11% to -19%** on
  `ssr/render-to-string` at n=1000 and n=5000 across repeated isolated runs;
  mild improvement on `render/mount` n=5000; **neutral** on keyed lists (their
  cost is DOM movement, not prop application). SSR n=1000 improved in *both* the
  isolated runs (-14 to -16%) and the full-suite run (-11.4%), making it the
  most robust single claim.
- **Tradeoff:** none functional. The set is shared and read-only; the 4 new
  memory/cleanup cycle tests specifically guard against cross-mount
  contamination. All 111 renderer tests pass.

### OPT-2 — `GraphNode.setProp` in-place write (CONSIDERED, DEFERRED)

Would drop the `{...this.props}` clone on each write (~1% self-time, list
profile only). **Not applied:** `Graph.serialize()` shares the live `props`
reference into its snapshot, so in-place mutation would change serialization
identity semantics — not worth it for ~1% that never surfaced in the mount
profile. Documented per §5/§23 as measured-minor-deferred.

## 5. Measured, NOT optimized (valid results)

These were profiled or benchmarked and found to have **no significant
bottleneck**, so no change was made (a legitimate v0.7 outcome per §27):

- **Keyed-list algorithm** — ~1.8% self-time; already appropriate. Not rewritten.
- **`reconcileChildren` / reorder** — cost is DOM node movement (native in a
  browser), not framework bookkeeping.
- **Reactive updates** — `update-subscribers` n=1000 = 0.175 ms; targeted patch
  path is already minimal. No global event delegation added (§12): events never
  surfaced as a hot path.
- **SSR `serializeAttributes` / Signal flush copy** — did not appear as hot
  spots; left unchanged.
- **`GraphNode.setProp`** — see OPT-2 above; deferred, not applied.

## 6. Keyed-list benchmarks (context)

Baseline medians at n=5000: append 23.5, prepend 93.4, remove-last 22.8,
remove-first 23.0, insert-middle 60.0, move 92.6, reverse 93.4, replace-all
194.6 ms. Post-OPT-1 these move only within run-to-run noise (±~2.4% in the
controlled subset run) — expected, since OPT-1 targets prop application, not the
DOM-move cost that dominates list operations. No list regression at scale.

## 7. Bundle size (raw / gzip / brotli, via `node:zlib`)

Measured on each package's built ESM `dist/index.js` (gzip level 9, brotli
quality 11):

| scope | raw KB | gzip KB | brotli KB |
|---|---:|---:|---:|
| Runtime **core** (core, state, scheduler, events, graph, dsl, compiler, runtime, renderer, dom) | 84.55 | 21.10 | 18.48 |
| Opt-in (router, forms, i18n, context) | 17.22 | 5.41 | 4.75 |
| **Core + opt-in** | 101.77 | 26.52 | 23.22 |

Largest single runtime module is `renderer` (25.94 KB raw / 5.57 gzip / 4.92
brotli). `cli`, `benchmarks`, and `testing` are dev/tooling and never ship to a
browser bundle. OPT-1 did not meaningfully change bundle size (it removed a
per-call allocation, not code).

## 8. Devtools performance surface (§20) and diagnostics (§21)

- `inspectApplication(compiled).perf` now returns a count-only `PerfSnapshot`:
  `totalNodes`, `maxDepth`, `eventHandlers`, `stateBindings`, `distinctSignals`,
  `largestChildCount`. Derived from the existing inspection walk — no timings,
  no second graph representation, no UI.
- `diagnosePerformance(compiled, thresholds?)` (dev-only, pure) flags
  `large-graph`, `deep-tree`, `large-list`, and `high-signal-fanout` against
  advisory thresholds. It is called explicitly; **nothing runs on the render hot
  path.**

## 9. Verification

- Build: **26/26** turbo tasks (25 v0.6 packages + `@streetui/benchmarks`).
- Typecheck: **41/41** turbo tasks.
- Tests: **508** (v0.6 protected baseline of **496 intact** — none weakened,
  deleted, or skipped — plus 7 benchmark-harness, 4 renderer memory/cleanup, and
  1 devtools perf, and reused +… see the final report for the exact table).
- No `any`, no `@ts-ignore`, no non-null assertions introduced in framework code.
- Benchmarks kept separate from tests; no hard perf thresholds gate CI.

## 10. Honesty caveats

- The full-suite run (all 10 suites back-to-back) is noisier than isolated
  subset runs because the 2-vCPU VM thermally/contention-loads the tail suites;
  one full run showed SSR n=5000 at +3.5% while three isolated runs showed
  -14% to -19%. The controlled, repeated measurement is the one to trust, and
  SSR n=1000 improved in **both** modes.
- Small-n (n ≤ 100) deltas of ±10–90% seen in the comparison table are noise on
  this hardware and are **not** claimed as improvements or regressions.
- The v0.6 baseline was a single capture; a few of its small/hydration numbers
  sit inside the noise band and should not be read as precise.
