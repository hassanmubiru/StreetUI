# Design Document — StreetUI v1.1 Competitive Performance Benchmarking

## Overview

All work is additive to the existing private `@streetui/benchmarks` package
(`packages/benchmarks/`). No public package is modified for benchmarking
purposes. The existing 10 suites, `bench()`, `summarize()`, `compareResults()`,
`formatResults()`, `writeSuite()`, and `runAllSuites()` are unchanged. The design
extends the package with:

1. A `CompetitorAdapter` interface and five adapters (StreetUI, React, Vue,
   Svelte, Solid).
2. Eight new benchmark suites (A–H) that drive every adapter through the same
   workloads.
3. A profiler that re-runs the six most expensive existing suites under V8 CPU
   profiling and emits `hotpaths.md`.
4. A `§30` report generator that reads result JSON and writes `v1.1-report.md`.
5. Extended CLI flags on `run.ts` (`--competitive`, `--profiler`, `--report`).
6. New npm scripts and pinned competitor devDependencies in
   `packages/benchmarks/package.json`.

---

## 1. File Map

```
packages/benchmarks/src/
  adapters/
    types.ts            ← CompetitorAdapter interface, RowItem type, NotSupported
    streetui.ts         ← StreetUI adapter
    react.ts            ← React 19 adapter (dynamic import; skips if absent)
    vue.ts              ← Vue 3 adapter
    svelte.ts           ← Svelte 5 adapter
    solid.ts            ← Solid 1 adapter
    registry.ts         ← adapter registry map + loadAdapters()
  suites/
    bench-a.ts          ← signal/reactive throughput (1k/10k/100k)
    bench-b.ts          ← list initial mount (1k/10k rows)
    bench-c.ts          ← list partial row swap (1k rows)
    bench-d.ts          ← list teardown (1k rows)
    bench-e.ts          ← SSR throughput (500-node tree, calls/sec)
    bench-f.ts          ← hydration time (500-node tree)
    bench-g.ts          ← real-browser TTI via Playwright
    bench-h.ts          ← GC-cycle heap memory (1k rows)
  framework-versions.ts ← read/write/validate framework-versions.json
  profiler.ts           ← CPU profiling runner + hotpaths.md generator
  report-generator.ts   ← §30 markdown report (30 sections)
  run-competitive.ts    ← CLI entry for full A–H run
  harness.test.ts       ← extended (≥12 tests total, was 7)

packages/benchmarks/
  results/
    baseline.json       ← written by --baseline (BenchSuiteResult | CompetitiveSuiteResult)
    current.json        ← written by default run
    delta.json          ← written by compareResults after re-run
    hotpaths.md         ← written by profiler
    v1.1-report.md      ← written by report-generator
  framework-versions.json ← pinned competitor versions
```

---

## 2. CompetitorAdapter Interface

