/**
 * StreetUI v2.7 — styling-system bundle cost + tree-shake proof (spec §24).
 *
 *   node scripts/styling-bundle.mjs [--out=<absPath>]
 *
 * Measurement-only tool (never shipped in `streetui`). §24 asks for the honest
 * download cost of the NEW styling subsystem, raw/gzip/brotli, and proof that it
 * is tree-shakeable — i.e. an app that imports no styling pays zero styling bytes.
 *
 * Four esbuild (bundle+minify+treeShaking, esm, es2020) profiles over the SAME
 * public `streetui` package the website consumes:
 *
 *   baseline    — counter-class client app that imports NO styling symbol
 *   stylingOnly — the whole public styling surface, every member USED so nothing
 *                 tree-shakes away (style/cx/styleVariants/layout/text/form/a11y/
 *                 tokens/createThemeTokens/renderStyles/createTheme/animate/transition)
 *   withStyling — baseline counter app + a realistic slice of styling usage
 *   full        — the entire public barrel (import *), for continuity
 *
 * Incremental styling cost = withStyling − baseline (what a real app adds by
 * adopting styling). Tree-shake proof: the baseline bundle must NOT contain the
 * styling string literals ('data-streetui-css', '--space-') that survive
 * minification, while stylingOnly must. If esbuild cannot load, a BLOCKED result
 * is recorded with the reason and NO sizes are fabricated.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const appDir = path.join(repo, 'examples', 'streetui-performance-app');
const streetuiDist = path.join(repo, 'packages', 'streetui', 'dist');
const outArg = process.argv.slice(2).find((x) => x.startsWith('--out='));
const outPath = outArg ? outArg.slice('--out='.length)
  : path.join(repo, 'benchmarks', 'results', 'v2.7', 'styling-bundle.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const write = (obj) => fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');
const sizes = (buf) => ({
  raw: buf.length,
  gzip: zlib.gzipSync(buf, { level: 9 }).length,
  brotli: zlib.brotliCompressSync(buf).length,
});

async function loadEsbuild() {
  const candidates = ['esbuild'];
  try {
    const store = path.join(repo, 'node_modules', '.pnpm');
    for (const d of fs.readdirSync(store)) {
      if (/^esbuild@/.test(d)) candidates.push(path.join(store, d, 'node_modules', 'esbuild', 'lib', 'main.js'));
    }
  } catch { /* ignore */ }
  for (const c of candidates) {
    try { const m = await import(c); if (m?.build && m?.transform) return m; } catch { /* next */ }
  }
  return null;
}
const esbuild = await loadEsbuild();
/* APPEND_MARKER */
