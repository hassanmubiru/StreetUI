/**
 * Real-browser benchmark harness (spec §8, §16, §29).
 *
 *   node scripts/browser-harness.mjs
 *
 * The in-browser scenarios — A (initial render / time-to-interactive) and
 * G (hydration: HTML adoption, event binding, reactivity init, TTI) — require a
 * real Chromium instance driven through Playwright. Node + happy-dom can measure
 * relative JS/DOM cost (see packages/benchmarks/v11-scenarios.mjs) but is NOT a
 * browser and cannot measure paint, layout, or true time-to-interactive.
 *
 * This harness:
 *   1. Detects whether Playwright + a Chromium binary are available.
 *   2. If available, runs the browser scenarios and writes
 *      benchmarks/results/browser.json with real measurements.
 *   3. If NOT available, writes a BLOCKED marker (status: "BLOCKED") and exits 0
 *      WITHOUT fabricating any numbers. A blocked run is recorded honestly, not
 *      faked.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const outPath = path.join(repo, 'benchmarks', 'results', 'browser.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

function writeResult(obj) {
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');
}

let playwright = null;
try {
  playwright = await import('playwright');
} catch {
  playwright = null;
}

if (playwright === null) {
  const blocked = {
    status: 'BLOCKED',
    reason:
      'Playwright is not installed (no npm registry access) and no Chromium binary is available in this environment. Real-browser scenarios (A initial render / time-to-interactive, G hydration) cannot be measured. Install playwright + chromium (npx playwright install chromium) on a machine with registry access and re-run `node scripts/browser-harness.mjs`.',
    scenarios: {
      A_initialRender: null,
      G_hydration: null,
    },
    fallback:
      'Node/happy-dom relative measurements for these workloads are in benchmarks/results/baseline.json and results/streetui.json.',
    timestamp: new Date().toISOString(),
  };
  writeResult(blocked);
  process.stdout.write(
    'browser-harness: BLOCKED — no Playwright/Chromium. Wrote ' + outPath + ' (no numbers fabricated).\n',
  );
  process.exit(0);
}

// ── Real-browser path (runs only when Playwright + Chromium are present) ──────
let chromium;
try {
  chromium = playwright.chromium;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // The built demo app served for benchmarking is produced by
  // benchmarks/serve-app.mjs; here we drive the in-page measurement hooks.
  await page.goto(process.env.BENCH_URL ?? 'http://localhost:5177/');
  const measured = await page.evaluate(async () => {
    // window.__bench is installed by the benchmarked app entry.
    // eslint-disable-next-line no-undef
    return typeof window.__bench === 'function' ? await window.__bench() : null;
  });
  await browser.close();
  writeResult({
    status: 'OK',
    browser: 'chromium',
    version: await chromium.launch().then((b) => b.version?.() ?? 'unknown').catch(() => 'unknown'),
    scenarios: measured,
    timestamp: new Date().toISOString(),
  });
  process.stdout.write('browser-harness: OK — wrote ' + outPath + '\n');
} catch (err) {
  writeResult({
    status: 'ERROR',
    reason: 'Playwright is present but Chromium failed to launch: ' + String(err?.message ?? err),
    scenarios: { A_initialRender: null, G_hydration: null },
    timestamp: new Date().toISOString(),
  });
  process.stdout.write('browser-harness: ERROR launching Chromium — recorded, no numbers fabricated.\n');
  process.exit(0);
}