```typescript
// adapters/types.ts

export interface RowItem {
  readonly id: number;
  readonly label: string;
}

/** Thrown by adapter methods that the framework does not support. */
export class NotSupported extends Error {
  constructor(framework: string, method: string) {
    super(`${framework} does not support ${method}`);
  }
}

/** Uniform interface every competitor (and StreetUI itself) must implement. */
export interface CompetitorAdapter {
  /** Short identifier used as JSON key (e.g. "react", "vue", "streetui"). */
  readonly name: string;

  // ── List operations (benchmarks B, C, D) ─────────────────────────────────
  /**
   * Mount a keyed list of rows into `container`. Called once per bench
   * iteration in benchmarks B and C (setup phase).
   */
  mountList(container: HTMLElement, rows: RowItem[]): void;

  /**
   * Replace all rows in the currently mounted list with `rows`. Used by bench
   * C to perform a swap — caller passes the rows array with every 10th item
   * replaced.
   */
  updateList(rows: RowItem[]): void;

  /**
   * Fully destroy/unmount the currently mounted list and remove all DOM nodes.
   * Measured in benchmark D.
   */
  unmountList(): void;

  // ── Reactive primitives (benchmark A) ────────────────────────────────────
  createSignal<T>(initial: T): { get(): T; set(v: T): void };
  createDerived<T>(fn: () => T): { get(): T };
  batchUpdates(fn: () => void): void;

  // ── SSR (benchmark E) ────────────────────────────────────────────────────
  /**
   * Render a 500-node application to an HTML string. Throws `NotSupported` if
   * the framework has no server rendering API.
   */
  renderToString(): string;

  // ── Hydration (benchmark F) ───────────────────────────────────────────────
  /**
   * Adopt `html` (previously produced by `renderToString`) into `container`
   * via the framework's hydration mechanism. Throws `NotSupported` if
   * unsupported.
   */
  hydrate(container: HTMLElement, html: string): void;

  // ── Memory (benchmark H) ──────────────────────────────────────────────────
  /** Current heap in bytes — used before/after GC cycles in bench H. */
  heapBytes(): number;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  /** Release all framework-level resources between benchmark runs. */
  dispose(): void;
}
```

---

## 3. Adapter Registry and Lazy Loading

```typescript
// adapters/registry.ts

import type { CompetitorAdapter } from './types.js';

/**
 * Each entry is a factory that dynamically imports the adapter module. If the
 * competitor package is not installed, the factory catches the import error,
 * logs a warning, and returns null — the harness records "skipped" for that
 * framework rather than crashing.
 */
export type AdapterFactory = () => Promise<CompetitorAdapter | null>;

export const ADAPTER_REGISTRY: Record<string, AdapterFactory> = {
  streetui: () => import('./streetui.js').then((m) => m.createAdapter()),
  react:    () => import('./react.js').then((m) => m.createAdapter()).catch(() => null),
  vue:      () => import('./vue.js').then((m) => m.createAdapter()).catch(() => null),
  svelte:   () => import('./svelte.js').then((m) => m.createAdapter()).catch(() => null),
  solid:    () => import('./solid.js').then((m) => m.createAdapter()).catch(() => null),
};

/**
 * Load all adapters. Returns a map of name → adapter for those that loaded
 * successfully, plus a set of names that were skipped.
 */
export async function loadAdapters(
  names = Object.keys(ADAPTER_REGISTRY),
): Promise<{ adapters: Map<string, CompetitorAdapter>; skipped: Set<string> }> {
  const adapters = new Map<string, CompetitorAdapter>();
  const skipped = new Set<string>();
  for (const name of names) {
    const factory = ADAPTER_REGISTRY[name];
    if (!factory) { skipped.add(name); continue; }
    const adapter = await factory();
    if (adapter === null) { skipped.add(name); continue; }
    adapters.set(name, adapter);
  }
  return { adapters, skipped };
}
```

**Adding a 6th competitor:** create `adapters/sixth.ts` implementing
`CompetitorAdapter`, export `createAdapter()`, add one entry to
`ADAPTER_REGISTRY`. No other file changes.

---

## 4. CompetitiveSuiteResult Schema

Extends `BenchSuiteResult` without modifying the existing type:

```typescript
// Extended result written to baseline.json / current.json for A–H runs.
interface CompetitiveSuiteResult extends BenchSuiteResult {
  /** Contents of framework-versions.json at time of run. */
  readonly frameworkVersions: Record<string, string>;
  /**
   * Per-adapter results. Key = adapter.name. StreetUI results are also in the
   * top-level `results` array (for backward compat with existing compareResults).
   * Competitor results are here only.
   */
  readonly competitorResults: Record<string, readonly BenchResult[]>;
  /** Adapter names that were skipped (import failed / not installed). */
  readonly skippedAdapters: readonly string[];
}
```

`writeSuite` / `readSuite` in `report.ts` already accept arbitrary JSON; no
change needed — callers cast to `CompetitiveSuiteResult` when needed.

