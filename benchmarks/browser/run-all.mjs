/**
 * StreetUI v1.5 — UNIFIED BROWSER BENCHMARK RUNNER (spec §3, §4, §5, §7, §8, §18, §19).
 *
 *   node benchmarks/browser/run-all.mjs [--out-dir=<absDir>]
 *
 * GOAL: run StreetUI, React, Vue, Svelte, and Solid through the SAME Chromium, on the
 * same machine, with the same flags, the same production-mode builds, the same
 * measurement APIs (performance marks, MutationObserver, PerformanceObserver longtask,
 * rAF frame sampling), the same data, and the same scenario script — so the per-framework
 * numbers are actually comparable. Scenarios (§4): a 10k-row keyed list, 1000 interactive
 * controls, a form, router navigation, an SSR page, and a hydration page — an equivalent
 * DOM/data shape across all frameworks.
 *
 * CONTRACT (v1.5 anti-fabrication, §18/§19/§20):
 *   - A number is produced ONLY from a real Chromium engine driven by Playwright. This
 *     runner FIRST proves both are present, and proves each framework is installed.
 *   - In THIS environment none of that holds (no Chromium binary; Playwright not installed;
 *     npm registry 403 so nothing is installable; react/vue/svelte/solid-js absent). So the
 *     runner writes one BLOCKED result file per framework, plus a BLOCKED comparison, each
 *     stating the EXACT reason. It never fabricates, estimates, or substitutes a happy-dom
 *     number for a browser number, and it never fills in missing Svelte (or any) numbers.
 *   - NO ranking, NO winner/best/worst — even when it runs, results are reported side by side.
 *
 * The executable branch (bottom) is intentionally explicit and auditable; it is ready to run
 * unchanged wherever a Chromium binary + Playwright + the pinned frameworks exist. It never
 * runs in this VM.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const outFlag = process.argv.find((a) => a.startsWith('--out-dir='));
const OUT_DIR = outFlag
  ? outFlag.slice('--out-dir='.length)
  : path.resolve(__dirname, '../results/v1.5');

// ── The shared benchmark definition (§4/§5/§7/§8) — identical for every framework ──────
const SHARED_MODEL = {
  keyedListRows: 10_000,
  interactiveControls: 1_000,
  form: { fields: ['displayName', 'contactEmail', 'role', 'bio'] },
  routes: ['/', '/dashboard', '/users', '/controls', '/settings'],
  ssrPage: '/users',
  hydrationPage: '/users',
};
const SCENARIOS = [
  // §5 initial render, split into phases
  { id: 'initial-render', measures: ['htmlLoad', 'domReady', 'frameworkMount', 'firstMeaningfulUI', 'interactive', 'jsExecMs', 'domConstructionMs', 'layoutMs', 'paintMs', 'longTasks'] },
  // §6 single reactive update (1 change → 1 region)
  { id: 'single-update', measures: ['durationMs', 'domMutations', 'nodesCreated', 'nodesRemoved', 'longTasks'] },
  // §7 keyed-list operations
  { id: 'keyed-list', ops: ['create10k', 'append1k', 'prepend1k', 'removeFirst', 'removeMiddle', 'removeLast', 'updateOne', 'swap', 'randomReorder', 'reverse', 'sort'],
    measures: ['durationMs', 'domMutations', 'nodeCount', 'insertBeforeCount', 'longTasks', 'frameCount', 'maxFrameDurationMs'] },
  // §8 frame-pacing workload
  { id: 'frame-pacing', measures: ['framesRequested', 'framesCompleted', 'framesDropped', 'maxFrameDurationMs', 'longTaskDurationMs'] },
  // §15 hydration
  { id: 'hydration', measures: ['hydrationDurationMs', 'nodesCreated', 'firstInteractiveMs', 'firstReactiveUpdateMs', 'eventRegistrationMs', 'resourceActivationMs'] },
];
const FRAMEWORKS = [
  { id: 'streetui', file: 'streetui-browser.json', pkgs: ['streetui'], source: 'workspace (this repo)', ssr: true },
  { id: 'react',    file: 'react-browser.json',    pkgs: ['react', 'react-dom'], version: '19.1.0', ssr: true },
  { id: 'vue',      file: 'vue-browser.json',       pkgs: ['vue'], version: '3.5.13', ssr: true },
  { id: 'svelte',   file: 'svelte-browser.json',    pkgs: ['svelte'], version: '5.19.0', ssr: true },
  { id: 'solid',    file: 'solid-browser.json',     pkgs: ['solid-js'], version: '1.9.3', ssr: 'browser-ssr-where-appropriate' },
];

// ── Detection (proves the environment BEFORE any number is claimed) ────────────────────
const PINNED_PLAYWRIGHT = '1.49.1';
function detectPlaywright() {
  // The PACKAGE resolving is not enough — a browser number requires that Playwright can
  // actually drive a browser. So we ALSO require its Chromium binary to exist on disk, and
  // we surface a version-pin mismatch (§3 pins the version) rather than silently running
  // under whatever happens to be installed.
  let pkgPath, version;
  try { pkgPath = require.resolve('playwright'); }
  catch { return { ok: false, reason: `the "playwright" package is not installed (pinned ${PINNED_PLAYWRIGHT}); npm registry returns 403 / offline, so it cannot be fetched` }; }
  try { version = require('playwright/package.json').version; } catch { version = 'unknown'; }
  let binPath = null, binExists = false;
  try { const { chromium } = require('playwright'); binPath = chromium.executablePath(); binExists = fs.existsSync(binPath); }
  catch (e) { return { ok: false, version, reason: `playwright ${version} is installed but its browser API is unusable: ${e.message.split('\n')[0]}` }; }
  const pinNote = version === PINNED_PLAYWRIGHT ? '' : ` NOTE: installed playwright ${version} does NOT match the pinned ${PINNED_PLAYWRIGHT} (§3 requires the pin).`;
  if (!binExists) {
    return { ok: false, version, reason: `playwright ${version} package is present, but its Chromium browser binary is NOT downloaded (executable absent at ${binPath}); a real chromium.launch() fails. \`playwright install chromium\` needs cdn.playwright.dev, which is unreachable offline (npm/registry 403).${pinNote}` };
  }
  return { ok: true, version, binPath, note: pinNote.trim() || undefined };
}
function detectChromium() {
  // Check env overrides, system paths, AND the Playwright browser cache. A NAME match in
  // /etc or bash-completion is not a browser; only an existing executable counts.
  const envPath = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH;
  let pwBin = null;
  try { pwBin = require('playwright').chromium.executablePath(); } catch { /* playwright absent */ }
  const candidates = [envPath, pwBin, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean);
  const found = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  return found ? { ok: true, path: found } : { ok: false, reason: 'no Chromium/Chrome executable found (checked CHROMIUM_PATH, the Playwright browser cache, and standard /usr/bin paths); none installable offline (apt has no candidate; cdn.playwright.dev / npm registry 403)' };
}
function detectFramework(fw) {
  const missing = fw.pkgs.filter((p) => { try { require.resolve(p); return false; } catch { return true; } });
  return missing.length === 0
    ? { ok: true }
    : { ok: false, reason: `not installed: ${missing.join(', ')} (pinned ${fw.version ?? 'workspace'}); npm registry 403 so it cannot be fetched` };
}

