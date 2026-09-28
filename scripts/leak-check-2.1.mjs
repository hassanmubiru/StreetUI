/**
 * StreetUI 2.1 §18 — client-bundle leak check.
 *
 *   node scripts/leak-check-2.1.mjs [--out=<absPath>]
 *
 * Bundles a MINIMAL and a TYPICAL client entry from the public `streetui` package
 * (bundle + minify + tree-shake, esm, target es2020 — exactly like a browser build)
 * and asserts that server-only / tooling-only code does NOT survive tree-shaking
 * into the client bundle:
 *   - SSR serializer (ServerDOMAdapter, renderToString, renderHead)
 *   - CLI (runCli, buildProject, startServer, createProject, ReloadHub)
 *   - testing helpers (findByRole, renderServerThenHydrate, waitFor)
 *   - devtools (createDevTools, renderDevToolsHTML, inspectApplication/Components/Interactions)
 *   - Node built-ins (node:fs / node:path / node:child_process / node:http / esbuild)
 *
 * esbuild is a MEASUREMENT-only bundler here, never a streetui runtime dep.
 * No sizes or verdicts are fabricated: if esbuild is unavailable the script writes
 * a BLOCKED record with the exact reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const appDir = path.join(repo, 'examples', 'streetui-performance-app');
const outArg = process.argv.slice(2).find((x) => x.startsWith('--out='));
const outPath = outArg ? outArg.slice('--out='.length)
  : path.join(repo, 'benchmarks', 'results', 'v2.1', 'bundle-leak-check.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const write = (o) => fs.writeFileSync(outPath, JSON.stringify(o, null, 2) + '\n');

async function loadEsbuild() {
  const req = createRequire(import.meta.url);
  try { return req('esbuild'); } catch {}
  const cand = path.join(repo, 'node_modules', '.pnpm', 'esbuild@0.24.2',
    'node_modules', 'esbuild', 'lib', 'main.js');
  if (fs.existsSync(cand)) return req(cand);
  return null;
}

const MINIMAL_ENTRY = `
import { signal, derived, effect, batch, flushSync,
  createRenderer, BrowserDOMAdapter, compile, createApplication } from 'streetui';
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
  createRouter, createBrowserHistory, mountRouter, routerOutlet,
  createForm, required, email, minLength,
  createI18n, createStore, resource, readState, serializeState, hydrateGraph } from 'streetui';
const app = createApplication();
const form = createForm({ name: { initial: '', validators: [required(), minLength(2)] },
  mail: { initial: '', validators: [required(), email()] } });
const store = createStore({ n: 0 });
const i18n = createI18n({ locale: 'en', messages: { en: { hi: 'hi' } } });
const res = resource(async () => 42, { immediate: false });
const router = createRouter({ routes: [{ path: '/', component: () => app.page('h') }],
  history: createBrowserHistory() });
globalThis.__keep = [compile, createRenderer, BrowserDOMAdapter, createApplication,
  mountRouter, routerOutlet, form, store, i18n, res, router, readState, serializeState, hydrateGraph, batch, flushSync];
`;

// Forbidden identifiers grouped by concern. These are class/function names that only
// exist in server / CLI / testing / devtools code paths, or Node built-in specifiers.
const FORBIDDEN = {
  ssr: ['ServerDOMAdapter', 'renderToString', 'renderHead', 'renderStatic'],
  cli: ['runCli', 'buildProject', 'startServer', 'createProject', 'ReloadHub', 'runDev', 'runStart'],
  testing: ['renderServerThenHydrate', 'findByRole', 'findByText', 'waitForElement'],
  devtools: ['renderDevToolsHTML', 'createDevTools', 'inspectApplication', 'inspectComponents', 'inspectInteractions'],
  node: ['node:fs', 'node:path', 'node:child_process', 'node:http', 'node:zlib', 'require("fs")', "require('fs')", 'esbuild'],
};

async function main() {
  const esbuild = await loadEsbuild();
  if (!esbuild) {
    write({ schema: 'streetui-2.1-leak-check/v1', status: 'BLOCKED',
      reason: 'esbuild (measurement-only bundler) not loadable offline; no verdict fabricated.',
      timestamp: new Date().toISOString() });
    process.stdout.write('leak-check: BLOCKED — no esbuild (no verdict fabricated).\n');
    return;
  }
  async function bundle(contents) {
    const r = await esbuild.build({
      stdin: { contents, resolveDir: appDir, loader: 'js', sourcefile: 'entry.js' },
      bundle: true, minify: true, treeShaking: true, format: 'esm', target: 'es2020',
      write: false, legalComments: 'none', logLevel: 'silent',
    });
    return r.outputFiles[0].text;
  }
  const profiles = { minimal: MINIMAL_ENTRY, typical: TYPICAL_ENTRY };
  const results = {};
  let anyLeak = false;
  for (const [name, src] of Object.entries(profiles)) {
    const code = await bundle(src);
    const findings = {};
    for (const [concern, ids] of Object.entries(FORBIDDEN)) {
      const hits = ids.filter((id) => code.includes(id));
      findings[concern] = hits;
      if (hits.length) anyLeak = true;
    }
    results[name] = { bytes: Buffer.byteLength(code), leaks: findings,
      clean: Object.values(findings).every((h) => h.length === 0) };
  }
  const out = {
    schema: 'streetui-2.1-leak-check/v1',
    status: anyLeak ? 'LEAK-DETECTED' : 'OK',
    streetuiVersion: (fs.readFileSync(path.join(repo, 'packages/streetui/src/version.ts'), 'utf8').match(/VERSION\s*=\s*'([^']+)'/) || [])[1] ?? 'see version.ts',
    method: 'esbuild bundle+minify+treeShake, esm/es2020; substring scan of the emitted client bundle for server/CLI/testing/devtools/Node identifiers.',
    forbiddenGroups: Object.keys(FORBIDDEN),
    results,
    timestamp: new Date().toISOString(),
  };
  write(out);
  for (const [name, r] of Object.entries(results)) {
    process.stdout.write(`${name}: ${r.clean ? 'CLEAN' : 'LEAK'} (${r.bytes}B)` +
      (r.clean ? '' : ' -> ' + JSON.stringify(r.leaks)) + '\n');
  }
  process.stdout.write(`leak-check: ${out.status}. Wrote ${outPath}\n`);
}
main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
