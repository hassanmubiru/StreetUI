# Cross-framework benchmark methodology

> DEV-ONLY. Everything under `benchmarks/` is benchmark tooling. None of it is
> part of the shipped `streetui` runtime, and the competitor frameworks
> (React, Vue, Svelte, Solid) are **development dependencies of the harness
> only** — they must never appear in `streetui`'s dependencies.

## Status in this environment: BLOCKED (no data collected)

This machine has **no reachable npm registry** (`registry.npmjs.org` → 403) and
**no Chromium/Playwright**. The competitor frameworks therefore cannot be
installed and the in-browser scenarios cannot run here. The scenario
implementations, the orchestrator, and the result schema are complete and will
run once a registry and a real browser are available. Until then:

- `benchmarks/results/{react,vue,svelte,solid}.json` are honest **BLOCKED**
  markers (all scenario values `null`), not fabricated numbers.
- `benchmarks/results/comparison.json` carries the real StreetUI baseline row
  and BLOCKED competitor rows.

**No "StreetUI is faster/slower than X" claim is made anywhere**, because no
competitor data has been collected in this environment. The StreetUI baseline
numbers (`benchmarks/results/baseline.json`) were measured under Node +
happy-dom and are valid only as StreetUI-relative deltas; they are **not**
comparable to a real-browser competitor run that has not happened.

## The workload (scenarios A–H)

