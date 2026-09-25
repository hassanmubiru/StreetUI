/**
 * §2 — Isolated list-reorder benchmark RUNNER.
 *
 *   node benchmarks/scenarios/browser-list-reorder/run.mjs --out=<absPath>
 *
 * Contract: this runner produces a number ONLY from a real Chromium engine driven by
 * Playwright. It first proves both are present. In THIS environment neither is (no
 * Chromium binary; npm registry 403 so nothing installable), so it writes a result with
 * status "BLOCKED" and the exact reason — it never fabricates, estimates, or substitutes a
 * happy-dom number for a browser number.
 *
 * When run where a browser exists, it will (per the branch below) bundle each framework's
 * in-page adapter + ./scenario.mjs with esbuild, serve the page, drive it through
 * Playwright, and record duration/DOM-mutations/node-count/long-tasks/frame-pacing per op
 * for StreetUI and each installed competitor — labelled as Chromium numbers, in their own
 * environment block, with NO ranking.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function detectPlaywright() {
  try { require.resolve('playwright'); return { ok: true }; }
  catch { return { ok: false, reason: 'the "playwright" package is not installed (npm registry returns 403 / offline; cannot fetch it)' }; }
}
function detectChromium() {
  const envPath = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const candidates = [envPath, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
  const found = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  return found ? { ok: true, path: found } : { ok: false, reason: 'no Chromium/Chrome binary found (checked CHROMIUM_PATH and standard /usr/bin paths); none installable offline' };
}

const outFlag = process.argv.find((a) => a.startsWith('--out='));
const outPath = outFlag ? outFlag.slice('--out='.length)
  : path.resolve(__dirname, '../../results/v1.4/browser-list-reorder.json');

const pw = detectPlaywright();
const chromium = detectChromium();

if (!pw.ok || !chromium.ok) {
  const result = {
    schema: 'browser-list-reorder/v1.4',
    status: 'BLOCKED',
    scope: 'isolated 10k keyed-row list reorder (§2): StreetUI + competitors, all ops, recording duration/DOM-mutations/node-count/long-tasks/frame-pacing',
    generatedAt: new Date().toISOString(),
    reason: [pw.ok ? null : `Playwright: ${pw.reason}`, chromium.ok ? null : `Chromium: ${chromium.reason}`].filter(Boolean).join('; '),
    harness: 'benchmarks/scenarios/browser-list-reorder/scenario.mjs (ready-to-run in-page measurement core) + this runner. No code change is needed to execute where a browser exists.',
    fabricationNote: 'Per the v1.4 anti-fabrication rule, no browser numbers are estimated or substituted. happy-dom node-side numbers for related scenarios live in streetui-node.json and are NEVER presented as browser numbers.',
    data: null,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('BLOCKED (recorded, not fabricated):', result.reason);
  console.log('written:', outPath);
  process.exit(0);
}

// ── Executable branch (runs only where Playwright + Chromium exist) ───────────────────
// Kept intentionally explicit so the path is auditable and ready; it never runs in this VM.
const { chromium: pwChromium } = require('playwright');
const { build } = require('esbuild');

const FRAMEWORKS = [
  { id: 'streetui', adapter: path.resolve(__dirname, 'adapters/streetui.mjs') },
  // Competitor adapters are added here once their packages can be installed in a browser env.
  // e.g. { id: 'react', adapter: '.../adapters/react.mjs' }, ...
];

async function measure(framework) {
  const bundle = await build({
    entryPoints: [framework.adapter], bundle: true, format: 'esm', write: false,
    target: 'es2020', minify: false,
  });
  const adapterJs = bundle.outputFiles[0].text;
  const coreJs = fs.readFileSync(path.resolve(__dirname, 'scenario.mjs'), 'utf8');
  const html = `<!doctype html><meta charset=utf-8><div id=app></div>
    <script type=module>${adapterJs}\n${coreJs}
      window.__run = async () => runListReorder(document.getElementById('app'));
    </script>`;

  const browser = await pwChromium.launch({ executablePath: chromium.path });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.evaluate(async () => window.__run());
  } finally { await browser.close(); }
}

const perFramework = {};
for (const fw of FRAMEWORKS) perFramework[fw.id] = await measure(fw);

const result = {
  schema: 'browser-list-reorder/v1.4',
  status: 'OK',
  generatedAt: new Date().toISOString(),
  environment: { engine: 'Chromium', chromiumPath: chromium.path, note: 'Real-browser numbers. Labelled as Chromium. NOT comparable to happy-dom node numbers.' },
  policy: 'NO ranking, NO winner. Per-framework measurements are reported side by side; the reader draws conclusions.',
  frameworks: perFramework,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log('written:', outPath);
