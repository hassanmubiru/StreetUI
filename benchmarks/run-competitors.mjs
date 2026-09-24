// DEV-ONLY benchmark artifact — competitor orchestrator. NOT part of the `streetui` runtime.
/**
 * Cross-framework competitor benchmark orchestrator.
 *
 *   node benchmarks/run-competitors.mjs
 *
 * For each competitor (react, vue, svelte, solid) it runs the SAME conceptual
 * workload as the StreetUI harness (packages/benchmarks/v11-scenarios.mjs) and
 * writes benchmarks/results/{react,vue,svelte,solid}.json in the exact shape of
 * benchmarks/results/baseline.json:
 *   { framework, version, benchmarks: { A_initialRender ... H_bundleSize } }
 *
 * Execution model:
 *   - F (SSR)              : Node, via `vite build --ssr` then import + run.
 *   - A/B/C/D/E/G (browser): Chromium (Playwright) over a `vite preview` server
 *                            serving the built bench page; window.__bench() runs
 *                            the scenarios in-page and returns the results.
 *   - H (bundle size)      : `vite build` each entry, measure with node:zlib.
 *
 * BLOCKED behaviour (this environment): if no competitor is installed (offline
 * registry) it prints the BLOCKED marker and exits 0 WITHOUT overwriting the
 * existing honest BLOCKED result files. Result files are overwritten ONLY for a
 * framework that actually measured something. No numbers are ever fabricated.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const competitorsDir = path.join(here, 'competitors');
const resultsDir = path.join(here, 'results');
const versions = JSON.parse(fs.readFileSync(path.join(here, 'framework-versions.json'), 'utf8'));

const FRAMEWORKS = [
  { name: 'react', pkg: 'react', ssrEntry: 'src/ssr.jsx' },
  { name: 'vue', pkg: 'vue', ssrEntry: 'src/ssr.mjs' },
  { name: 'svelte', pkg: 'svelte', ssrEntry: 'src/ssr.mjs' },
  { name: 'solid', pkg: 'solid-js', ssrEntry: 'src/ssr.jsx' },
];
// Client entries measured for scenario H (raw/gzip/brotli of a single bundle).
const H_CLIENT_ENTRIES = {
  runtime: 'src/entries/runtime',
  minimalApp: 'src/entries/minimal',
  fullApp: 'src/entries/full',
};

const versionOf = (name) => {
  const c = versions.competitors?.[name] ?? {};
  return c[name] ?? c[FRAMEWORKS.find((f) => f.name === name)?.pkg] ?? Object.values(c)[0] ?? 'unknown';
};

function depsAvailable(fw) {
  const nm = path.join(competitorsDir, fw.name, 'node_modules');
  return fs.existsSync(path.join(nm, fw.pkg)) && fs.existsSync(path.join(nm, 'vite'));
}

function sizeOf(file) {
  if (!file || !fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  return {
    file: path.relative(repo, file),
    raw: buf.length,
    gzip: zlib.gzipSync(buf, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(buf).length,
  };
}

// ── Vite build helpers (loaded lazily; only needed when deps exist) ──────────
let vite = null;
async function getVite() {
  if (!vite) vite = await import('vite');
  return vite;
}
const ext = (fwName, base) => {
  // client entry extension per framework compiler
  const jsx = fwName === 'react' || fwName === 'solid';
  return `${base}.${jsx ? 'jsx' : 'mjs'}`;
};

async function buildSSR(fw) {
  const { build } = await getVite();
  const root = path.join(competitorsDir, fw.name);
  const outDir = path.join('dist-bench', 'ssr');
  await build({
    root,
    configFile: path.join(root, 'vite.config.mjs'),
    logLevel: 'warn',
    // Bundle the framework into a single self-contained Node ESM file so it is
    // both runnable (F, renderFlatHtml) and measurable (H.ssrSubset).
    ssr: { noExternal: true },
    build: {
      ssr: fw.ssrEntry,
      outDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'ssr.mjs' } },
    },
  });
  return path.join(root, outDir, 'ssr.mjs');
}

async function buildClientEntry(fw, entryBase, outName) {
  const { build } = await getVite();
  const root = path.join(competitorsDir, fw.name);
  const outDir = path.join('dist-bench', outName);
  await build({
    root,
    configFile: path.join(root, 'vite.config.mjs'),
    logLevel: 'warn',
    build: {
      outDir,
      emptyOutDir: true,
      minify: 'esbuild',
      target: 'es2022',
      rollupOptions: {
        input: path.join(root, ext(fw.name, entryBase)),
        output: { inlineDynamicImports: true, entryFileNames: 'bundle.js', format: 'es' },
      },
    },
  });
  return path.join(root, outDir, 'bundle.js');
}

async function buildBenchSite(fw) {
  const { build } = await getVite();
  const root = path.join(competitorsDir, fw.name);
  const outDir = path.join('dist-bench', 'site');
  await build({
    root,
    configFile: path.join(root, 'vite.config.mjs'),
    logLevel: 'warn',
    build: { outDir, emptyOutDir: true, minify: 'esbuild', target: 'es2022' },
  });
  return outDir;
}

// PLACEHOLDER_RUN
const BROWSER_KEYS = ['A_initialRender', 'B_singleUpdate', 'C_largeList', 'D_fanOut', 'E_deepState', 'G_hydration'];

async function runFramework(fw, playwright) {
  const benchmarks = {
    A_initialRender: null,
    B_singleUpdate: null,
    C_largeList: null,
    D_fanOut: null,
    E_deepState: null,
    F_ssr: null,
    G_hydration: null,
    H_bundleSize: null,
  };
  const notes = [];
  let measured = false;
  let ssrHtml = null;

  // ── F (SSR) + hydration markup, in Node ──────────────────────────────────
  try {
    const ssrFile = await buildSSR(fw);
    const mod = await import(pathToFileURL(ssrFile).href);
    benchmarks.F_ssr = await mod.runSSR();
    measured = true;
    if (typeof mod.renderFlatHtml === 'function') ssrHtml = await mod.renderFlatHtml();
  } catch (e) {
    notes.push('F/SSR failed: ' + (e?.message ?? String(e)));
  }

  // ── H (bundle sizes) ─────────────────────────────────────────────────────
  try {
    const h = {
      note:
        'sizes in bytes; gzip level 9; brotli default. Client bundles are self-contained (framework inlined). routerApp is null — no framework router is in the pinned dep set (StreetUI ships a router in-core).',
    };
    for (const [key, base] of Object.entries(H_CLIENT_ENTRIES)) {
      h[key] = sizeOf(await buildClientEntry(fw, base, key));
    }
    h.ssrSubset = sizeOf(path.join(competitorsDir, fw.name, 'dist-bench', 'ssr', 'ssr.mjs'));
    h.routerApp = null;
    benchmarks.H_bundleSize = h;
    measured = true;
  } catch (e) {
    notes.push('H/bundle failed: ' + (e?.message ?? String(e)));
  }

  // ── A/B/C/D/E/G (browser via Playwright + vite preview) ──────────────────
  if (playwright) {
    let browser = null;
    let server = null;
    try {
      await buildBenchSite(fw);
      const { preview } = await getVite();
      const root = path.join(competitorsDir, fw.name);
      server = await preview({
        root,
        configFile: path.join(root, 'vite.config.mjs'),
        build: { outDir: path.join('dist-bench', 'site') },
        preview: { port: 0 },
      });
      const url = server.resolvedUrls.local[0];
      browser = await playwright.chromium.launch();
      const page = await browser.newPage();
      if (typeof ssrHtml === 'string') {
        await page.addInitScript((markup) => {
          globalThis.__SOLID_SSR_HTML__ = markup;
        }, ssrHtml);
      }
      await page.goto(url, { waitUntil: 'load' });
      const r = await page.evaluate(async () => await window.__bench());
      for (const k of BROWSER_KEYS) if (r && r[k] !== undefined) benchmarks[k] = r[k];
      measured = true;
    } catch (e) {
      notes.push('browser scenarios failed: ' + (e?.message ?? String(e)));
    } finally {
      try {
        await browser?.close();
      } catch {}
      try {
        await server?.httpServer?.close?.();
      } catch {}
    }
  } else {
    notes.push('browser scenarios (A/B/C/D/E/G) skipped: no Playwright/Chromium.');
  }

  const result = {
    framework: fw.name,
    version: versionOf(fw.name),
    nodeVersion: process.version,
    browserVersion: null,
    timestamp: new Date().toISOString(),
    environment: {
      domEnvironment: playwright ? 'chromium (Playwright)' : 'node-only (no browser)',
      arch: process.arch,
      platform: process.platform,
    },
    notes,
    benchmarks,
  };
  return { measured, result };
}

function regenerateComparison(measuredResults) {
  try {
    const base = JSON.parse(fs.readFileSync(path.join(resultsDir, 'baseline.json'), 'utf8'));
    const b = base.benchmarks;
    const row = (fwName, ver, m, env) => ({
      framework: fwName,
      version: ver,
      initialRender_ms: m.A_initialRender?.medianMs ?? null,
      singleUpdate_ms: m.B_singleUpdate?.medianMs ?? null,
      singleUpdate_domMutations: m.B_singleUpdate?.domMutations ?? null,
      listUpdate_append_ms: m.C_largeList?.append?.medianMs ?? null,
      listUpdate_reorder_ms: m.C_largeList?.reorder?.medianMs ?? null,
      ssr_ms: m.F_ssr?.medianMs ?? null,
      hydration_ms: m.G_hydration?.medianMs ?? null,
      bundle_runtime_gzip: m.H_bundleSize?.runtime?.gzip ?? null,
      environment: env,
    });
    const frameworks = [
      row('streetui', base.streetuiVersion, b, base.environment?.domEnvironment ?? 'happy-dom (Node)'),
      ...measuredResults.map((r) =>
        row(r.framework, r.version, r.benchmarks, r.environment?.domEnvironment ?? 'unknown'),
      ),
    ];
    const out = {
      '//': 'Cross-framework comparison. Rows are only present for frameworks that were actually measured; frameworks still BLOCKED keep their BLOCKED result files. See methodology.md.',
      methodology: 'benchmarks/methodology.md',
      generatedFrom: 'benchmarks/run-competitors.mjs',
      timestamp: new Date().toISOString(),
      frameworks,
    };
    fs.writeFileSync(path.join(resultsDir, 'comparison.json'), JSON.stringify(out, null, 2) + '\n');
  } catch (e) {
    process.stdout.write('comparison.json regeneration skipped: ' + (e?.message ?? String(e)) + '\n');
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
const installed = FRAMEWORKS.filter(depsAvailable);
let playwright = null;
try {
  playwright = await import('playwright');
} catch {
  playwright = null;
}

if (installed.length === 0) {
  // No competitor is installed (offline registry). Do NOT overwrite the honest
  // BLOCKED result files; record nothing fabricated.
  process.stdout.write('competitors: BLOCKED (no registry/browser)\n');
  process.exit(0);
}

const measuredResults = [];
for (const fw of installed) {
  process.stdout.write('measuring ' + fw.name + ' ...\n');
  const { measured, result } = await runFramework(fw, playwright);
  if (measured) {
    fs.writeFileSync(path.join(resultsDir, fw.name + '.json'), JSON.stringify(result, null, 2) + '\n');
    measuredResults.push(result);
    process.stdout.write('  wrote results/' + fw.name + '.json' + (result.notes.length ? ' (with notes)' : '') + '\n');
  } else {
    process.stdout.write('  nothing measured for ' + fw.name + ' — left existing BLOCKED file intact\n');
  }
}

if (measuredResults.length > 0) regenerateComparison(measuredResults);
process.stdout.write('competitors: done (' + measuredResults.length + '/' + installed.length + ' frameworks measured)\n');