---

## 5. Benchmark A–H Methodology

All benchmarks run in the same Node.js process with `happy-dom` pre-installed as
the global DOM (via `installHappyDom()`). Each benchmark function receives the
loaded adapters map, calls `bench()` with the existing harness, and returns
`BenchResult[]` grouped with `category` values `"bench-a"` through `"bench-h"`.

### Benchmark A — Signal/Reactive Throughput (`bench-a.ts`)

**What is measured:** the wall-clock time to perform N signal writes where each
write triggers all dependent reads (simulating a reactive computation graph).

**Methodology:**
- `setup`: create one signal and `n` derived/computed nodes each reading it.
- `run(state)`: call `state.signal.set(state.signal.get() + 1)` (one write
  propagates to n readers). For competitors: equivalent — `ref.value++` (Vue),
  `setSignal(s => s + 1)` (Solid), store.set (Svelte), `useState` setter
  (React — useReducer + manual notification).
- `inner`: 1 (the single write + propagation is the measurable unit).
- `n` values: 1 000, 10 000, 100 000.
- Name pattern: `"signal update N=1000 [framework]"`.

### Benchmark B — List Initial Mount (`bench-b.ts`)

**What is measured:** time to create N `RowItem` objects and mount a rendered
list into a fresh DOM container, including all framework setup.

**Methodology:**
- `setup`: call `freshContainer()` for a clean DOM node; generate N rows
  (`{ id: i, label: \`Item ${i}\` }`).
- `run(state)`: call `adapter.mountList(state.container, state.rows)`.
- `teardown`: call `adapter.unmountList()` then discard container.
- `n` values: 1 000, 10 000.
- Name: `"list mount N=1000 [framework]"`.

### Benchmark C — List Partial Row Swap (`bench-c.ts`)

**What is measured:** time to swap every 10th row in an already-mounted 1 000-row
list (a targeted partial update, not a full re-render).

**Methodology:**
- `setup`: mount a 1 000-row list; prepare a swapped rows array where rows at
  indices 0, 10, 20, … are replaced with new `RowItem` objects.
- `run(state)`: call `adapter.updateList(state.swappedRows)`.
- `teardown`: `adapter.unmountList()`.
- `n`: 1 000.
- Name: `"list swap N=1000 [framework]"`.

### Benchmark D — List Teardown (`bench-d.ts`)

**What is measured:** time to fully unmount and destroy a 1 000-row list.

**Methodology:**
- `setup`: mount a fresh 1 000-row list.
- `run(state)`: call `adapter.unmountList()`.
- `n`: 1 000.
- Name: `"list teardown N=1000 [framework]"`.

### Benchmark E — SSR Throughput (`bench-e.ts`)

**What is measured:** number of `renderToString`-equivalent calls per second for
a 500-node tree. Reported as `opsPerSec` (derived from median ms).

**Methodology:**
- `setup`: (none — adapter pre-builds the app).
- `run`: call `adapter.renderToString()` and discard the result (no I/O).
- `inner`: 10 (amortises timer resolution; cost divided back in `summarize`).
- If adapter throws `NotSupported`: record result with `note: "N/A"` and
  `medianMs: 0, opsPerSec: 0`.
- `n`: 500 (tree node count, for context).
- Name: `"ssr throughput N=500 [framework]"`.

### Benchmark F — Hydration Time (`bench-f.ts`)

**What is measured:** time to hydrate (adopt server-rendered HTML into a live DOM
tree) a 500-node tree.

**Methodology:**
- `setup`: render to HTML string via `adapter.renderToString()`, inject into
  container's `innerHTML`.
- `run(state)`: call `adapter.hydrate(state.container, state.html)`.
- `teardown`: `adapter.unmountList()`.
- If `NotSupported`: `note: "N/A"`.
- `n`: 500.
- Name: `"hydration N=500 [framework]"`.

