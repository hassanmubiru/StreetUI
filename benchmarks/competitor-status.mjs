// DEV-ONLY benchmark artifact — StreetUI 2.2 Phase 4 competitor-harness status emitter.
// NOT part of the `streetui` runtime. Run: `node benchmarks/competitor-status.mjs`
/**
 * Phase 4 records the STATE of the cross-framework competitor harness in one
 * machine-readable file (benchmarks/results/v2.2/competitors.json):
 *   - which frameworks the harness covers (streetui + react + vue + solid + svelte),
 *   - the scenario catalogue (A–H) and where methodology lives,
 *   - the Svelte adapter repair performed this milestone,
 *   - and the honest measurement gate: BLOCKED (no registry, no browser).
 *
 * It deliberately emits NO winner, ranking, score, or superiority claim — only
 * the harness's capability and the exact reason measurement is blocked. Any
 * cross-framework numbers would require the same real browser on the same
 * machine for every framework, which is unavailable here.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { captureEnvironment } from './lib/bench-stats.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const OUT = join(HERE, 'results', 'v2.2', 'competitors.json');

const ADAPTERS = ['react', 'vue', 'svelte', 'solid'];
const adapterState = {};
for (const a of ADAPTERS) {
  const base = join(HERE, 'competitors', a);
  adapterState[a] = {
    present: existsSync(base),
    depsInstalled: existsSync(join(base, 'node_modules')),
    ssrEntry: existsSync(join(base, 'src', 'ssr.jsx')) ? 'src/ssr.jsx'
      : existsSync(join(base, 'src', 'ssr.mjs')) ? 'src/ssr.mjs' : null,
  };
}

const report = {
  schema: 'streetui-2.2-competitors/v1',
  purpose: 'StreetUI 2.2 Phase 4 — cross-framework competitor harness status. Emits harness '
    + 'capability + methodology + the honest BLOCKED measurement gate. NO winner/ranking/score/'
    + 'superiority claim is emitted, by design.',
  capturedAt: new Date().toISOString(),
  environment: captureEnvironment(REPO_ROOT),
  frameworks: {
    subject: { name: 'streetui', source: 'this repo (single public package)' },
    competitors: ADAPTERS,
    total: ADAPTERS.length + 1,
  },
  scenarioCatalogue: {
    A_initialRender: '10,000-row initial render (browser)',
    B_singleUpdate: 'one reactive update in a 10k tree (browser)',
    C_largeList: 'keyed list ops on 10k items (browser)',
    D_fanOut: 'one signal → 1k/10k cells (browser)',
    E_deepState: 'update one deep nested branch (browser)',
    F_ssr: 'server render of the 10k app (Node)',
    G_hydration: 'adopt server markup for the 10k tree (browser)',
    H_bundleSize: 'raw/gzip/brotli of runtime/minimal/full client bundles (Node)',
  },
  methodology: 'benchmarks/methodology.md',
  orchestrator: 'benchmarks/run-competitors.mjs',
  adapterState,
  svelteAdapterRepair: {
    status: 'REPAIRED (code)',
    problem: 'The Svelte browser scenario runner imported `render` from `svelte/server` and '
      + 'server-rendered the Flat tree in-browser to seed hydration (G). Svelte 5 is a COMPILED '
      + 'framework: `svelte/server` render() only operates on SERVER-compiled components, so the '
      + 'client bundle cannot server-render itself (unlike React/Vue whose renderers are runtime-'
      + 'only). This both risked incorrect/failed hydration markup and pulled the server renderer '
      + 'into the client bundle, unfairly inflating scenario H. Additionally, svelte/src/ssr.mjs '
      + 'did not export `renderFlatHtml()`, so the orchestrator could never inject Svelte SSR '
      + 'markup for G — leaving G without real server DOM to adopt.',
    fix: [
      'Added `renderFlatHtml()` to benchmarks/competitors/svelte/src/ssr.mjs (Node/SSR build, '
        + 'server-compiled) returning the Flat 10k HTML — matching the Solid adapter contract.',
      'Removed the `svelte/server` import from benchmarks/competitors/svelte/src/scenarios.mjs '
        + 'and rewrote scenario G to consume the orchestrator-injected globalThis.__SOLID_SSR_HTML__ '
        + '(shared cross-adapter key), skipping honestly with status SKIPPED when absent.',
    ],
    verifiedOffline: 'node --check passes on both edited files; svelte/server no longer imported '
      + 'by the client scenario module; renderFlatHtml export present. Full measurement is BLOCKED '
      + '(svelte/vite not installable — registry E403 — and no browser), so runtime behaviour is '
      + 'not claimed as observed.',
  },
  measurementGate: {
    status: 'BLOCKED',
    reason: 'Cross-framework benchmarking requires (a) installing react/vue/svelte/solid + vite '
      + 'from npm and (b) launching the same real Chromium for every framework. The npm registry '
      + 'is E403 and no browser binary exists in this environment. Node-only scenarios (F/H) also '
      + 'need the frameworks installed, which the registry gate blocks. No numbers are produced.',
    notFabricated: 'No competitor numbers are emitted. happy-dom is not substituted for a browser; '
      + 'published third-party benchmark numbers are not used; no ranking/score is derived.',
    preExistingSuspectFiles: 'benchmarks/results/{react,vue,svelte,solid}.json + comparison.json '
      + '(2026-09-25/28) carry numbers from a different, internally-inconsistent environment '
      + '(browserVersion=null, nodeVersion v24) and are NOT used as 2.2 evidence.',
  },
  rankingPolicy: 'By mission rule, this harness NEVER emits winner, ranking, score, or superiority '
    + 'claims. comparison.json (when a real environment exists) lists only raw comparable metrics '
    + 'per framework + a methodology pointer; rows appear only for frameworks actually measured.',
};

writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log('[competitor-status] wrote', OUT);
console.log('[competitor-status] frameworks:', report.frameworks.total,
  '(streetui +', ADAPTERS.join(', ') + ')');
console.log('[competitor-status] svelte adapter:', report.svelteAdapterRepair.status);
console.log('[competitor-status] measurement gate: BLOCKED (no registry/browser); no ranking emitted');
