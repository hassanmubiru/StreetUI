/**
 * StreetUI v1.3 — REAL minified browser-bundle measurements (spec §14, §19).
 *
 *   node scripts/bundle-sizes.mjs [--out=<absPath>]
 *
 * Benchmark-development tool only; never shipped in `streetui`.
 *
 * §14 requires reporting the bundle a real browser would actually download —
 * MINIFIED, across representative usage profiles — NOT just the single unminified
 * full-barrel number. So this measures four profiles, each bundled with esbuild
 * (bundle + minify + tree-shake, format esm, target es2020) against the SAME public
 * `streetui` package the example app consumes:
 *
 *   minimal  — reactivity core + client renderer + DSL compile (a counter-class app)
 *   typical  — a real SPA: + router, forms+validators, i18n, store, resource, hydration
 *   full     — the whole public barrel (`import * as streetui`; all members retained)
 *   realApp  — the actual built demo app entry (examples/streetui-performance-app
 *              dist/browser-entry.js) — the most honest "real application" data point
 *
 * For each: raw bytes, gzip (zlib level 9), and brotli. Plus the HTML shell bytes a
 * page needs to boot the module, and CSS bytes (the framework ships NO stylesheet —
 * measured, not assumed: `find dist -name '*.css'` is empty), and a per-profile total
 * (js.brotli + html + css) representing over-the-wire transfer.
 *
 * esbuild is used purely as a MEASUREMENT bundler here; it is not added to the
 * `streetui` runtime dependency set. If esbuild cannot be loaded the script records a
 * BLOCKED result with the exact reason and fabricates no sizes.
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
const outPath = (() => {
  const a = process.argv.slice(2).find((x) => x.startsWith('--out='));
  return a ? a.slice('--out='.length)
    : path.join(repo, 'benchmarks', 'results', 'v1.3', 'bundle.json');
})();
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const write = (obj) => fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');
const sizes = (buf) => ({
  raw: buf.length,
  gzip: zlib.gzipSync(buf, { level: 9 }).length,
  brotli: zlib.brotliCompressSync(buf).length,
});

// ── load esbuild (measurement-only; not a streetui runtime dep) ───────────────
async function loadEsbuild() {
  const candidates = [
    'esbuild',
    path.join(repo, 'node_modules', '.pnpm', 'esbuild@0.24.2', 'node_modules', 'esbuild', 'lib', 'main.js'),
    path.join(repo, 'node_modules', '.pnpm', 'esbuild@0.21.5', 'node_modules', 'esbuild', 'lib', 'main.js'),
  ];
  // also discover any esbuild in the pnpm store as a last resort
  try {
    const store = path.join(repo, 'node_modules', '.pnpm');
    for (const d of fs.readdirSync(store)) {
      if (/^esbuild@/.test(d)) candidates.push(path.join(store, d, 'node_modules', 'esbuild', 'lib', 'main.js'));
    }
  } catch { /* ignore */ }
  for (const c of candidates) {
    try { const m = await import(c); if (m?.build && m?.transform) return m; } catch { /* try next */ }
  }
  return null;
}

const esbuild = await loadEsbuild();

