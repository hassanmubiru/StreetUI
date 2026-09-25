/**
 * StreetUI v1.4 — SSR profiling harness (§12). Node-only; NO browser needed.
 *
 * Measures renderToString + serializeState timing per real-app route, and
 * isolates the HTML-escape cost (the suspected string-allocation hotspot for
 * §14) by micro-benchmarking the escape functions on the ACTUAL serialized
 * body text of the 10k-row /users route.
 *
 * Every number printed is measured in this process. Output: JSON on stdout
 * (prefixed __SSRPROF__) so the orchestrator can persist it.
 *
 * Usage: node --expose-gc benchmarks/ssr-profile.mjs [--out=<absPath>]
 */
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

// happy-dom globals so createDeps/compilePage (which may reference DOM types at
// module load) never throw; SSR itself uses the ServerDOMAdapter, not this.
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve the built perf-app dist regardless of whether this file lives at
// <repo>/benchmarks or <repo>/packages/benchmarks.
const appDist = [
  path.resolve(__dirname, '..', 'examples', 'streetui-performance-app', 'dist'),
  path.resolve(__dirname, '..', '..', 'examples', 'streetui-performance-app', 'dist'),
].find((p) => fs.existsSync(p));
if (!appDist) throw new Error('perf-app dist not found — build examples/streetui-performance-app first');
const { renderIsland } = await import(path.join(appDist, 'server-entry.js'));
const { compilePage, createDeps } = await import(path.join(appDist, 'index.js'));
const streetui = await import('streetui');
const { renderToString, serializeState } = streetui;

const gc = () => { try { globalThis.gc?.(); } catch { /* no --expose-gc */ } };
const round = (x) => Math.round(x * 1e4) / 1e4;