### Benchmark G — Real-Browser TTI (`bench-g.ts`)

**What is measured:** wall-clock time from page load to completion of a button
click handler in headless Chromium via Playwright.

**Methodology:**
- Detect Playwright: `import('playwright')` — if it throws, write result with
  `note: "skipped-no-playwright"` and return immediately.
- For StreetUI only (competitors require a separate built HTML page — beyond
  monorepo scope; recorded as `note: "browser-manual"`):
  - Launch `chromium.launch({ headless: true })`.
  - Load the existing `scripts/browser-harness.mjs` page (reuse the temp HTML
    approach from `browser-harness.mjs`).
  - Measure page-load → click → handler completion.
- `n`: null (single measurement, not parameterised by size).
- Name: `"browser tti [framework]"`.

### Benchmark H — GC Heap Memory (`bench-h.ts`)

**What is measured:** heap allocated by a mounted 1 000-row list (mount-peak) and
heap after unmount + forced GC (post-cleanup).

**Methodology:**
- Requires `--expose-gc` (detects via `typeof global.gc === 'function'`; skips
  with `note: "skipped-no-expose-gc"` if absent).
- `setup`: (none).
- `run`:
  1. `global.gc()`.
  2. Record `heapBefore = adapter.heapBytes()`.
  3. `adapter.mountList(container, rows1000)`.
  4. Record `heapAfterMount = adapter.heapBytes()`.
  5. `adapter.unmountList()`.
  6. `global.gc()`.
  7. Record `heapAfterUnmount = adapter.heapBytes()`.
  8. Compute `mountPeakBytes = heapAfterMount - heapBefore`.
- Emits two `BenchResult` entries per adapter:
  `"heap mount-peak N=1000 [framework]"` and
  `"heap post-unmount N=1000 [framework]"`.
- `n`: 1 000.

---

## 6. StreetUI Adapter (`adapters/streetui.ts`)

Maps StreetUI's existing APIs to `CompetitorAdapter`:

| Method | Implementation |
|---|---|
| `mountList` | `streetui.app()` + `listOf` + `compile()` + `mountGraph()` |
| `updateList` | update the signal driving the list, trigger reactive re-render |
| `unmountList` | call runtime handle's `dispose()` |
| `createSignal` | `signal(initial)` from `@streetui/state` |
| `createDerived` | `derived(fn)` from `@streetui/state` |
| `batchUpdates` | `batch(fn)` from `@streetui/state` |
| `renderToString` | build 500-node app + `compile()` + `renderToString()` from `@streetui/renderer` |
| `hydrate` | `hydrateGraph()` from `@streetui/renderer` |
| `heapBytes` | `process.memoryUsage().heapUsed` |
| `dispose` | runtime handle dispose + container cleanup |

---

## 7. Competitor Adapters

Each competitor adapter (`react.ts`, `vue.ts`, `svelte.ts`, `solid.ts`) is
structured identically:

```typescript
// Pattern for each adapter:
export async function createAdapter(): Promise<CompetitorAdapter> {
  // Dynamic import — if not installed, the registry's .catch() returns null
  const lib = await import('react'); // or 'vue', 'svelte', 'solid-js'
  // ... implement CompetitorAdapter using lib ...
  return { name: 'react', mountList, ... };
}
```

All list operations use `happy-dom`'s DOM. React uses `ReactDOM.createRoot()` +
`ReactDOM.render()`. Vue uses `createApp()` + `mount()`. Svelte uses the
component `mount()` API (Svelte 5). Solid uses `render()` from `solid-js/web`.

SSR: React uses `renderToString` from `react-dom/server`. Vue uses
`renderToString` from `@vue/server-renderer`. Svelte 5 uses `render` from
`svelte/server`. Solid uses `renderToString` from `solid-js/web`.

---

## 8. Framework Versions (`framework-versions.ts`)

