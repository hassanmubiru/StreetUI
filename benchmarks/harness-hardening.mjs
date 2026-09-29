// DEV-ONLY benchmark artifact — StreetUI 2.2 Phase 3 harness hardening runner.
// NOT part of the `streetui` runtime. Run with: `node benchmarks/harness-hardening.mjs`
/**
 * Phase 3 reproducibility + standardized-capture gate. Everything here runs
 * fully in Node and emits ONE machine-readable file:
 *   benchmarks/results/v2.2/benchmark-harness.json
 *
 * It performs four checks, none of which fabricate a measurement:
 *
 *  1. STATS CORRECTNESS — `summarize()` on known inputs must produce the exact
 *     documented values (median/p95 selection identical to the legacy harness,
 *     plus mean/variance/stddev/cv). A mismatch aborts non-zero.
 *
 *  2. NODE REPRODUCIBILITY — a fixed, deterministic, pure-JS workload is timed
 *     with the standard warmup/measured loop across TWO independent runs. We
 *     assert the run is *stable* (coefficient of variation under a disclosed
 *     threshold and the two run medians agree within tolerance). This is a
 *     Node harness self-check ONLY — it is explicitly NOT a framework or
 *     browser performance claim.
 *
 *  3. ENVELOPE CONFORMANCE — the two envelopes emitted here MUST satisfy
 *     `validateEnvelope`; plus an informational sweep of results/v2.2/*.json.
 *
 *  4. BROWSER REPRODUCIBILITY — reported BLOCKED. Browser timings cannot be
 *     reproduced without a real browser; none exists (see environment gate).
 *     No happy-dom substitute, no fabricated variance.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  round, summarize, captureEnvironment, makeEnvelope, validateEnvelope,
} from './lib/bench-stats.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const OUT_DIR = join(HERE, 'results', 'v2.2');

/** Warmup + measured timing loop (sync fn) — mirrors measure.mjs, sync-only. */
function timeWorkload(fn, { warmup = 5, iterations = 25 } = {}) {
  for (let i = 0; i < warmup; i++) fn();
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return samples;
}

/** A deterministic, allocation-light integer workload (stable across runs). */
function fixedWorkload() {
  let acc = 0;
  for (let i = 1; i < 200_000; i++) acc = (acc + (i * 2654435761)) % 4294967296;
  return acc;
}

// ── Check 1: stats correctness (known-value lock) ────────────────────────────
function checkStats() {
  const s = summarize([2, 4, 4, 4, 5, 5, 7, 9]); // classic stddev=2 dataset
  const expect = (label, got, want) => {
    if (got !== want) throw new Error(`stats.${label}: got ${got}, want ${want}`);
  };
  expect('samples', s.samples, 8);
  expect('mean', s.mean, 5);
  expect('median', s.median, 5); // sorted[floor(8/2)] = sorted[4] = 5
  expect('p95', s.p95, 9); // sorted[min(7, ceil(7.6)-1)=7] = 9
  expect('min', s.min, 2);
  expect('max', s.max, 9);
  expect('variance', s.variance, 4); // population variance
  expect('stddev', s.stddev, 2);
  expect('cv', s.cv, round(2 / 5));
  // Single deterministic value → zero variance / cv.
  const one = summarize([3, 3, 3]);
  expect('zero-variance', one.variance, 0);
  expect('zero-cv', one.cv, 0);
  return { passed: true, dataset: [2, 4, 4, 4, 5, 5, 7, 9], summary: s };
}

// ── Check 2: Node reproducibility (deterministic workload) ───────────────────
const CV_THRESHOLD = 0.5; // disclosed: Node/VM timing is noisy; CV<0.5 = stable
const MEDIAN_DELTA_THRESHOLD = 0.35; // relative agreement of the two run medians

function checkReproducibility() {
  const run1 = summarize(timeWorkload(fixedWorkload));
  const run2 = summarize(timeWorkload(fixedWorkload));
  const denom = Math.min(run1.median, run2.median) || 1;
  const medianDeltaPct = round(Math.abs(run1.median - run2.median) / denom);
  const stable = run1.cv < CV_THRESHOLD && run2.cv < CV_THRESHOLD
    && medianDeltaPct < MEDIAN_DELTA_THRESHOLD;
  return {
    workload: 'deterministic integer mix, 200k iterations (pure JS, no DOM, no IO)',
    disclosure: 'Node/VM self-check ONLY. NOT a framework or browser performance claim; '
      + 'wall-clock timings on a shared VM are inherently noisy and are reported as such.',
    thresholds: { cv: CV_THRESHOLD, medianDeltaPct: MEDIAN_DELTA_THRESHOLD },
    run1, run2, medianDeltaPct, stable,
  };
}

