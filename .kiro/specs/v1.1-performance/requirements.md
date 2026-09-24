# Requirements Document

## Introduction

StreetUI v1.1 adds competitive performance benchmarking and evidence-backed optimisation to the 1.0.0 release. The work consists of six sequential phases: capturing a v1.0 baseline against the existing `@streetui/benchmarks` suite; extending that suite with a cross-framework harness (A–H) that runs equivalent workloads for React, Vue, Svelte, and Solid; profiling StreetUI's own hot paths from the baseline data; applying targeted, evidence-backed optimisations inside the compiler, renderer, scheduler, and/or list reconciler; re-running the full harness after each change to produce honest before/after deltas; and publishing a §30 structured report.

The scope is benchmarking infrastructure and internal optimisations only. No public API surface changes, no VDOM, no JSX, no runtime dependency additions, no changes to the single-package architecture.

---

## Glossary

- **Benchmark_Suite**: The `@streetui/benchmarks` private package (`packages/benchmarks/`), the sole location for all benchmark code, competitor installs, and result artefacts.
- **Baseline**: The `packages/benchmarks/results/baseline.json` file that records StreetUI's v1.0 measured performance before any v1.1 optimisation is applied.
- **Competitor_Harness**: The new cross-framework adapter layer (benchmarks A–H) that runs equivalent workloads for React, Vue, Svelte, and Solid alongside StreetUI in the same process.
- **Framework_Versions**: The `packages/benchmarks/framework-versions.json` file that records the exact pinned versions of every competitor framework.
- **Profiler**: The Node.js `--cpu-prof` / `--prof` mechanism or equivalent `v8-profiler-next` integration used to capture hot-path data from StreetUI's own benchmarks.
- **Optimisation**: A targeted, evidence-driven code change inside one or more of `@streetui/compiler`, `@streetui/renderer`, `@streetui/scheduler`, `@streetui/state`, or `@streetui/graph` that improves at least one benchmark metric without regressing others or changing any public API.
- **Delta_Report**: The per-benchmark before/after comparison (median ms, ops/sec, percentage change) produced by `compareResults` after each optimisation.
- **Performance_Report**: The §30 structured markdown document at `packages/benchmarks/results/v1.1-report.md` containing methodology, framework versions, raw benchmark tables, optimisation rationale, and honest competitive standing.
- **TTI**: Time-to-Interactive — the elapsed wall-clock time from the browser receiving a page's HTML until the first user interaction (a button click) completes successfully in real Chromium.
- **SAG**: Semantic Application Graph — StreetUI's compiled intermediate representation produced by `@streetui/compiler`.
- **DSL**: The StreetUI domain-specific language surface (`@streetui/dsl`) that authors use to describe applications.
- **Heap_Snapshot**: A V8 heap measurement (post-GC RSS or `process.memoryUsage().heapUsed`) taken after a mount operation and a forced GC cycle, used for benchmark H.

---

## Requirements

---

### Requirement 1: Honest v1.0 Baseline Capture

**User Story:** As a performance engineer, I want an unaltered v1.0 measurement captured before any optimisation, so that every subsequent delta is grounded in a real starting point.

#### Acceptance Criteria

1. WHEN the baseline script is executed, THE Benchmark_Suite SHALL run every existing suite (compiler, render, reactivity, conditional, keyed-lists, attributes, events, unmount, ssr, hydration) with no code changes to framework packages.
2. WHEN the baseline run completes, THE Benchmark_Suite SHALL write all results to `packages/benchmarks/results/baseline.json` using the existing `writeSuite` mechanism.
3. THE Baseline file SHALL contain a captured environment header (Node version, platform, CPU model, core count, total memory, ISO timestamp) as produced by the existing `environment()` function.
4. IF the `packages/benchmarks/results/baseline.json` file already exists from a prior run, THE Benchmark_Suite SHALL overwrite it only when the `--baseline` flag is explicitly passed; without that flag THE Benchmark_Suite SHALL NOT overwrite the file.
5. THE Baseline SHALL record a minimum of 84 benchmark results (the v0.7 count), covering all sizes defined in each suite.
6. WHEN the baseline is recorded, THE Benchmark_Suite SHALL print the full result table to stdout using the existing `formatResults` function.

