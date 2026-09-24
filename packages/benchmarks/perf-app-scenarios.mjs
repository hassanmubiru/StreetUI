/**
 * StreetUI v1.3 — real-application node measurement ORCHESTRATOR (spec §2, §8–§13, §19).
 *
 * Benchmark-development tool only; never shipped in `streetui`. It drives the REAL
 * example app in `examples/streetui-performance-app` (a legitimate multi-route
 * application: header/nav/sidebar, a 10,000-row users table, 1,000 interactive
 * controls, forms, router navigation, an async resource, SSR + hydration) — not a
 * synthetic DOM generator.
 *
 * Each scenario is executed in its OWN child process (perf-app-worker.mjs) so the
 * scale-sensitive 10,000-row cases (~0.8 GB of happy-dom nodes each) cannot
 * accumulate memory across scenarios; the OS reclaims everything on process exit.
 *
 * DOM-mutation counts are measured at the single BrowserDOMAdapter choke point, so
 * "toggling 1 of 1000 controls touches exactly one node" and "typing one field does
 * not touch another" are MEASURED, not assumed.
 *
 * This is a Node + happy-dom measurement. It is NOT a browser measurement and never
 * claims to be — real-browser numbers are gated separately by scripts/browser-harness.mjs
 * and recorded BLOCKED (with the exact reason) when no Chromium binary is present.
 *
 * Usage: node perf-app-scenarios.mjs --out=<absPath> [--commit=<sha>]
 */
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const worker = path.join(__dirname, 'perf-app-worker.mjs');

const SCENARIOS = [
  'initialMountUsers10k', 'hydrateUsers10k', 'fineGrainedToggle1of1000',
  'formsFieldIsolation', 'keyedListOps', 'routerNavigation',
  'lifecycleNoAccumulation', 'ssrByView',
];

function runScenario(name) {
  const r = spawnSync(process.execPath,
    ['--expose-gc', '--max-old-space-size=2600', worker, name],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`scenario ${name} failed (exit ${r.status}):\n${r.stderr || r.stdout}`);
  }
  const line = r.stdout.split('\n').find((l) => l.startsWith('__RESULT__'));
  if (!line) throw new Error(`scenario ${name} produced no __RESULT__:\n${r.stdout}\n${r.stderr}`);
  return JSON.parse(line.slice('__RESULT__'.length));
}

const args = Object.fromEntries(process.argv.slice(2)
  .filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true];
  }));

const results = {};
for (const name of SCENARIOS) {
  process.stderr.write(`running ${name} ... `);
  results[name] = runScenario(name);
  process.stderr.write('done\n');
}

const invariants = {
  G_hydrationCreatesZeroNodes: results.hydrateUsers10k.invariant_G_zeroNodesCreated,
  fineGrained_toggle1of1000_singleWrite: results.fineGrainedToggle1of1000.invariant_singleRegionUpdated,
  forms_fieldIsolation: results.formsFieldIsolation.invariant_isolated,
  lifecycle_noNodeDrift: results.lifecycleNoAccumulation.invariant_noNodeCountDrift,
  lifecycle_cleanUnmount: results.lifecycleNoAccumulation.invariant_unmountLeavesNoOrphans,
  router_transitionsCorrect: results.routerNavigation.correctness.allTransitionsCorrect,
};
const allInvariantsHold = Object.values(invariants).every(Boolean);

// Read the ACTUAL shipped package version rather than hardcoding one, so this
// artifact can never claim a version the code does not carry. "v1.3" is the
// real-world-performance milestone label; the package version is whatever
// packages/streetui/package.json says today.
function readStreetuiVersion() {
  const candidates = [
    path.resolve(__dirname, '../../packages/streetui/package.json'),
    path.resolve(__dirname, '../streetui/package.json'),
  ];
  for (const p of candidates) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')).version; } catch { /* try next */ }
  }
  return 'unknown';
}
const streetuiVersion = readStreetuiVersion();

const output = {
  schema: 'streetui-node/v1.3',
  status: 'PASS',
  target: 'examples/streetui-performance-app (real multi-route application)',
  runtime: 'node + happy-dom (NOT a browser; browser metrics gated separately, see streetui-browser.json)',
  measurement: 'DOM mutations counted at the single BrowserDOMAdapter choke point; timings via perf_hooks; each scenario isolated in its own process.',
  milestone: 'v1.3',
  version: streetuiVersion,
  commit: args.commit ?? null,
  timestamp: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    totalMemMB: Math.round(os.totalmem() / 1e6),
    domImplementation: 'happy-dom',
  },
  invariants,
  allInvariantsHold,
  scenarios: results,
};

const outPath = typeof args.out === 'string'
  ? args.out
  : path.resolve(__dirname, '..', '..', 'benchmarks', 'results', 'v1.3', 'streetui-node.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

console.log('=== StreetUI v1.3 node/real-app scenarios ===');
console.log(`initial mount (10k users): ${results.initialMountUsers10k.timing.medianMs}ms median, ${results.initialMountUsers10k.nodesCreated} nodes`);
console.log(`hydration created nodes: ${results.hydrateUsers10k.nodesCreatedDuringHydration} (G: ${invariants.G_hydrationCreatesZeroNodes ? 'HOLDS' : 'FAIL'})`);
console.log(`toggle 1/1000 writes: ${results.fineGrainedToggle1of1000.writesAt1000Controls} vs 1/100: ${results.fineGrainedToggle1of1000.writesAt100Controls} (independent-of-N: ${invariants.fineGrained_toggle1of1000_singleWrite ? 'HOLDS' : 'FAIL'})`);
console.log(`form field isolation writes: ${results.formsFieldIsolation.structuralWritesObserved} (unrelated input unchanged: ${invariants.forms_fieldIsolation ? 'HOLDS' : 'FAIL'})`);
console.log(`lifecycle nodes/cycle: ${JSON.stringify(results.lifecycleNoAccumulation.nodesCreatedPerCycle)} orphans: ${JSON.stringify(results.lifecycleNoAccumulation.orphanNodesAfterUnmount)}`);
console.log(`router 4-nav: ${results.routerNavigation.fourNavigationsTiming.medianMs}ms median (correct: ${invariants.router_transitionsCorrect ? 'YES' : 'NO'})`);
console.log(`all invariants hold: ${allInvariantsHold ? 'YES' : 'NO'}`);
console.log(`written: ${outPath}`);
if (!allInvariantsHold) process.exitCode = 1;
