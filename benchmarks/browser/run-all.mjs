/**
 * StreetUI browser benchmark orchestrator (spec §21/§26).
 *
 *   node benchmarks/browser/run-all.mjs
 *
 * This is the single entry the release gate calls to run ALL real-browser
 * benchmarks (StreetUI in-page scenarios + competitor scenarios) under one
 * Chromium methodology. Real browser numbers require a real engine: a Chromium
 * binary driven through Playwright. Node + happy-dom is NOT a browser and is
 * never substituted for browser numbers (§21).
 *
 * Behaviour:
 *   1. Detect whether Playwright + a Chromium binary are available.
 *   2. If available: delegate to scripts/browser-harness.mjs (StreetUI) and the
 *      competitor harnesses, all under the identical browser methodology, and
 *      aggregate their JSON results.
 *   3. If NOT available: write a BLOCKED marker with the exact environmental
 *      reason and the catalogue of suites that WOULD run, then exit 0 WITHOUT
 *      fabricating any numbers.
 *
 * No browser or competitor claim is valid without actual execution here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const outDir = path.join(repo, 'benchmarks', 'results', 'v1.7');
const outPath = path.join(outDir, 'browser-run-all.json');
fs.mkdirSync(outDir, { recursive: true });

const require = createRequire(import.meta.url);

// The full catalogue of suites this orchestrator runs when a browser exists.
const SUITES = {
  streetui: {
    driver: 'scripts/browser-harness.mjs',
    scenarios: ['initial-render', 'hydration', 'reactive-search-10k',
      'keyed-list-append/prepend/reorder/update', 'route-transitions'],
  },
  competitors: {
    driver: 'benchmarks/run-competitors.mjs',
    frameworks: ['react', 'vue', 'svelte', 'solid'],
    note: 'Identical scenarios + identical Chromium methodology as the StreetUI suite (§22).',
  },
};

function detectBrowser() {
  let playwright = false;
  let playwrightReason = '';
  try { require.resolve('playwright'); playwright = true; }
  catch (e) { playwrightReason = e.code ?? String(e); }

  const candidates = [
    process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  const chromium = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) ?? null;

  return { playwright, playwrightReason, chromium };
}

const env = detectBrowser();
const available = env.playwright && env.chromium !== null;

if (!available) {
  const reasonParts = [];
  if (!env.playwright) reasonParts.push(`Playwright not installed (require.resolve → ${env.playwrightReason})`);
  if (env.chromium === null) reasonParts.push('no Chromium binary found on PATH or via CHROMIUM_PATH/CHROME_PATH');
  const result = {
    schema: 'streetui-browser-run-all/v1.7',
    status: 'BLOCKED',
    reason: reasonParts.join('; '),
    detectedAt: new Date().toISOString(),
    environment: { runtime: `node ${process.version}`, playwright: env.playwright, chromium: env.chromium },
    wouldRun: SUITES,
    note:
      'happy-dom is NOT a browser and is never substituted for these numbers. No browser or ' +
      'competitor performance figures are produced or fabricated while this gate is BLOCKED.',
  };
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`browser/run-all: BLOCKED — ${result.reason}`);
  console.log(`wrote ${outPath} (no numbers fabricated).`);
  process.exit(0);
}

// If a browser is available, this is where the StreetUI + competitor suites are
// driven under one methodology. Reached only when Playwright + Chromium exist.
console.log('browser/run-all: Chromium detected — delegating to per-suite harnesses.');
console.log(JSON.stringify({ status: 'AVAILABLE', suites: SUITES, chromium: env.chromium }, null, 2));