---

### Requirement 2: Competitor Framework Version Pinning

**User Story:** As a benchmark author, I want competitor framework versions pinned in a machine-readable file, so that results are reproducible and the report can cite exact versions.

#### Acceptance Criteria

1. THE Benchmark_Suite SHALL add a `packages/benchmarks/framework-versions.json` file that records the exact resolved versions of React, Vue, Svelte, and Solid used in the competitor harness.
2. THE `framework-versions.json` file SHALL follow the schema `{ "react": "<semver>", "react-dom": "<semver>", "vue": "<semver>", "svelte": "<semver>", "solid-js": "<semver>" }`.
3. WHEN competitor packages are installed, THE Benchmark_Suite SHALL install them exclusively as `devDependencies` inside `packages/benchmarks/package.json` and never in any other workspace package's `dependencies` or `devDependencies`.
4. THE competitor packages SHALL be installed with exact versions (no `^` or `~` range prefixes) in `packages/benchmarks/package.json`.
5. THE Benchmark_Suite SHALL install `react@19` and `react-dom@19` as the React competitor, `vue@3` as the Vue competitor, `svelte@5` as the Svelte competitor, and `solid-js@1` as the Solid competitor, resolving to the latest patch within those major/minor bounds at install time and then locking the exact resolved version.
6. WHEN the `packages/benchmarks/framework-versions.json` file is read, THE Benchmark_Suite SHALL validate that every entry is a non-empty semver string before any harness run proceeds; IF validation fails THEN THE Benchmark_Suite SHALL exit with a descriptive error message.

---

### Requirement 3: Cross-Framework Benchmark Harness (A–H)

**User Story:** As a framework author, I want a fair, equivalent A–H benchmark suite that runs the same workloads for StreetUI, React, Vue, Svelte, and Solid, so that competitive standing is based on measured, comparable data.

#### Acceptance Criteria

1. THE Competitor_Harness SHALL implement eight benchmark categories, labelled A through H, each producing results whose `category` field is one of `"bench-a"`, `"bench-b"`, `"bench-c"`, `"bench-d"`, `"bench-e"`, `"bench-f"`, `"bench-g"`, `"bench-h"`.
2. WHEN benchmark A (signal/reactive update throughput) is executed, THE Competitor_Harness SHALL measure StreetUI's `signal().set()` propagation at N=1 000, 10 000, and 100 000 subscriber-equivalent update operations, and SHALL measure equivalent reactive primitives for React (`useReducer` + forced re-render), Vue (`ref().value =`), Svelte (`$state` / writable store writes), and Solid (`createSignal()[1]()`).
3. WHEN benchmark B (list initial mount) is executed, THE Competitor_Harness SHALL measure the time to mount a keyed list of 1 000 and 10 000 rows, including all framework setup, for StreetUI (`s.listOf`) and equivalent constructs in React, Vue, Svelte, and Solid; all five frameworks SHALL use the same row data structure (id: number, label: string).
4. WHEN benchmark C (list partial row swap) is executed, THE Competitor_Harness SHALL measure the time to swap every tenth row in an already-mounted list of 1 000 rows for all five frameworks.
5. WHEN benchmark D (list teardown) is executed, THE Competitor_Harness SHALL measure the time to fully unmount/destroy a mounted list of 1 000 rows for all five frameworks.
6. WHEN benchmark E (SSR throughput) is executed, THE Competitor_Harness SHALL measure the number of `renderToString`-equivalent calls per second for a 500-node tree across all five frameworks that provide a server rendering API; WHERE a framework does not provide an SSR API, THE Competitor_Harness SHALL record a `"N/A"` result for that framework; this criterion is void if benchmark E is not executed.
7. WHEN benchmark F (hydration time) is executed, THE Competitor_Harness SHALL measure the time to hydrate (adopt server-rendered HTML) a 500-node tree for all five frameworks that support hydration; WHERE a framework has no hydration API, THE Competitor_Harness SHALL record a `"N/A"` result for that framework.
8. WHEN benchmark G (real-browser interactive) is executed, THE Competitor_Harness SHALL launch a headless Chromium instance via Playwright, load a StreetUI-rendered page, measure the wall-clock time from page load to the completion of a button-click event handler, and record the result; WHERE browser automation for a competitor is not feasible within the monorepo environment, THE Competitor_Harness SHALL record a `"browser-manual"` placeholder and document the limitation in the Performance_Report.
9. WHEN benchmark H (memory) is executed, THE Competitor_Harness SHALL mount a 1 000-row list, call `global.gc()` (Node run with `--expose-gc`), record `process.memoryUsage().heapUsed` immediately after GC, unmount the list, call `global.gc()` again, and record heap after second GC; THE Benchmark_Suite SHALL report both mount-peak and post-unmount-cleanup values for StreetUI and all competitors that expose a programmatic mount/unmount API.
10. THE Competitor_Harness SHALL run all competitor workloads in the same Node.js process as StreetUI workloads, using `happy-dom` as the shared DOM environment, to ensure a consistent measurement floor.
11. THE Competitor_Harness SHALL collect results using the same `bench()` / `summarize()` / `BenchResult` types from the existing harness, and SHALL emit them into the unified `BenchSuiteResult` alongside StreetUI results so the existing `compareResults` and `formatResults` functions work unchanged.
12. WHEN a competitor framework cannot be loaded (missing install, import error), THE Competitor_Harness SHALL emit a warning to stderr and mark that framework's results as `"skipped"` in the output JSON rather than crashing the whole run.

