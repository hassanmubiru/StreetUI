# §2 — Isolated list-reorder benchmark

A framework-agnostic, real-browser benchmark for a **10,000-row keyed list** under a fixed
operation script: `create10k`, `append 1k`, `prepend 1k`, `insertMiddle 1k`,
`removeScattered 1k`, `swapEnds`, `reverse`, `shuffle`, `updateEvery10th`.

For each operation it records, from the real engine: wall **duration**, **DOM mutations**
(MutationObserver), resulting **node count**, **long tasks** (PerformanceObserver), and
**frame pacing** (dropped frames via rAF sampling).

## Files

- `scenario.mjs` — framework-agnostic measurement core. Drives the op script over
  `window.__bench` and returns the per-op records. Contains no framework code.
- `adapters/streetui.mjs` — StreetUI adapter using only the public `streetui` API
  (`signal` + keyed `listOf` + `createRenderer`/`BrowserDOMAdapter`). Competitor adapters
  would live beside it and expose the same `window.__bench` contract.
- `run.mjs` — the runner. Proves Playwright + a Chromium binary are present, bundles each
  adapter with the core, serves the page, drives it through Chromium, and writes the result.

## Running

```
node benchmarks/scenarios/browser-list-reorder/run.mjs --out=<absPath>
```

## Status in this environment: BLOCKED

There is **no Chromium/Chrome binary** in this VM and none is installable (npm registry
returns 403 / offline, so Playwright cannot be fetched either). `run.mjs` detects this and
writes a result with `status: "BLOCKED"` and the exact reason — it never fabricates,
estimates, or substitutes a happy-dom number for a browser number. The code is complete and
will run unchanged wherever a Chromium binary + Playwright exist (set `CHROMIUM_PATH` if the
binary is in a non-standard location).

Related **node-side** measurements (mount/hydration/mutation counts under happy-dom) live in
`benchmarks/results/v1.4/streetui-node.json` and are explicitly **not** browser numbers.