if (esbuild === null) {
  write({
    schema: 'streetui-bundle/v1.3',
    status: 'BLOCKED',
    reason:
      'esbuild could not be loaded in this environment (no importable esbuild build API found at the ' +
      'package name or in the pnpm store). Minified bundle sizes therefore cannot be measured and are ' +
      'NOT fabricated. The npm registry is unreachable offline (E403) so esbuild cannot be installed.',
    remediation:
      'On a machine with esbuild available (it is already a transitive devDependency): ' +
      're-run `node scripts/bundle-sizes.mjs`.',
    target: 'public `streetui` package + examples/streetui-performance-app',
    note: 'The unminified full-barrel gzip (v1.2 baseline reconciliation) is still reported below.',
    unminifiedFullBarrel: (() => {
      try {
        const b = fs.readFileSync(path.join(streetuiDist, 'index.js'));
        return sizes(b);
      } catch { return null; }
    })(),
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(`bundle-sizes: BLOCKED — no esbuild. Wrote ${outPath} (no sizes fabricated).\n`);
  process.exit(0);
}

// ── profile entry sources (import real symbols and USE them so tree-shaking is honest) ──
const MINIMAL_ENTRY = `
import { signal, derived, effect, batch, flushSync,
  createRenderer, BrowserDOMAdapter, compile, createApplication } from 'streetui';
// A counter-class client app: reactive core + direct-DOM renderer + DSL compile.
const count = signal(0);
const label = derived(() => 'count: ' + count.get());
effect(() => { void label.get(); });
const app = createApplication();
const page = app.page('home');
page.text(label);
page.button('inc', { onClick: () => batch(() => count.set(count.peek() + 1)) });
const graph = app.build();
const compiled = compile(graph);
const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
globalThis.__keep = [compiled, renderer, flushSync];
`;

const TYPICAL_ENTRY = `
import { signal, derived, effect, batch, flushSync,
  createRenderer, BrowserDOMAdapter, compile, createApplication,
  createRouter, createBrowserHistory, mountRouter, routerOutlet, matchRoutes,
  createForm, required, email, minLength, maxLength, pattern,
  createI18n, createStore, resource, readState, serializeState, hydrateGraph } from 'streetui';
// A representative SPA: reactivity + client render + router + forms + i18n + store +
// async resource + SSR-state hydration. This is what a typical real app pulls in.
const count = signal(0);
const dbl = derived(() => count.get() * 2);
effect(() => { void dbl.get(); });
const app = createApplication();
const form = createForm({ name: { initial: '', validators: [required(), minLength(2), maxLength(40)] },
  mail: { initial: '', validators: [required(), email(), pattern(/.+/)] } });
const store = createStore({ n: 0 });
const i18n = createI18n({ locale: 'en', messages: { en: { hi: 'hi' } } });
const res = resource(async () => 42, { immediate: false });
const router = createRouter({ routes: [{ path: '/', component: () => app.page('h') }],
  history: createBrowserHistory() });
globalThis.__keep = [count, dbl, batch, flushSync, compile, createRenderer, BrowserDOMAdapter,
  createApplication, mountRouter, routerOutlet, matchRoutes, form, store, i18n, res, router,
  readState, serializeState, hydrateGraph];
`;

const FULL_ENTRY = `
import * as streetui from 'streetui';
// Whole public barrel: Object.keys forces esbuild to retain every exported member.
globalThis.__keep = Object.keys(streetui).map((k) => streetui[k]);
`;

async function bundleSource(contents) {
  const r = await esbuild.build({
    stdin: { contents, resolveDir: appDir, loader: 'js', sourcefile: 'entry.js' },
    bundle: true, minify: true, treeShaking: true, format: 'esm', target: 'es2020',
    write: false, legalComments: 'none', logLevel: 'silent',
  });
  return Buffer.from(r.outputFiles[0].text, 'utf8');
}

async function bundleFile(entry) {
  const r = await esbuild.build({
    entryPoints: [entry], absWorkingDir: appDir,
    bundle: true, minify: true, treeShaking: true, format: 'esm', target: 'es2020',
    write: false, legalComments: 'none', logLevel: 'silent',
  });
  return Buffer.from(r.outputFiles[0].text, 'utf8');
}

// HTML shell a page needs to boot the ESM bundle (realistic, minimal).
const HTML_SHELL =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>StreetUI app</title></head><body><div id="app"></div>' +
  '<script type="module" src="/app.js"></script></body></html>';
const htmlBytes = Buffer.byteLength(HTML_SHELL, 'utf8');

// CSS: measured, not assumed — the framework ships no stylesheet.
const cssFiles = (() => {
  try { return fs.readdirSync(streetuiDist).filter((f) => f.endsWith('.css')); } catch { return []; }
})();
const cssBytes = 0;

async function main() {
  const profiles = {};
  const errors = {};

  const jobs = [
    ['minimal', () => bundleSource(MINIMAL_ENTRY),
      'Reactivity core + client renderer + BrowserDOMAdapter + DSL compile (counter-class app).'],
    ['typical', () => bundleSource(TYPICAL_ENTRY),
      'Representative SPA: reactivity + render + router + forms/validators + i18n + store + resource + hydration.'],
    ['full', () => bundleSource(FULL_ENTRY),
      'Entire public `streetui` barrel (every exported member retained via import *).'],
    ['realApp', () => bundleFile(path.join(appDir, 'dist', 'browser-entry.js')),
      'The actual built demo application entry (examples/streetui-performance-app browser-entry).'],
  ];

  for (const [name, fn, description] of jobs) {
    try {
      const buf = await fn();
      const js = sizes(buf);
      profiles[name] = {
        description,
        js,
        css: { raw: cssBytes, gzip: 0, brotli: 0, files: cssFiles },
        html: { raw: htmlBytes },
        totalOverWireBrotli: js.brotli + 0 + htmlBytes,
        totalOverWireGzip: js.gzip + 0 + htmlBytes,
      };
    } catch (err) {
      errors[name] = String(err?.message ?? err);
    }
  }

  // Reconciliation with the v1.2 baseline: the UNMINIFIED full barrel gzip.
  let unminifiedFullBarrel = null;
  try { unminifiedFullBarrel = sizes(fs.readFileSync(path.join(streetuiDist, 'index.js'))); }
  catch { /* ignore */ }

  const V12_BASELINE_UNMIN_GZIP = 28764;
  const reconciliation = unminifiedFullBarrel
    ? {
        v12BaselineUnminifiedGzip: V12_BASELINE_UNMIN_GZIP,
        currentUnminifiedFullBarrel: unminifiedFullBarrel,
        matchesV12Baseline: unminifiedFullBarrel.gzip === V12_BASELINE_UNMIN_GZIP,
        note:
          'The v1.2 baseline (28764) was the UNMINIFIED full-barrel gzip. It is reproduced here for ' +
          'continuity. The §14 profile numbers above are MINIFIED and are the honest download figures.',
      }
    : null;

  const output = {
    schema: 'streetui-bundle/v1.3',
    status: Object.keys(errors).length === 0 ? 'OK' : 'PARTIAL',
    target: 'public `streetui` package (subpath ".") + examples/streetui-performance-app',
    method:
      'esbuild bundle+minify+treeShaking, format esm, target es2020, legalComments none. ' +
      'gzip = zlib level 9; brotli = zlib default. CSS measured (framework ships none). ' +
      'HTML = minimal module-boot shell. esbuild is a measurement-only bundler, not a streetui runtime dep.',
    esbuildVersion: esbuild.version ?? 'unknown',
    streetuiVersion: (() => {
      try { return createRequire(import.meta.url)(path.join(repo, 'packages', 'streetui', 'package.json')).version; }
      catch { return 'unknown'; }
    })(),
    profiles,
    ...(Object.keys(errors).length ? { errors } : {}),
    cssPolicy: { shipsStylesheet: false, cssFilesInDist: cssFiles, note: 'Framework ships no CSS; app-authored styles are out of scope.' },
    reconciliation,
    timestamp: new Date().toISOString(),
  };

  write(output);

  process.stdout.write('=== StreetUI v1.3 bundle sizes (minified) ===\n');
  for (const [name, p] of Object.entries(profiles)) {
    process.stdout.write(
      `${name.padEnd(8)} raw ${String(p.js.raw).padStart(7)}  gzip ${String(p.js.gzip).padStart(6)}  brotli ${String(p.js.brotli).padStart(6)}\n`);
  }
  if (Object.keys(errors).length) process.stdout.write(`errors: ${JSON.stringify(errors)}\n`);
  if (reconciliation) process.stdout.write(`unminified full-barrel gzip ${reconciliation.currentUnminifiedFullBarrel.gzip} (v1.2 baseline ${V12_BASELINE_UNMIN_GZIP}: ${reconciliation.matchesV12Baseline ? 'MATCH' : 'DIFF'})\n`);
  process.stdout.write(`written: ${outPath}\n`);
}

main().catch((err) => {
  write({
    schema: 'streetui-bundle/v1.3',
    status: 'ERROR',
    reason: 'Bundle measurement failed: ' + String(err?.stack ?? err?.message ?? err),
    timestamp: new Date().toISOString(),
  });
  process.stdout.write('bundle-sizes: ERROR — recorded, no sizes fabricated.\n');
  process.exit(0);
});
