/**
 * StreetUI v1.7 — SSR byte-identity gate (spec §8/§26). Node-only; NO browser.
 *
 * For each real-app route this renders the page TWICE from the SAME compiled
 * application:
 *   legacy    = renderToString(compiled, { staticPlan: null })  // v1.6 path
 *   optimized = renderToString(compiled)                        // v1.7 cached plan
 * and asserts they are byte-for-byte identical via three independent checks:
 *   (1) exact string equality        legacy === optimized
 *   (2) UTF-8 byte length            Buffer.byteLength(legacy) === Buffer.byteLength(optimized)
 *   (3) SHA-256 digest               sha256(legacy) === sha256(optimized)
 * No whitespace drift, no escaping drift is permitted (§8).
 *
 * It additionally cross-checks each optimized digest against the recorded v1.6
 * baseline (byte length + sha256 8-char prefix from the v1.6 release), so a
 * silent change in the app or serializer is also caught.
 *
 * Every number is measured in THIS process. Exit code is non-zero if any route
 * fails any check (so it can gate a release). Output: JSON on stdout, plus an
 * optional --out=<absPath> file.
 *
 * Usage: node scripts/verify-ssr-hashes.mjs [--out=<absPath>]
 */
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

// happy-dom globals only so module-load-time DOM references don't throw; SSR
// itself uses the ServerDOMAdapter, never this window.
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.W ?? path.resolve(__dirname, '..');
const appDist = [
  path.resolve(repoRoot, 'examples', 'streetui-performance-app', 'dist'),
  path.resolve(__dirname, '..', 'examples', 'streetui-performance-app', 'dist'),
].find((p) => fs.existsSync(p));
if (!appDist) throw new Error('perf-app dist not found — build examples/streetui-performance-app first');

const { compilePage, createDeps } = await import(path.join(appDist, 'index.js'));
const { renderToString } = await import('streetui');

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// Recorded v1.6 baseline (byte length + sha256 prefix) for cross-checking that
// v1.7 output has not drifted from the shipped v1.6 bytes.
const V16_BASELINE = {
  overview: { bytes: 730, sha8: '19d86cbb' },
  dashboard: { bytes: 925, sha8: '4f6b4a39' },
  users: { bytes: 3610699, sha8: 'f8f20c0d' },
  controls: { bytes: 36551, sha8: '3616bce9' },
  settings: { bytes: 926, sha8: '42127b6f' },
};

const ROUTES = ['overview', 'dashboard', 'users', 'controls', 'settings'];

const results = [];
let allPass = true;

for (const view of ROUTES) {
  const compiled = compilePage(createDeps({}), view, { name: 'light' });

  const legacy = renderToString(compiled, { staticPlan: null }); // v1.6 path
  const optimized = renderToString(compiled);                    // v1.7 cached plan

  const exactEqual = legacy === optimized;
  const lenLegacy = Buffer.byteLength(legacy, 'utf8');
  const lenOptimized = Buffer.byteLength(optimized, 'utf8');
  const lenEqual = lenLegacy === lenOptimized;
  const shaLegacy = sha256(legacy);
  const shaOptimized = sha256(optimized);
  const shaEqual = shaLegacy === shaOptimized;

  const base = V16_BASELINE[view];
  const baselineBytesMatch = base ? lenOptimized === base.bytes : null;
  const baselineShaMatch = base ? shaOptimized.startsWith(base.sha8) : null;

  const pass =
    exactEqual && lenEqual && shaEqual &&
    (baselineBytesMatch !== false) && (baselineShaMatch !== false);
  if (!pass) allPass = false;

  results.push({
    route: view,
    pass,
    exactEqual,
    byteLength: { legacy: lenLegacy, optimized: lenOptimized, equal: lenEqual },
    sha256: {
      legacy: shaLegacy.slice(0, 16),
      optimized: shaOptimized.slice(0, 16),
      equal: shaEqual,
    },
    v16Baseline: base
      ? { bytes: base.bytes, sha8: base.sha8, bytesMatch: baselineBytesMatch, shaMatch: baselineShaMatch }
      : null,
  });

  const flag = pass ? 'PASS' : 'FAIL';
  console.log(
    `[${flag}] ${view.padEnd(9)} bytes=${String(lenOptimized).padStart(8)} ` +
    `sha256=${shaOptimized.slice(0, 8)} ` +
    `exact=${exactEqual} lenEq=${lenEqual} shaEq=${shaEqual} ` +
    `v16Bytes=${baselineBytesMatch} v16Sha=${baselineShaMatch}`,
  );
}

const out = {
  gate: 'verify-ssr-hashes',
  spec: '§8/§26',
  generatedAt: new Date().toISOString(),
  environment: {
    runtime: `node ${process.version}`,
    dom: 'ServerDOMAdapter (no browser)',
    note: 'legacy = renderToString(compiled,{staticPlan:null}); optimized = renderToString(compiled).',
  },
  allPass,
  routes: results,
};

const outFlag = process.argv.find((a) => a.startsWith('--out='));
if (outFlag) {
  const p = outFlag.slice('--out='.length);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
}
console.log('__SSRHASH__' + JSON.stringify(out));

console.log(allPass ? '\nBYTE-IDENTITY GATE: PASS' : '\nBYTE-IDENTITY GATE: FAIL');
process.exit(allPass ? 0 : 1);
