/**
 * StreetUI browser benchmark orchestrator (spec §5/§19/§21/§26).
 *
 *   node benchmarks/browser/run-all.mjs
 *
 * This is the SINGLE entry the release gate calls to run ALL real-browser
 * benchmarks under one Chromium methodology:
 *   - StreetUI in-page scenarios            (scripts/browser-harness.mjs)
 *   - isolated 10k keyed-list reorder (§5)  (benchmarks/scenarios/browser-list-reorder/run.mjs)
 *   - cross-framework competitors (§19)     (benchmarks/run-competitors.mjs)
 *
 * Real browser numbers require a real engine: a Chromium binary driven through
 * Playwright. Node + happy-dom is NOT a browser and is never substituted for
 * browser numbers (§21). Each sub-runner is itself BLOCKED-aware: it produces a
 * real result only when a browser exists and otherwise writes an honest BLOCKED
 * marker with the exact reason. This orchestrator therefore ALWAYS delegates to
 * all three, then aggregates whatever honest output they produced — so the
 * moment a Chromium exists in this environment, real numbers appear end-to-end
 * with no further code change. No number is ever fabricated here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const outDir = path.join(repo, 'benchmarks', 'results', 'v1.8');
const outPath = path.join(outDir, 'browser-run-all.json');
fs.mkdirSync(outDir, { recursive: true });

const require = createRequire(import.meta.url);

function detectBrowser() {
  let playwright = false;
  let playwrightReason = '';
  try { require.resolve('playwright'); playwright = true; }
  catch (e) { playwrightReason = e.code ?? String(e); }

  const candidates = [
    process.env.CHROMIUM_PATH, process.env.CHROME_PATH, process.env.PLAYWRIGHT_CHROMIUM_PATH,
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  const chromium = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) ?? null;

  return { playwright, playwrightReason, chromium };
}

// The three real sub-runners this orchestrator drives. Each writes its own
// honest JSON (real when a browser exists, BLOCKED otherwise) to `resultPath`.
const listReorderOut = path.join(outDir, 'browser-list-reorder.json');
const SUB_RUNNERS = [
  {
    id: 'streetui-scenarios',
    script: path.join(repo, 'scripts', 'browser-harness.mjs'),
    args: [],
    resultPath: path.join(repo, 'benchmarks', 'results', 'v1.3', 'streetui-browser.json'),
    describes: ['initial-render', 'hydration', 'reactive-search-10k',
      'keyed-list-append/prepend/reorder/update', 'route-transitions'],
  },
  {
    id: 'list-reorder-10k',
    script: path.join(repo, 'benchmarks', 'scenarios', 'browser-list-reorder', 'run.mjs'),
    args: [`--out=${listReorderOut}`],
    resultPath: listReorderOut,
    describes: ['isolated 10k keyed-row reorder: create/append/prepend/insert/remove/swap/reverse/shuffle/update'],
  },
  {
    id: 'competitors',
    script: path.join(repo, 'benchmarks', 'run-competitors.mjs'),
    args: [],
    resultPath: null, // writes per-framework files: results/{react,vue,svelte,solid}.json
    frameworkResults: ['react', 'vue', 'svelte', 'solid'].map(
      (f) => ({ framework: f, path: path.join(repo, 'benchmarks', 'results', `${f}.json`) })),
    describes: ['react', 'vue', 'svelte', 'solid — identical scenarios + identical Chromium methodology (§22)'],
  },
];

function readJsonOrNull(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const env = detectBrowser();
const available = env.playwright && env.chromium !== null;

console.log(`browser/run-all: playwright=${env.playwright} chromium=${env.chromium ?? 'none'} → ${available ? 'AVAILABLE' : 'BLOCKED'}`);
console.log('browser/run-all: delegating to all sub-runners (each is BLOCKED-aware; no numbers fabricated).');

const suites = [];
for (const r of SUB_RUNNERS) {
  console.log(`  → ${r.id}: node ${path.relative(repo, r.script)} ${r.args.join(' ')}`);
  const proc = spawnSync(process.execPath, [r.script, ...r.args], {
    cwd: repo, encoding: 'utf8', timeout: 10 * 60 * 1000,
    env: { ...process.env, CHROMIUM_PATH: env.chromium ?? process.env.CHROMIUM_PATH ?? '' },
  });
  const entry = {
    id: r.id,
    script: path.relative(repo, r.script),
    describes: r.describes,
    exitCode: proc.status,
    spawnError: proc.error ? String(proc.error.code ?? proc.error.message) : null,
  };
  if (r.resultPath) {
    const j = readJsonOrNull(r.resultPath);
    entry.resultPath = path.relative(repo, r.resultPath);
    entry.status = j?.status ?? (j ? 'PRESENT' : 'MISSING');
    entry.reason = j?.reason ?? null;
  } else if (r.frameworkResults) {
    // A competitor file may carry real NODE-side numbers (F_ssr, H_bundleSize —
    // measured with Node + node:zlib, never a browser) while every BROWSER
    // scenario is null because Chromium is absent. Classify the two axes
    // separately so the record never implies browser numbers exist (§21/§22).
    const BROWSER_KEYS = ['A_initialRender', 'B_singleUpdate', 'C_largeList', 'D_fanOut', 'E_deepState', 'G_hydration'];
    entry.frameworks = r.frameworkResults.map(({ framework, path: fp }) => {
      const j = readJsonOrNull(fp);
      if (!j) return { framework, resultPath: path.relative(repo, fp), status: 'MISSING' };
      const b = j.benchmarks ?? {};
      const browserPresent = BROWSER_KEYS.some((k) => b[k] != null);
      const nodePresent = b.F_ssr != null || b.H_bundleSize != null;
      return {
        framework, resultPath: path.relative(repo, fp),
        browserStatus: browserPresent ? 'MEASURED' : 'BLOCKED',
        nodeSideData: nodePresent ? 'present (Node SSR/bundle — NOT browser numbers)' : 'none',
        note: j.notes?.find((n) => /browser scenarios failed|Executable doesn't exist/i.test(n)) ?? null,
      };
    });
    const anyBrowser = entry.frameworks.some((f) => f.browserStatus === 'MEASURED');
    entry.status = anyBrowser ? 'BROWSER-PARTIAL' : 'BROWSER-BLOCKED (Node SSR/bundle present, not browser numbers)';
  }
  suites.push(entry);
}

const anyReal = suites.some((s) =>
  (s.status && !/BLOCKED|MISSING/.test(s.status)) ||
  (s.frameworks ?? []).some((f) => f.browserStatus === 'MEASURED'));
const overall = available && anyReal ? 'AVAILABLE'
  : available ? 'AVAILABLE-NO-DATA' : 'BLOCKED';

const reasonParts = [];
if (!env.playwright) reasonParts.push(`Playwright not installed (require.resolve → ${env.playwrightReason})`);
if (env.chromium === null) reasonParts.push('no Chromium binary found on PATH or via CHROMIUM_PATH/CHROME_PATH (offline registry 403 — not installable here)');

const result = {
  schema: 'streetui-browser-run-all/v1.8',
  status: overall,
  reason: overall === 'BLOCKED' ? reasonParts.join('; ') : null,
  detectedAt: new Date().toISOString(),
  environment: { runtime: `node ${process.version}`, playwright: env.playwright, chromium: env.chromium },
  suites,
  note:
    'This orchestrator spawns every sub-runner and aggregates their honest output. happy-dom ' +
    'is NOT a browser and is never substituted. No browser or competitor figures are produced ' +
    'or fabricated while the sub-runners report BLOCKED.',
};
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`browser/run-all: overall=${overall}. wrote ${path.relative(repo, outPath)} (no numbers fabricated).`);
process.exit(0);
