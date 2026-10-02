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
if (esbuild === null) {
  write({
    schema: 'streetui-styling-bundle/v2.7', status: 'BLOCKED',
    reason: 'esbuild could not be loaded (no importable build API at the package name or in the '
      + 'pnpm store). Minified styling-bundle sizes cannot be measured and are NOT fabricated.',
    remediation: 'On a machine with esbuild available re-run `node scripts/styling-bundle.mjs`.',
    target: 'public `streetui` package styling subsystem', timestamp: new Date().toISOString(),
  });
  process.stdout.write(`styling-bundle: BLOCKED — no esbuild. Wrote ${outPath} (no sizes fabricated).\n`);
  process.exit(0);
}

const BASELINE = `
import { signal, derived, effect, batch, flushSync,
  createRenderer, BrowserDOMAdapter, compile, createApplication } from 'streetui';
const count = signal(0);
const label = derived(() => 'count: ' + count.get());
effect(() => { void label.get(); });
const app = createApplication();
const page = app.page('home');
page.text(label);
page.button('inc', { onClick: () => batch(() => count.set(count.peek() + 1)) });
const compiled = compile(app.build());
const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
globalThis.__keep = [compiled, renderer, flushSync];
`;

const STYLING_ONLY = `
import { style, cx, styleVariants, layout, text, form, a11y, tokens,
  createThemeTokens, renderStyles, createTheme, animate, transition, styleRegistry } from 'streetui';
const t = tokens.ref;
const base = style({ color: t.content.primary, padding: 8, on: { hover: { color: t.accent.primary } } });
const v = styleVariants({ base: { display: 'inline-flex' },
  variants: { intent: { primary: { color: 'white' }, danger: { color: 'red' } }, size: { sm: { padding: 4 }, lg: { padding: 12 } } },
  defaultVariants: { intent: 'primary', size: 'sm' } });
const theme = createThemeTokens({ light: { color: { bg: '#fff' } }, dark: { color: { bg: '#000' } } });
const ctrl = createTheme({ root: null });
const classes = cx(base, v({ intent: 'danger' }), layout.stack({ gap: '4' }), text.heading({ level: 1 }),
  form.input(), a11y.focusRing(), animate('streetui-fade-in'));
const tr = transition(['opacity'], { duration: 'fast' });
const sheet = renderStyles({ registry: styleRegistry });
globalThis.__keep = [classes, theme, ctrl, tr, sheet];
`;

const WITH_STYLING = BASELINE.replace('globalThis.__keep = [compiled, renderer, flushSync];', `
import { style, cx, layout, text, tokens } from 'streetui';
const t2 = tokens.ref;
const btn = style({ background: t2.accent.primary, color: t2.accent.contrast, padding: 8 });
const wrap = cx(layout.stack({ gap: '4' }), text.body());
globalThis.__keep = [compiled, renderer, flushSync, btn, wrap];
`);

const FULL = `import * as s from 'streetui'; globalThis.__keep = Object.keys(s).map((k) => s[k]);`;

async function bundle(contents) {
  const r = await esbuild.build({
    stdin: { contents, resolveDir: appDir, loader: 'js', sourcefile: 'entry.js' },
    bundle: true, minify: true, treeShaking: true, format: 'esm', target: 'es2020',
    write: false, legalComments: 'none', logLevel: 'silent',
  });
  return r.outputFiles[0].text;
}

const MARKERS = ['data-streetui-css', '--space-'];
const buf = (txt) => Buffer.from(txt, 'utf8');

async function main() {
  const baselineTxt = await bundle(BASELINE);
  const stylingOnlyTxt = await bundle(STYLING_ONLY);
  const withStylingTxt = await bundle(WITH_STYLING);
  const fullTxt = await bundle(FULL);

  const baseline = sizes(buf(baselineTxt));
  const stylingOnly = sizes(buf(stylingOnlyTxt));
  const withStyling = sizes(buf(withStylingTxt));
  const full = sizes(buf(fullTxt));

  const baselineHasMarkers = MARKERS.filter((m) => baselineTxt.includes(m));
  const stylingHasMarkers = MARKERS.filter((m) => stylingOnlyTxt.includes(m));
  const treeShakeProven = baselineHasMarkers.length === 0 && stylingHasMarkers.length === MARKERS.length;

  const incremental = {
    raw: withStyling.raw - baseline.raw,
    gzip: withStyling.gzip - baseline.gzip,
    brotli: withStyling.brotli - baseline.brotli,
    note: 'withStyling − baseline: bytes a real counter app adds by adopting a realistic styling slice.',
  };

  const cssFilesInDist = (() => {
    try { return fs.readdirSync(streetuiDist).filter((f) => f.endsWith('.css')); } catch { return []; }
  })();

  const output = {
    schema: 'streetui-styling-bundle/v2.7', status: 'OK',
    target: 'public `streetui` package styling subsystem (subpath ".")',
    method: 'esbuild bundle+minify+treeShaking, esm, es2020, legalComments none. '
      + 'gzip=zlib level 9; brotli=zlib default. All numbers measured in this process.',
    esbuildVersion: esbuild.version ?? 'unknown',
    streetuiVersion: (() => {
      try { return createRequire(import.meta.url)(path.join(repo, 'packages', 'streetui', 'package.json')).version; }
      catch { return 'unknown'; }
    })(),
    profiles: { baseline, stylingOnly, withStyling, full },
    incrementalStylingCost: incremental,
    treeShake: {
      proven: treeShakeProven,
      markers: MARKERS,
      baselineContainsStylingMarkers: baselineHasMarkers,
      stylingOnlyContainsStylingMarkers: stylingHasMarkers,
      note: 'A counter app importing no styling symbol pays zero styling bytes: the styling string '
        + 'literals (which survive minification) are absent from the baseline bundle and present in stylingOnly.',
    },
    cssPolicy: { shipsStylesheet: false, cssFilesInDist,
      note: 'Framework ships no .css; the styling system GENERATES CSS at runtime/SSR from the registry.' },
    timestamp: new Date().toISOString(),
  };
  write(output);

  process.stdout.write('=== StreetUI v2.7 styling bundle (minified) ===\n');
  for (const [n, p] of Object.entries(output.profiles)) {
    process.stdout.write(`${n.padEnd(11)} raw ${String(p.raw).padStart(7)}  gzip ${String(p.gzip).padStart(6)}  brotli ${String(p.brotli).padStart(6)}\n`);
  }
  process.stdout.write(`incremental styling (withStyling−baseline): raw ${incremental.raw}  gzip ${incremental.gzip}  brotli ${incremental.brotli}\n`);
  process.stdout.write(`tree-shake proven: ${treeShakeProven}  (baseline markers: [${baselineHasMarkers.join(', ')}]; stylingOnly markers: [${stylingHasMarkers.join(', ')}])\n`);
  process.stdout.write(`written: ${outPath}\n`);
}

main().catch((err) => {
  write({ schema: 'streetui-styling-bundle/v2.7', status: 'ERROR',
    reason: 'Styling bundle measurement failed: ' + String(err?.stack ?? err?.message ?? err),
    timestamp: new Date().toISOString() });
  process.stdout.write('styling-bundle: ERROR — recorded, no sizes fabricated.\n');
  process.exit(1);
});