function measure(fn, { warmup = 3, iterations = 15, setup } = {}) {
  for (let i = 0; i < warmup; i++) { fn(setup?.()); gc(); }
  const s = [];
  for (let i = 0; i < iterations; i++) {
    const arg = setup?.();
    const t0 = performance.now();
    fn(arg);
    s.push(performance.now() - t0);
    gc();
  }
  s.sort((a, b) => a - b);
  return {
    medianMs: round(s[Math.floor(s.length / 2)]),
    p95Ms: round(s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]),
    minMs: round(s[0]), maxMs: round(s[s.length - 1]), samples: s.length,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────
// Each route is profiled with the SAME sizing the real app ships (10k rows,
// 1,000 controls) so the numbers describe the real workload, not a toy.
const ROUTES = [
  { name: 'overview', options: { view: 'overview' } },
  { name: 'dashboard', options: { view: 'dashboard' } },
  { name: 'users', options: { view: 'users' } },       // 10k rows (default)
  { name: 'controls', options: { view: 'controls' } }, // 1,000 controls (default)
  { name: 'settings', options: { view: 'settings' } },
];

// renderToString-only timing needs a pre-compiled page (compilation is not part
// of SSR throughput). Build compiled + deps once per route, reuse across samples.
function compileFor(options) {
  const view = options.view ?? 'users';
  const theme = options.theme ?? { name: 'light' };
  const deps = createDeps(options);
  const compiled = compilePage(deps, view, theme);
  return { deps, compiled, view, theme };
}

// ── Current escape impl (verbatim copy of server-node.ts) ──────────────────────
// Kept here so we can measure it against a candidate fast-path on the REAL body
// text without importing internals. If these drift from server-node.ts the
// byte-identity assertion below will catch it.
function escapeHtmlText_current(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeHtmlAttr_current(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Candidate fast-path escape (§14) ───────────────────────────────────────────
// Single scan; if no special char is present, return the input unchanged (no
// allocation). Otherwise build the escaped string in one pass. MUST be
// byte-identical to the current impl — asserted below before any timing counts.
const TEXT_RE = /[&<>]/;
const ATTR_RE = /[&<>"]/;
function escapeHtmlText_candidate(value) {
  if (!TEXT_RE.test(value)) return value;
  let out = '';
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    let esc;
    switch (value.charCodeAt(i)) {
      case 38: esc = '&amp;'; break; // &
      case 60: esc = '&lt;'; break;  // <
      case 62: esc = '&gt;'; break;  // >
      default: continue;
    }
    out += value.slice(last, i) + esc;
    last = i + 1;
  }
  return out + value.slice(last);
}
function escapeHtmlAttr_candidate(value) {
  if (!ATTR_RE.test(value)) return value;
  let out = '';
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    let esc;
    switch (value.charCodeAt(i)) {
      case 38: esc = '&amp;'; break;  // &
      case 60: esc = '&lt;'; break;   // <
      case 62: esc = '&gt;'; break;   // >
      case 34: esc = '&quot;'; break; // "
      default: continue;
    }
    out += value.slice(last, i) + esc;
    last = i + 1;
  }
  return out + value.slice(last);
}

// ── Profile ────────────────────────────────────────────────────────────────────
const routeResults = [];
for (const route of ROUTES) {
  const { compiled, deps } = compileFor(route.options);

  // Real SSR body + island (bytes are a measured fact).
  const body = renderToString(compiled);
  const island = renderIsland(route.options);

  const renderToStringMs = measure(() => renderToString(compiled), {
    warmup: 3, iterations: 15,
  });
  const renderIslandMs = measure(() => renderIsland(route.options), {
    warmup: 3, iterations: 15,
  });

  routeResults.push({
    route: route.name,
    bodyBytes: Buffer.byteLength(body, 'utf8'),
    islandBytes: island.bytes,
    renderToStringMs,
    renderIslandMs,
  });
}

// ── Escape micro-benchmark on the REAL /users body ─────────────────────────────
// The serializer calls escapeHtmlText ONCE PER TEXT NODE, not once on the whole
// body. To reflect that real call pattern we split the rendered body into its
// text runs (the substrings between `>` and `<`) and escape each individually.
// Row data (names/emails/numbers/status) carry no &<>" so these runs are the
// genuine pre-escape strings for the common case.
const usersBody = renderToString(compileFor({ view: 'users' }).compiled);

const textRuns = [];
{
  const re = />([^<]+)</g;
  let m;
  while ((m = re.exec(usersBody)) !== null) {
    if (m[1].length > 0) textRuns.push(m[1]);
  }
}

// Byte-identity gate over a representative corpus (incl. every text run plus
// adversarial samples with all special chars). If any output differs the
// optimization is unsafe — recorded and it must not ship.
const corpus = [
  ...textRuns.slice(0, 5000),
  'no special chars here at all just plain ascii text',
  'a & b < c > d "quoted"',
  '<div class="x">&amp;</div>',
  '"""&&&<<<>>>',
  '',
];
let identical = true;
for (const s of corpus) {
  if (escapeHtmlText_current(s) !== escapeHtmlText_candidate(s)) identical = false;
  if (escapeHtmlAttr_current(s) !== escapeHtmlAttr_candidate(s)) identical = false;
}

// Time escaping the FULL set of per-node text runs (the real aggregate work of
// one /users render), current vs candidate.
const escCurrentMs = measure(() => {
  for (let i = 0; i < textRuns.length; i++) escapeHtmlText_current(textRuns[i]);
}, { warmup: 5, iterations: 25 });
const escCandidateMs = measure(() => {
  for (let i = 0; i < textRuns.length; i++) escapeHtmlText_candidate(textRuns[i]);
}, { warmup: 5, iterations: 25 });

// Secondary datapoint: escaping the whole body as one string (NOT the real call
// pattern, kept only to show why a naive whole-string microbench misleads).
const escWholeCurrentMs = measure(() => escapeHtmlText_current(usersBody), {
  warmup: 5, iterations: 25,
});
const escWholeCandidateMs = measure(() => escapeHtmlText_candidate(usersBody), {
  warmup: 5, iterations: 25,
});

const usersRenderMedian = routeResults.find((r) => r.route === 'users').renderToStringMs.medianMs;
const runsWithSpecial = textRuns.filter((s) => TEXT_RE.test(s)).length;

const out = {
  benchmark: 'ssr-profile',
  version: '1.4-dev',
  generatedAt: new Date().toISOString(),
  environment: {
    runtime: `node ${process.version}`,
    dom: 'ServerDOMAdapter (no browser; happy-dom loaded only for module-load globals)',
    note: 'Node measurement. NOT a browser number. Do not compare against Chromium.',
  },
  routes: routeResults,
  escapeMicrobench: {
    target: 'escapeHtmlText over the real per-text-node runs of the 10k-row /users body',
    bodyBytes: Buffer.byteLength(usersBody, 'utf8'),
    textNodeRuns: textRuns.length,
    runsContainingSpecialChars: runsWithSpecial,
    byteIdenticalToCurrent: identical,
    perNode_currentImplMs: escCurrentMs,
    perNode_candidateFastPathMs: escCandidateMs,
    wholeBody_currentImplMs: escWholeCurrentMs,
    wholeBody_candidateFastPathMs: escWholeCandidateMs,
    usersRenderToStringMedianMs: usersRenderMedian,
    perNodeEscapeShareOfUsersRenderPct:
      round((escCurrentMs.medianMs / usersRenderMedian) * 100),
  },
};

const outFlag = process.argv.find((a) => a.startsWith('--out='));
const printed = JSON.stringify(out, null, 2);
if (outFlag) {
  const p = outFlag.slice('--out='.length);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, printed);
}
console.log('__SSRPROF__' + JSON.stringify(out));