```typescript
interface FrameworkVersions {
  react: string;
  'react-dom': string;
  vue: string;
  svelte: string;
  'solid-js': string;
}

/** Read installed versions from node_modules and write framework-versions.json. */
export function captureVersions(): FrameworkVersions;

/** Read and validate framework-versions.json. Throws if malformed. */
export function readVersions(): FrameworkVersions;
```

`captureVersions()` reads `packages/benchmarks/node_modules/<pkg>/package.json`
for each competitor to get the exact installed `version` field. Called once
during the competitive run setup, before benchmarks execute.

---

## 9. Profiler (`profiler.ts`)

**Step 1 — Identify top 6 suites.** Read `baseline.json`. For each existing
suite name, find the result with the largest `n` and take its `medianMs`. Sort
descending. Take top 6.

**Step 2 — CPU profile each suite.** For each of the 6 suites, spawn:
```
node --cpu-prof --cpu-prof-dir=<tmpdir> dist/run.js --suite=<name>
```
This produces one `*.cpuprofile` file per suite.

**Step 3 — Parse `.cpuprofile`.** Each `.cpuprofile` is V8 JSON with a
`nodes` array. Each node has `callFrame.functionName`, `callFrame.url`, and
`hitCount`. Compute self-time percentage as `(node.hitCount / totalHits) * 100`
where `totalHits = sum of all hitCounts`.

**Step 4 — Classify.** For each function with self-time ≥ 1%:
- `url` contains `@streetui/` → StreetUI-owned → include in priority table.
- `url` contains `happy-dom` / `node:` / V8 internals → exclude (annotate as
  "not actionable").
- Assign priority: ≥3% → `High`, 1–3% → `Medium`, <1% → `Low`.

**Step 5 — Write `hotpaths.md`.**
```markdown
| Function | Package | Self-time % | Priority | Notes |
|---|---|---|---|---|
| reconcileChildren | @streetui/renderer | 8.2% | High | Patch loop allocation |
...
```

---

## 10. §30 Report Generator (`report-generator.ts`)

Reads: `baseline.json`, `current.json`, `delta.json`, `framework-versions.json`,
`hotpaths.md`.

Writes: `v1.1-report.md` with exactly 30 numbered sections.

| Section | Content | Source |
|---|---|---|
| §1 | Executive Summary | hand-written template + key numbers |
| §2 | Methodology | static text: iterations=40, warmup=8, inner varies, noise=2%, revert rule |
| §3 | Environment | `baseline.json → environment` |
| §4 | Framework Versions | `framework-versions.json` verbatim |
| §5 | Benchmark A — Signal Throughput | result table from `baseline/current` |
| §6 | Benchmark B — List Mount | result table |
| §7 | Benchmark C — List Swap | result table |
| §8 | Benchmark D — List Teardown | result table |
| §9 | Benchmark E — SSR Throughput | result table |
| §10 | Benchmark F — Hydration | result table |
| §11 | Benchmark G — Browser TTI | result table (or note if skipped) |
| §12 | Benchmark H — Memory | result table (or note if --expose-gc absent) |
| §13 | StreetUI Baseline vs Post-Opt Delta | `delta.json` rendered via `formatComparison` |
| §14–§23 | Optimisation Log (1 per applied/deferred opt, ≤10) | per-opt entries |
| §24 | Bundle Size Reference | static: `streetui-1.0.0.tgz` size |
| §25 | Test Suite Integrity | static: 631 tests passing |
| §26 | Known Limitations | static text |
| §27 | Competitive Standing | lead/trail/noise table per framework per benchmark |
| §28 | Honest Assessment | static text with ≥1 "where we trail" sentence |
| §29 | Public API Integrity | list of unchanged APIs |
| §30 | Conclusion | static text |

Report generation **fails** (non-zero exit, no output file written) if any
required benchmark category has no valid data.

---

## 11. CLI Extensions to `run.ts`