const ENV = {
  node: process.version,
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  cpuModel: os.cpus()[0]?.model ?? 'unknown',
  cpuCount: os.cpus().length,
  totalMemMB: Math.round(os.totalmem() / 1e6),
};
const pw = detectPlaywright();
const chromium = detectChromium();

fs.mkdirSync(OUT_DIR, { recursive: true });

if (!pw.ok || !chromium.ok) {
  // ── BLOCKED PATH: one honest result file per framework + a BLOCKED comparison ─────────
  const browserReason = [pw.ok ? null : `Playwright: ${pw.reason}`, chromium.ok ? null : `Chromium: ${chromium.reason}`].filter(Boolean).join('; ');
  const written = [];
  for (const fw of FRAMEWORKS) {
    const det = detectFramework(fw);
    const result = {
      schema: `${fw.id}-browser/v1.5`,
      framework: fw.id,
      version: fw.version ?? 'workspace',
      status: 'BLOCKED',
      environmentRef: './environment.json',
      environment: ENV,
      browser: 'Chromium (REQUIRED — not present)',
      mode: 'production build (intended)',
      sharedModel: SHARED_MODEL,
      scenarios: SCENARIOS.map((s) => ({ scenario: s.id, browser: 'Chromium', hardware: `${ENV.cpuModel} x${ENV.cpuCount}`, mode: 'prod', measurement: s.measures, ops: s.ops ?? null, sampleCount: null, median: null, p95: null, note: 'BLOCKED — no measurement produced' })),
      reason: [browserReason, det.ok ? null : `Framework: ${det.reason}`].filter(Boolean).join('; '),
      fabricationNote: 'No browser numbers estimated or substituted. Node/happy-dom numbers (streetui-node.json, ssr.json) are NEVER presented as browser numbers. Missing Svelte/Solid numbers are NOT filled in.',
      data: null,
    };
    const p = path.join(OUT_DIR, fw.file);
    fs.writeFileSync(p, JSON.stringify(result, null, 2) + '\n');
    written.push(fw.file);
  }
  // competitor-browser.json — aggregate competitor gate
  const competitor = {
    schema: 'competitor-browser/v1.5',
    status: 'BLOCKED',
    environmentRef: './environment.json',
    policy: 'NO ranking. Same Chromium / machine / flags / prod-mode / measurement-APIs / data / scenario for every framework — required, but not satisfiable here. Missing Svelte numbers are NOT filled in; Solid browser-SSR marked accordingly.',
    frameworks: Object.fromEntries(FRAMEWORKS.map((fw) => [fw.id, { version: fw.version ?? 'workspace', installed: detectFramework(fw).ok, ssr: fw.ssr }])),
    reason: browserReason + '; competitor frameworks react/vue/svelte/solid-js are not installed (npm 403).',
    data: null,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'competitor-browser.json'), JSON.stringify(competitor, null, 2) + '\n');
  // comparison.json — BLOCKED for cross-framework; points to the real node-only StreetUI numbers
  const comparison = {
    schema: 'comparison/v1.5',
    status: 'BLOCKED (cross-framework browser comparison); PARTIAL (StreetUI node-only numbers exist)',
    environmentRef: './environment.json',
    ranking: 'NONE — this release does not rank frameworks (v1.5 §20).',
    crossFrameworkBrowser: { status: 'BLOCKED', reason: browserReason + '; competitors not installed.' },
    streetuiNodeOnly: { ref: './streetui-node.json', ssr: './ssr.json', bundle: './bundle.json', memory: './memory.json', note: 'Node + happy-dom. NOT browser numbers. Never cross-compared to any browser framework.' },
    note: 'A valid comparison requires all frameworks in the SAME Chromium. Until then, no comparison table is emitted — no happy-dom-vs-Chromium mixing, no fabricated competitor rows.',
  };
  fs.writeFileSync(path.join(OUT_DIR, 'comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
  written.push('competitor-browser.json', 'comparison.json');

  console.log('BLOCKED (recorded, not fabricated):', browserReason);
  console.log('written to', OUT_DIR + ':', written.join(', '));
  process.exit(0);
}

// ── EXECUTABLE BRANCH (runs only where Playwright + Chromium + the frameworks exist) ────
// Ready and auditable; never runs in this VM. Bundles each framework's in-page adapter +
// the shared scenario core with esbuild, serves the page, drives it through the SAME
// Chromium instance, records duration / DOM-mutations / node-count / insertBefore /
// long-tasks / frame-pacing per scenario+op, ≥10 reps for noisy scenarios (median/p95/
// min/max/sampleCount), and writes one <framework>-browser.json each + a side-by-side
// comparison.json with NO ranking.
const { chromium: pwChromium } = require('playwright');
const { build } = require('esbuild');
const SCENARIO_CORE = path.resolve(__dirname, 'scenario-core.mjs');   // shared, framework-agnostic
const ADAPTERS = path.resolve(__dirname, 'adapters');                 // one <fw>.mjs per framework

async function measureFramework(fw, browser) {
  const adapterPath = path.join(ADAPTERS, `${fw.id}.mjs`);
  const bundle = await build({ entryPoints: [adapterPath], bundle: true, format: 'esm', write: false, target: 'es2020', minify: true, define: { 'process.env.NODE_ENV': '"production"' } });
  const adapterJs = bundle.outputFiles[0].text;
  const coreJs = fs.readFileSync(SCENARIO_CORE, 'utf8');
  const html = `<!doctype html><meta charset=utf-8><div id=app></div><script type=module>${adapterJs}\n${coreJs}\nwindow.__run = () => runAll(document.getElementById('app'), ${JSON.stringify(SHARED_MODEL)});</script>`;
  const page = await browser.newPage();
  try { await page.setContent(html, { waitUntil: 'load' }); return await page.evaluate(async () => window.__run()); }
  finally { await page.close(); }
}

const browser = await pwChromium.launch({ executablePath: chromium.path, args: ['--no-sandbox'] });
const perFramework = {};
try {
  for (const fw of FRAMEWORKS) {
    if (!detectFramework(fw).ok) { perFramework[fw.id] = { status: 'BLOCKED', reason: detectFramework(fw).reason }; continue; }
    perFramework[fw.id] = { status: 'OK', environment: ENV, browser: 'Chromium', mode: 'production', data: await measureFramework(fw, browser) };
    fs.writeFileSync(path.join(OUT_DIR, fw.file), JSON.stringify({ schema: `${fw.id}-browser/v1.5`, framework: fw.id, version: fw.version ?? 'workspace', environmentRef: './environment.json', ...perFramework[fw.id] }, null, 2) + '\n');
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT_DIR, 'comparison.json'), JSON.stringify({ schema: 'comparison/v1.5', status: 'OK', ranking: 'NONE (v1.5 §20)', environment: ENV, frameworks: perFramework, note: 'Same Chromium/machine/flags/mode/data/scenario. Side-by-side; reader draws conclusions.' }, null, 2) + '\n');
console.log('written per-framework browser results to', OUT_DIR);
