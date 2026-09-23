# StreetUI Performance Guide

This guide explains how StreetUI performs, how to measure it yourself, and how
to keep your own apps fast. It is evergreen; for the concrete v0.7 measurement
numbers and the optimizations shipped in that release, see
[`performance-v0.7.md`](./performance-v0.7.md).

## How StreetUI is built for speed

StreetUI has no virtual DOM. A StreetUI app compiles to a **semantic
application graph**, and the renderer walks that graph once to create real DOM
nodes. After mount, updates are **targeted**: a signal change looks up the exact
`NodeInstance` bound to it and patches only the changed property — there is no
tree diff, no re-render of unaffected nodes, and no reconciliation pass on a
plain reactive update.

Three properties follow from this design:

- **Mount cost is proportional to node count**, and is dominated by native DOM
  object construction — the same work any framework must do to create elements.
- **Reactive update cost is proportional to what actually changed**, not to the
  size of the view. Updating one signal touches one property on one element.
- **Keyed lists** reconcile by identity: reused items keep their DOM element and
  are only moved when their order changes; only added/removed items create or
  destroy DOM.

## Measuring performance yourself

The `@streetui/benchmarks` package is a runnable benchmark suite built on Node's
`node:perf_hooks` — no heavyweight benchmarking dependency. It covers the
compiler, initial mount, reactive updates, derived chains, conditionals, keyed
lists (append/prepend/remove/insert/move/reverse/replace at 10/100/1000/5000),
attribute updates, events, unmount, SSR, and hydration.

```bash
# From the repo root, in the benchmarks package:
npm run bench                 # run all suites, compare against a stored baseline
npm run bench -- --suite=render,ssr,keyed-lists   # run a subset
npm run bench:baseline        # record results/baseline.json as the reference
```

Each result reports **median, p95, min, max, mean, and ops/sec** over warmup +
measurement iterations, plus an environment header (Node version, OS, CPU,
arch, core count). Benchmarks are kept **separate** from correctness tests: they
never run under `npm test` and are never asserted with hard pass/fail
thresholds, because absolute timings are machine- and load-dependent. Use the
built-in comparison (current vs baseline, with per-benchmark % delta) to spot
regressions rather than treating any single number as a gate.

### Reading the numbers honestly

On a CI runner or a loaded laptop, small benchmarks (n ≤ 100) swing by tens of
percent run-to-run — that is noise, not signal. Trust the **large-n** cases and
**re-run** before concluding anything. A change that only moves sub-millisecond
benchmarks has not been shown to matter.

## Writing fast StreetUI apps

- **Prefer targeted bindings over rebuilding.** Bind a signal to the specific
  text/attribute that changes rather than reconstructing a subtree.
- **Key your lists.** `listOf` reconciles by item identity; stable keys let the
  renderer move existing DOM instead of recreating it on reorder.
- **Batch related writes.** `batch()` coalesces multiple signal writes into a
  single flush so dependent effects and patches run once (last-write-wins).
- **Window very large lists.** DOM node count is the dominant cost at scale; a
  1000-row un-windowed list pays for 1000 real elements no matter the framework.
- **Keep trees reasonable.** Very deep nesting increases mount and reconciliation
  walks.

## Spotting problems in development

`@streetui/devtools` exposes count-only, zero-runtime-cost helpers:

- `inspectApplication(compiled).perf` — structural counters: total nodes, max
  depth, event handlers, state bindings, distinct signals, largest child count.
- `diagnosePerformance(compiled, thresholds?)` — advisory warnings for
  large graphs, deep trees, oversized lists, and heavy signal fan-out. It is a
  **development tool you call explicitly**; nothing here runs on the render hot
  path.

These are counts, not timings — they flag the *shapes* that correlate with slow
apps without measuring anything at runtime.