```
node dist/run.js [flags]

Existing flags (unchanged):
  --baseline         write baseline.json instead of current.json
  --suite=a,b        run only named existing suites

New flags:
  --competitive      after existing suites, run A–H harness for all adapters;
                     writes CompetitiveSuiteResult to baseline.json or current.json
  --profiler         run CPU profiler on 6 heaviest suites, write hotpaths.md
  --report           generate v1.1-report.md from stored result files
  --expose-gc        must be passed as a node flag (not a run.ts flag); bench-h
                     detects global.gc automatically
```

New npm scripts in `packages/benchmarks/package.json`:
```json
"bench:competitive":  "node dist/run.js --competitive",
"bench:competitive:baseline": "node dist/run.js --competitive --baseline",
"bench:profiler":     "node dist/run.js --profiler",
"bench:report":       "node dist/run.js --report",
"bench:full":         "node --expose-gc dist/run.js --competitive --profiler --report"
```

---

## 12. Dependency Additions (`packages/benchmarks/package.json`)

Competitor packages added to `devDependencies` with exact pinned versions:

```json
"devDependencies": {
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "@types/react": "19.1.0",
  "@types/react-dom": "19.1.0",
  "vue": "3.5.13",
  "@vue/server-renderer": "3.5.13",
  "svelte": "5.33.14",
  "solid-js": "1.9.7",
  "playwright": "1.63.0",
  "typescript": "*",
  "tsup": "*",
  "vitest": "*",
  "happy-dom": "*"
}
```

Exact versions are resolved at install time and locked; the `framework-versions.json`
captures what was actually resolved.

Playwright is already a root workspace devDep; adding it to benchmarks devDeps
ensures it is importable from the benchmarks package directly.

---

## 13. Extended Harness Tests (`harness.test.ts`)

Extend to ≥12 tests total. New tests to add:

1. `compareResults` with 2% band correctly classifies improved / regressed /
   unchanged / new.
2. `compareResults` with explicit `{ band: 0.02 }` option.
3. `readVersions()` throws a descriptive error when a field is missing.
4. `readVersions()` throws when a field is not a valid semver string.
5. `loadAdapters()` returns skipped set when adapter import fails.
6. `CompetitiveSuiteResult` extra fields round-trip through JSON
   (`writeSuite` / `readSuite`).

---

## 14. Execution Sequence

```
Phase 0  ─ Baseline
  pnpm run bench:baseline          (existing suites only, write baseline.json)

Phase 1  ─ Competitor install
  pnpm install                     (resolves new devDeps)
  node dist/run.js --report        (captures framework-versions.json)

Phase 2  ─ A–H competitive run (baseline)
  pnpm run bench:competitive:baseline

Phase 3  ─ Profiling
  pnpm run bench:profiler          (writes hotpaths.md)

Phase 4  ─ Optimisation loop (repeat per change)
  [edit @streetui/* source]
  pnpm turbo run build --filter=@streetui/benchmarks...
  pnpm run bench:competitive       (writes current.json)
  [check delta.json — revert if no improvement or regression]

Phase 5  ─ Report
  pnpm run bench:full              (final A–H + profiler + report in one shot)
```

---

## 15. Constraints

- `@streetui/benchmarks` stays `"private": true` — never added to the publish
  manifest.
- Competitor packages (`react`, `vue`, `svelte`, `solid-js`) are installed only
  in `packages/benchmarks/devDependencies`; no other workspace package is
  modified.
- No changes to the `streetui` unified package, any `@streetui/*` package's
  public API, or the release scripts.
- The existing `SUITES` array and `runAllSuites()` are not modified; new suites
  are added alongside.
- All 631 v1.0 tests must continue passing throughout; the new benchmark suites
  are in `run.ts` / `run-competitive.ts` and are not vitest test files.
- Optimisations apply only inside `@streetui/compiler`, `@streetui/renderer`,
  `@streetui/scheduler`, `@streetui/state`, or `@streetui/graph`.