---

### Requirement 4: StreetUI Profiling and Bottleneck Identification

**User Story:** As a performance engineer, I want a structured profiling step that identifies StreetUI's actual hot paths from the baseline data, so that every optimisation attempt is evidence-driven rather than speculative.

#### Acceptance Criteria

1. WHEN profiling is executed, THE Profiler SHALL run StreetUI's six most expensive baseline categories (by median ms at the largest N) under Node.js CPU profiling and produce at least one `.cpuprofile` file per profiling run.
2. THE Profiler SHALL produce a human-readable hot-path summary file at `packages/benchmarks/results/hotpaths.md` that lists, for each profiled category, the top five self-time functions with their package, function name, self-time percentage, and a brief annotation of whether optimisation is feasible.
3. THE `hotpaths.md` file SHALL use the table format: `| Function | Package | Self-time % | Feasible? | Notes |`.
4. WHEN the hot-path analysis identifies a function with self-time ≥ 3% in any profile, THE `hotpaths.md` file SHALL mark that function as `"High"` priority; WHEN self-time is between 1% and 3% THE function SHALL be marked `"Medium"`; WHEN self-time is below 1% THE function SHALL be marked `"Low"`.
5. THE hot-path summary SHALL explicitly state which hot paths are not actionable (e.g. native DOM in happy-dom, V8 GC, third-party internals) and exclude them from the priority table.
6. IF no StreetUI-owned function exceeds 1% self-time in any profile, THE `hotpaths.md` file SHALL record this as a valid "no significant bottleneck" finding and proceed to the re-run phase without applying any optimisation.

---

### Requirement 5: Evidence-Backed Optimisations

**User Story:** As a framework maintainer, I want targeted, measured optimisations applied to StreetUI's internals based on profiling evidence, so that v1.1 ships real performance gains without guessing.

#### Acceptance Criteria

1. WHEN an optimisation is proposed, THE Optimisation SHALL target only functions or allocation patterns that appear in the `hotpaths.md` priority table as `"High"` or `"Medium"` priority.
2. THE Optimisation SHALL be applied exclusively inside `packages/compiler/`, `packages/renderer/`, `packages/scheduler/`, `packages/state/`, or `packages/graph/` source files; no other workspace package SHALL be modified for performance reasons.
3. THE Optimisation SHALL preserve the DSL → Compiler → SAG → Runtime → DOM pipeline: the public `compile()`, `createRenderer()`, `renderToString()`, `hydrate()`, `signal()`, `derived()`, `batch()`, `effect()`, `streetui.app()`, and all router/forms/i18n/context/resource APIs SHALL have identical signatures and semantics after any optimisation.
4. THE Optimisation SHALL NOT introduce a virtual DOM representation, JSX transform, or any second reactive system into the framework.
5. THE Optimisation SHALL NOT add any new runtime dependency to any package other than `@streetui/benchmarks`.
6. WHEN an optimisation is applied, THE Benchmark_Suite SHALL measure the same benchmarks again under identical conditions before the optimisation result is retained; IF the re-run shows no improvement (delta within ±2% noise band) OR introduces any regression (any benchmark worsening by more than 5%), THE Optimisation SHALL be reverted and documented as a measured-but-deferred item in `hotpaths.md`.
7. WHEN an optimisation is reverted, THE `hotpaths.md` file SHALL record the measured delta that prompted the revert decision.
8. THE Optimisation count SHALL be at least one and at most ten applied changes; beyond ten, further candidates SHALL be deferred to a later release.
9. WHILE the 631 passing tests from v1.0 are the protected baseline, THE Optimisation SHALL leave all 631 tests passing; no test SHALL be weakened, deleted, or skipped to accommodate an optimisation.

