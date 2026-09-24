// DEV-ONLY benchmark artifact — StreetUI real-app run orchestrator. NOT part of the `streetui` runtime.
/**
 * StreetUI v1.3 — StreetUI-side benchmark orchestrator (spec §19, §20, §22).
 *
 *   node benchmarks/run-streetui.mjs [--reuse-node] [--commit=<sha>]
 *
 * Runs every StreetUI-side measurement against the REAL example application
 * (examples/streetui-performance-app) and records honest PASS / BLOCKED results —
 * never fabricated numbers. Steps:
 *
 *   1. Node real-app harness  → benchmarks/results/v1.3/streetui-node.json
 *      (packages/benchmarks/perf-app-scenarios.mjs — per-scenario child processes;
 *       happy-dom, NOT a browser). `--reuse-node` skips this if the file exists.
 *   2. Minified bundle sizes  → benchmarks/results/v1.3/bundle.json
 *      (scripts/bundle-sizes.mjs — esbuild minify + gzip + brotli, §14).
 *   3. Real-browser harness   → benchmarks/results/v1.3/streetui-browser.json
 *      (scripts/browser-harness.mjs — records BLOCKED when no Chromium; §3).
 *   4. Regression gates vs the measured v1.2 baseline → benchmarks/results/v1.3/regression-gates.json (§20).
 *   5. Environment record     → benchmarks/results/v1.3/environment.json (§19).
 *
 * A BLOCKED sub-step (e.g. the browser harness) does not fail the run; it is
 * recorded with its exact reason. The process exit code is non-zero only if a
 * regression GATE fails (an invariant regressed or the bundle grew).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const v13 = path.join(here, 'results', 'v1.3');
fs.mkdirSync(v13, { recursive: true });

const args = new Set(process.argv.slice(2));
const commit = (process.argv.slice(2).find((a) => a.startsWith('--commit=')) || '').split('=')[1] || null;
const reuseNode = args.has('--reuse-node');

const nodeOut = path.join(v13, 'streetui-node.json');
const bundleOut = path.join(v13, 'bundle.json');
const browserOut = path.join(v13, 'streetui-browser.json');
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const run = (label, file, extra = []) => {
  process.stderr.write(`\n[run-streetui] ${label} ...\n`);
  const r = spawnSync(process.execPath, [file, ...extra],
    { stdio: 'inherit', maxBuffer: 64 * 1024 * 1024 });
  return { label, file, status: r.status, ok: r.status === 0 };
};

const steps = [];

// 1 — node real-app harness ────────────────────────────────────────────────
if (reuseNode && fs.existsSync(nodeOut)) {
  steps.push({ label: 'node-harness', reused: true, ok: true });
  process.stderr.write('[run-streetui] node-harness: reusing existing streetui-node.json\n');
} else {
  steps.push(run('node real-app harness',
    path.join(repo, 'packages', 'benchmarks', 'perf-app-scenarios.mjs'),
    [`--out=${nodeOut}`, ...(commit ? [`--commit=${commit}`] : [])]));
}

// 2 — minified bundle sizes ──────────────────────────────────────────────────
steps.push(run('minified bundle sizes', path.join(repo, 'scripts', 'bundle-sizes.mjs'),
  [`--out=${bundleOut}`]));

// 3 — real-browser harness (records BLOCKED honestly) ────────────────────────
steps.push(run('real-browser harness', path.join(repo, 'scripts', 'browser-harness.mjs')));

// ── gather results ───────────────────────────────────────────────────────────
const nodeRes = readJson(nodeOut);
const bundleRes = readJson(bundleOut);
const browserRes = readJson(browserOut);

// 4 — regression gates vs the measured v1.2 baseline (§20) ───────────────────
// The v1.3 workload is a DIFFERENT, larger real app, so absolute timings are NOT
// comparable to v1.2's synthetic scenarios. We gate only on facts that ARE
// comparable and must not regress: the framework invariants and the bundle size.
const V12 = {
  bundleUnminifiedFullBarrelGzip: 28764, // measured v1.2 (packages/streetui/dist/index.js)
  singleUpdateDomMutations: 1,           // v1.2 B_singleUpdate.domMutations
  hydrationNodesCreated: 0,              // v1.2 G invariant
};

const inv = nodeRes?.invariants ?? {};
const currentUnminGzip = bundleRes?.reconciliation?.currentUnminifiedFullBarrel?.gzip ?? null;

const gates = [
  { id: 'hydration_creates_zero_nodes',
    pass: inv.G_hydrationCreatesZeroNodes === true,
    detail: `v1.3 nodesCreatedDuringHydration must be 0 (v1.2 baseline ${V12.hydrationNodesCreated})` },
  { id: 'fine_grained_update_independent_of_N',
    pass: inv.fineGrained_toggle1of1000_singleWrite === true,
    detail: 'toggling 1 of N controls writes a constant number of regions regardless of N (fine-grained property)' },
  { id: 'forms_field_isolation',
    pass: inv.forms_fieldIsolation === true,
    detail: 'typing one field does not mutate an unrelated field (DOM-level proof)' },
  { id: 'lifecycle_no_node_drift',
    pass: inv.lifecycle_noNodeDrift === true,
    detail: 'repeated mount/unmount cycles create an identical node count each cycle' },
  { id: 'lifecycle_clean_unmount',
    pass: inv.lifecycle_cleanUnmount === true,
    detail: 'unmount leaves zero orphan nodes' },
  { id: 'router_transitions_correct',
    pass: inv.router_transitionsCorrect === true,
    detail: 'all router transitions render the correct route' },
  { id: 'bundle_no_regression',
    pass: currentUnminGzip !== null && currentUnminGzip <= V12.bundleUnminifiedFullBarrelGzip,
    detail: `unminified full-barrel gzip must be <= v1.2 baseline ${V12.bundleUnminifiedFullBarrelGzip}; measured ${currentUnminGzip}` },
];
const allGatesPass = gates.every((g) => g.pass);

fs.writeFileSync(path.join(v13, 'regression-gates.json'), JSON.stringify({
  schema: 'streetui-regression/v1.3',
  status: allGatesPass ? 'PASS' : 'FAIL',
  comparedAgainst: 'measured v1.2 baseline (benchmarks/results/streetui.json + baseline-v1.2-start.json)',
  note:
    'Only invariants and bundle size are gated. Absolute timings are NOT gated: the v1.3 workload is a ' +
    'different, larger real application (a 10,000-row route in a full multi-route app) than the v1.2 ' +
    'synthetic scenarios, so cross-version timing deltas would be meaningless. See methodology.md.',
  v12Baseline: V12,
  gates,
  allGatesPass,
  timestamp: new Date().toISOString(),
}, null, 2) + '\n');

// 5 — environment record (§19) ────────────────────────────────────────────────
fs.writeFileSync(path.join(v13, 'environment.json'), JSON.stringify({
  schema: 'streetui-environment/v1.3',
  timestamp: new Date().toISOString(),
  commit,
  host: {
    node: process.version,
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    totalMemMB: Math.round(os.totalmem() / 1e6),
    freeMemMB: Math.round(os.freemem() / 1e6),
  },
  runs: {
    nodeRealApp: {
      status: nodeRes ? (nodeRes.allInvariantsHold ? 'PASS' : 'FAIL') : 'NOT_RUN',
      runtime: 'node + happy-dom (NOT a browser)',
      file: 'streetui-node.json',
    },
    bundleSizes: {
      status: bundleRes?.status ?? 'NOT_RUN',
      file: 'bundle.json',
    },
    realBrowser: {
      status: browserRes?.status ?? 'NOT_RUN',
      reason: browserRes?.reason ?? null,
      file: 'streetui-browser.json',
    },
    competitors: {
      status: 'BLOCKED',
      reason: 'npm registry unreachable offline (E403); no Chromium/Playwright. See competitors.json.',
      file: 'competitors.json',
      runner: 'benchmarks/run-competitors.mjs',
    },
  },
  regressionGates: { status: allGatesPass ? 'PASS' : 'FAIL', file: 'regression-gates.json' },
  steps,
}, null, 2) + '\n');

process.stderr.write('\n[run-streetui] summary\n');
for (const g of gates) process.stderr.write(`  gate ${g.id}: ${g.pass ? 'PASS' : 'FAIL'}\n`);
process.stderr.write(`  node invariants: ${nodeRes?.allInvariantsHold ? 'HOLD' : (nodeRes ? 'FAIL' : 'NOT_RUN')}\n`);
process.stderr.write(`  bundle: ${bundleRes?.status ?? 'NOT_RUN'}  browser: ${browserRes?.status ?? 'NOT_RUN'}\n`);
process.stderr.write(`  regression gates: ${allGatesPass ? 'PASS' : 'FAIL'}\n`);
process.stderr.write(`  wrote environment.json, regression-gates.json to ${v13}\n`);

if (!allGatesPass) process.exitCode = 1;