// ── Check 3: envelope conformance ────────────────────────────────────────────
function checkConformance(envelopes) {
  const emitted = envelopes.map((e) => ({ name: e.name, ...validateEnvelope(e) }));
  const scan = [];
  for (const f of readdirSync(OUT_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const obj = JSON.parse(readFileSync(join(OUT_DIR, f), 'utf8'));
      const v = validateEnvelope(obj);
      scan.push({ file: f, schema: obj.schema ?? null, conformsToV1: v.valid, missing: v.missing });
    } catch (e) {
      scan.push({ file: f, error: String(e.message || e) });
    }
  }
  return { emitted, directoryScan: scan };
}

// ── Orchestrate + emit ───────────────────────────────────────────────────────
function main() {
  const environment = captureEnvironment(REPO_ROOT);

  const stats = checkStats();
  const repro = checkReproducibility();

  const workloadEnvelope = makeEnvelope({
    name: 'node-harness-reproducibility',
    unit: 'ms',
    config: { warmup: 5, iterations: 25, workload: repro.workload },
    metrics: { run1: repro.run1, run2: repro.run2 },
    environment,
    notes: repro.disclosure,
  });
  const statsEnvelope = makeEnvelope({
    name: 'stats-correctness-lock',
    unit: 'scalar',
    config: { fixture: stats.dataset },
    metrics: stats.summary,
    environment,
    notes: 'Known-value lock proving summarize() median/p95 match the legacy harness.',
  });

  const conformance = checkConformance([workloadEnvelope, statsEnvelope]);

  const browserReproducibility = {
    status: 'BLOCKED',
    reason: 'Browser benchmark reproducibility requires launching the same real browser '
      + 'repeatedly on this machine. No browser binary exists (see environment.browser + the '
      + '§0 environment gate). Browser variance/median stability therefore cannot be measured '
      + 'here. Per the anti-fabrication rule, no happy-dom substitute and no fabricated numbers '
      + 'are emitted; this gate stays BLOCKED until a real browser is present.',
  };

  const allEmittedConform = conformance.emitted.every((e) => e.valid);
  const gatePassed = stats.passed && repro.stable && allEmittedConform;

  const report = {
    schema: 'streetui-2.2-harness-hardening/v1',
    purpose: 'StreetUI 2.2 Phase 3 — standardized benchmark capture + reproducibility gate. '
      + 'All numbers are Node-measured in-environment; browser reproducibility stays BLOCKED.',
    capturedAt: new Date().toISOString(),
    environment,
    checks: {
      statsCorrectness: { passed: stats.passed, dataset: stats.dataset, summary: stats.summary },
      nodeReproducibility: repro,
      envelopeConformance: conformance,
      browserReproducibility,
    },
    standardizedCaptureFields: [
      'os', 'arch', 'cpuModel', 'cpuCores', 'memTotalGB', 'memFreeGB', 'node',
      'warmup', 'iterations(measuredRuns)', 'median', 'p95', 'min', 'max',
      'mean', 'variance', 'stddev', 'cv', 'raw', 'timestamp', 'gitRevision',
      'packageVersions', 'browserVersion(BLOCKED)',
    ],
    gatePassed,
    emittedEnvelopes: { workloadEnvelope, statsEnvelope },
  };

  const outFile = join(OUT_DIR, 'benchmark-harness.json');
  writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');

  console.log('[harness-hardening] stats correctness :', stats.passed ? 'PASS' : 'FAIL');
  console.log('[harness-hardening] node reproducibility:',
    repro.stable ? 'STABLE' : 'UNSTABLE',
    `(run1 cv=${repro.run1.cv}, run2 cv=${repro.run2.cv}, medianDeltaPct=${repro.medianDeltaPct})`);
  console.log('[harness-hardening] envelope conformance:', allEmittedConform ? 'PASS' : 'FAIL');
  console.log('[harness-hardening] browser reproducibility: BLOCKED (no browser)');
  console.log('[harness-hardening] gate:', gatePassed ? 'PASS' : 'FAIL');
  console.log('[harness-hardening] wrote', outFile);
  if (!gatePassed) process.exit(1);
}

main();