---

### Requirement 6: Post-Optimisation Re-run and Delta Capture

**User Story:** As a performance engineer, I want a full re-run of the A–H harness after optimisations, so that the delta report reflects exactly what changed and what the honest competitive position is.

#### Acceptance Criteria

1. WHEN the post-optimisation run is executed, THE Benchmark_Suite SHALL execute the complete A–H cross-framework harness under the same Node version, machine, and `happy-dom` version as the baseline run where possible; IF environmental drift is detected (different Node version, OS, or `happy-dom` version), THE Benchmark_Suite SHALL log a warning to stderr noting the drift and then proceed to produce the delta report.
2. WHEN the post-optimisation run completes, THE Benchmark_Suite SHALL write results to `packages/benchmarks/results/current.json`, overwriting any previous current file.
3. THE Delta_Report SHALL be produced by passing `baseline.json` and `current.json` through the existing `compareResults()` function and rendered using `formatComparison()`.
4. THE Delta_Report SHALL include every benchmark name, baseline median ms, current median ms, delta percentage, and status (improved / regressed / unchanged / new).
5. WHEN a benchmark shows a delta percentage with absolute value less than 2%, THE Delta_Report SHALL mark it `"unchanged"` regardless of sign.
6. WHEN a benchmark shows an improvement of more than 2%, THE Delta_Report SHALL mark it `"improved"`.
7. WHEN a benchmark shows a regression of more than 5%, THE Delta_Report SHALL flag it `"regressed"` and THE Benchmark_Suite SHALL exit with a non-zero exit code.
8. THE Delta_Report SHALL be persisted to `packages/benchmarks/results/delta.json` in addition to being printed to stdout.

---

### Requirement 7: §30 Structured Performance Report

**User Story:** As a framework user or evaluator, I want a structured, honest performance report that shows exactly how StreetUI compares to React, Vue, Svelte, and Solid on real benchmarks, so that I can make an informed adoption decision.

#### Acceptance Criteria

1. THE Performance_Report SHALL be written to `packages/benchmarks/results/v1.1-report.md` as a markdown document.
2. THE Performance_Report SHALL contain exactly thirty numbered sections (§1–§30), with the following required sections: §1 Executive Summary, §2 Methodology, §3 Environment, §4 Framework Versions, §5–§12 Benchmark A–H Results (one section each), §13 StreetUI Baseline vs Post-Optimisation Delta, §14–§23 Optimisation Log (one section per applied or deferred optimisation, up to ten applied + deferred), §24 Bundle Size Reference, §25 Test Suite Integrity, §26 Known Limitations, §27 Competitive Standing, §28 Honest Assessment, §29 Public API Integrity, §30 Conclusion.
3. THE Performance_Report §4 SHALL reproduce the exact contents of `framework-versions.json`.
4. FOR each benchmark category A–H, THE Performance_Report SHALL include a result table with columns: Framework, Metric, N (where applicable), Median ms, Ops/sec (where applicable), and a Notes column.
5. THE Performance_Report §27 (Competitive Standing) SHALL state explicitly for each framework pair (StreetUI vs React, StreetUI vs Vue, StreetUI vs Svelte, StreetUI vs Solid) and for each benchmark category whether StreetUI leads, trails, or is within noise of the competitor; no result SHALL be presented in a misleading framing.
6. THE Performance_Report §28 (Honest Assessment) SHALL include at least one sentence identifying a benchmark category where StreetUI trails all competitors, explaining the architectural reason, and stating whether the gap is expected to close in a future release.
7. THE Performance_Report §29 SHALL list every public API that existed in v1.0.0 and confirm it is unchanged in v1.1.
8. THE Performance_Report §2 (Methodology) SHALL describe: the measurement environment (Node version, OS, happy-dom version, `--expose-gc` flag for H); the warmup and iteration counts used; the noise floor (minimum delta to claim "improved"); and the rule for reverting a non-improving optimisation.
9. THE Performance_Report SHALL contain no invented or estimated numbers; every figure SHALL be traceable to either `baseline.json`, `current.json`, or an inline benchmark result captured during the report run; IF any required benchmark category produced no valid data (was skipped, errored, or requires `--expose-gc` and was not run with that flag), THE Performance_Report generation SHALL fail entirely and produce no output file until all required benchmarks succeed.