Every framework runs the SAME conceptual workload as the StreetUI harness in
`packages/benchmarks/v11-scenarios.mjs`. Each visible row is exactly one element
with a single text child (matching StreetUI's `s.text(...)`), and keyed lists
use real keys. Shared constants, list data, and list transforms live in
`benchmarks/competitors/shared/measure.mjs` so the array mutations are
byte-for-byte identical across frameworks.

<!-- METHODOLOGY_APPEND -->

| Scenario | Workload | Primary metrics |
| --- | --- | --- |
| **A** Initial render | Create 10,000 rows (`<div class="row">node i</div>`) and mount into a fresh container. | DOM-creation time (median/p95); `domNodesCreated`. Synchronous mount == interactive. |
| **B** Single reactive update | 10,000 static rows + **one** cell bound to a reactive value; update that one value. | Update duration; `domMutations` — **must be 1**. |
| **C** Large keyed list | 10,000 keyed `{id,label}` items; ops: append, prepend, remove-first, remove-middle, remove-last, reorder (swap ends), reverse, update-item. | Per-op duration; `domNodesCreated`/`domNodesRemoved`. |
| **D** Reactive fan-out | 1 reactive value → 1,000 and 10,000 bound cells; update once. | Update duration; `domMutations` — should equal `subscribers`. |
| **E** Deep reactive state | Nested `user.{profile,preferences,permissions,activity}`; update **one** deep branch. | Update duration; `nodesUpdated` — **must be 1** of 4 leaves. |
| **F** SSR | Server-render the 10,000-node app with the framework's real server renderer. | Render duration; `outputBytes`. Node-only. |
| **G** Hydration | Server-render, then hydrate the 10,000-node tree in Chromium. | Adoption duration; `domNodesCreatedDuringHydration` — should be ~0. Browser-only. |
| **H** Bundle size | Build the runtime + minimal/ssr/full apps; measure raw/gzip/brotli. | Bytes (gzip level 9, brotli default). |

### How each metric is measured fairly

- **Timing** uses the shared `measure()` helper (`shared/measure.mjs`), which
  mirrors the StreetUI harness exactly: `warmup` runs discarded, then N timed
  runs, median = element at `floor(len/2)`, p95 = element at `ceil(0.95*len)-1`,
  values rounded to 4 decimals. It reads `globalThis.performance.now()` so it is
  identical in Node and the browser.
- **"Measure to committed DOM."** StreetUI's scheduler commits synchronously.
  To be fair, each competitor's timed update ends when its DOM is actually
  committed: React updates are wrapped in `flushSync`; Solid commits
  synchronously; Vue awaits `nextTick()`; Svelte awaits `tick()`. `measure()` is
  async-capable so the await is included in the timing.
- **DOM mutations** are counted with a `MutationObserver` drained synchronously
  via `takeRecords()` (`createMutationCounter`). The reported `total`
  (characterData + added + removed + attribute records) is the browser analogue
  of StreetUI's counting DOMAdapter `structuralWrites()`. This is how B/D/E
  verify that a reactive write touches only the intended nodes.
- **`domNodesCreated`** for scenario A counts elements + text nodes in the
  mounted subtree (`countDomNodes`), the fair analogue of StreetUI's
  `createElement + createTextNode` tally. Exact totals differ per framework
  (each has its own wrapper/marker conventions); the comparison of interest is
  order-of-magnitude and the per-op churn (created/removed) in C.

### Why each framework's implementation is idiomatic and equivalent

- **React 19** (`competitors/react`) — function components + `useState`; keyed
  lists via `key={id}`; updates driven from the harness through a `bridge`
  object (setter registered in `useLayoutEffect`) and forced synchronous with
  `flushSync`; SSR via `react-dom/server` `renderToString`; hydration via
  `hydrateRoot`. React is not fine-grained, but the DOM diff means B/E still
  mutate exactly one text node — which is what the metric measures.
- **Vue 3.5** (`competitors/vue`) — render functions with `h()` and `ref`/
  `reactive` (no SFC compiler needed, so the dep set is just `vue` +
  `@vue/server-renderer`); keyed lists via `key`; SSR via `@vue/server-renderer`
  `renderToString`; hydration via `createSSRApp().mount()`.
- **Svelte 5** (`competitors/svelte`) — runes (`$state`) in a `.svelte.js`
  universal store read by `.svelte` components; keyed `{#each ... (id)}`; SSR via
  `svelte/server` `render()`; hydration via `hydrate()`. Requires the Svelte
  compiler (`@sveltejs/vite-plugin-svelte`) — runes cannot run uncompiled.
- **Solid 1.9** (`competitors/solid`) — `createSignal`/`createStore`, keyed
  `<For>` (and `<Index>` for static rows); fine-grained synchronous updates; SSR
  via `solid-js/web` `renderToString`; hydration via `hydrate()`. Requires the
  Solid compiler (`vite-plugin-solid`). Because a Solid **client** build cannot
  server-render, scenario G receives the SSR markup from the Node SSR build
  (injected by the orchestrator as `__SOLID_SSR_HTML__`); if run standalone
  without the orchestrator, Solid's G is honestly marked `SKIPPED`, never faked.

### Fairness caveats (documented, not hidden)

- Absolute numbers are only comparable when every framework is measured in the
  **same real browser** on the **same machine**. The StreetUI baseline in this
  repo was taken under Node + happy-dom and is explicitly not a browser number.
- Bundle-size categories are best-effort analogues. `runtime`/`minimalApp`/
  `fullApp` are self-contained client bundles (framework inlined, esbuild
  minify); `ssrSubset` is the self-contained SSR bundle; `routerApp` is `null`
  for the competitors because no framework router is in the pinned dependency
  set (StreetUI ships a router in-core), so a comparison there would be
  apples-to-oranges.

## Environment

- Node: `v22.23.2` (see each result file's `nodeVersion`).
- DOM for A/B/C/D/E/G: **real Chromium via Playwright** (pinned `1.63.0`) — the
  whole point of the competitor harness is a real browser. **BLOCKED here.**
- Pinned competitor + tooling versions: `benchmarks/framework-versions.json`
  (React 19.1.0 / react-dom 19.1.0, Vue 3.5.13 + @vue/server-renderer 3.5.13,
  Svelte 5.19.0, solid-js 1.9.3, Vite 6.0.7, Playwright 1.63.0). Playwright is
  pinned to ONE version (`1.63.0`) repo-wide — root devDependency, this benchmark
  tooling (`benchmarks/package.json` + lockfile), and the `PINNED_PLAYWRIGHT`
  constant in `benchmarks/browser/run-all.mjs` all agree (v1.6 §3). Framework
  compiler plugins (`@vitejs/plugin-react`, `@sveltejs/vite-plugin-svelte`,
  `vite-plugin-solid`) are the required build toolchain and are pinned in each
  competitor `package.json` with a best-known exact version; resolve them to the
  release compatible with Vite 6 and the framework major when the registry is
  reachable.

## How to run (on a machine with a registry and a browser)

```sh
# 1. Install the orchestrator tooling (vite + playwright)
cd benchmarks && npm install

# 2. Install each competitor's pinned deps
for fw in react vue svelte solid; do (cd competitors/$fw && npm install); done

# 3. Install a real browser for Playwright
npx playwright install chromium

# 4. Run the competitor suite (writes results/{react,vue,svelte,solid}.json)
node run-competitors.mjs
```

The orchestrator builds each competitor with its own Vite config (SSR bundle for
F, client bundles for H, a static bench site for A/B/C/D/E/G served via `vite
preview` and driven by Chromium). If no competitor is installed it prints
`competitors: BLOCKED (no registry/browser)` and exits 0 **without overwriting**
the existing BLOCKED result files. A result file is overwritten **only** for a
framework that actually measured something.

## No comparative claim

Because competitor data has not been collected in this environment, this harness
makes **no claim that StreetUI is faster or slower than React, Vue, Svelte, or
Solid**. The StreetUI baseline numbers stand on their own as StreetUI-relative
measurements; any cross-framework conclusion requires a completed run of this
harness in a real browser with the pinned dependencies installed.