---

### Requirement 8: Build, Typecheck, and Test Gate Preservation

**User Story:** As a CI maintainer, I want the v1.0 build, typecheck, and test gates to remain passing throughout v1.1 work, so that the release pipeline is never broken by benchmarking or optimisation changes.

#### Acceptance Criteria

1. WHILE v1.1 development is in progress, THE Benchmark_Suite SHALL remain a private package (no `publishConfig.access: "public"` and `"private": true` in its `package.json`) and SHALL NOT be added to the npm publish manifest.
2. WHEN `turbo run build` is executed, THE build task SHALL complete successfully for at least 28 packages (the v1.0 count plus any new tasks introduced by benchmark infrastructure changes); a higher task count is a valid pass.
3. WHEN `turbo run typecheck` is executed, THE typecheck task SHALL complete successfully for all packages including `@streetui/benchmarks`.
4. WHEN `turbo run test` is executed, THE test task SHALL report at least 631 passing tests (the v1.0 baseline) across all packages; no previously passing test SHALL be in a failing or skipped state.
5. THE `@streetui/benchmarks` package SHALL NOT be imported by any non-benchmark workspace package; benchmark code SHALL remain isolated behind the private package boundary.
6. WHEN competitor packages are installed as devDependencies in `packages/benchmarks/`, THE workspace root `package.json` and all other workspace packages SHALL remain unchanged.
7. THE `streetui` unified public package tarball SHALL remain free of any `@streetui/benchmarks`, React, Vue, Svelte, or Solid import or dependency after bundling.

---

### Requirement 9: Benchmark Infrastructure Integrity

**User Story:** As a benchmark author, I want the benchmark harness to be self-validating and deterministic, so that results are trustworthy and not artefacts of harness bugs.

#### Acceptance Criteria

1. THE Benchmark_Suite SHALL include at least 12 harness correctness tests covering: `summarize()` statistical accuracy (median, p95, min, max, mean); `bench()` setup/run/teardown invocation counts; `environment()` field completeness; `compareResults()` status classification (improved, regressed, unchanged, new); and the new framework-versions validation logic.
2. WHEN a benchmark result is written to JSON, THE Benchmark_Suite SHALL verify that the JSON is valid (parseable) and that each result entry contains the required fields (`name`, `category`, `n`, `samples`, `inner`, `medianMs`, `p95Ms`, `minMs`, `maxMs`, `meanMs`, `opsPerSec`).
3. THE Competitor_Harness SHALL be structured so that each competitor adapter is an independent module implementing a shared `CompetitorAdapter` interface; adding a sixth competitor SHALL require creating one new adapter file and one entry in the adapter registry with no changes to the harness runner.
4. THE harness correctness tests SHALL continue to pass as part of `turbo run test` without requiring `--expose-gc` or a live browser.
5. WHEN the Chromium-dependent benchmark G is run without a Playwright installation, THE Competitor_Harness SHALL detect the absence, skip benchmark G, record a `"skipped-no-playwright"` status, and continue with benchmarks A–F and H without error.
6. WHEN the harness is run with `--suite=a,b` (or equivalent filter), THE Benchmark_Suite SHALL execute only the specified benchmark categories and produce a partial result file; this SHALL NOT corrupt an existing `baseline.json` or `current.json` unless the appropriate target file flag is also passed.
