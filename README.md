# StreetUI

A TypeScript-first semantic application framework with its own renderer.

StreetUI owns its entire stack:

```
DSL → Compiler → Semantic Application Graph → Runtime → Renderer → DOM
```

No React. No Vue. No Preact. No JSX. No virtual DOM libraries.

---

## Monorepo structure

```
packages/
  core/        Application identity, lifecycle, diagnostics, environment
  dsl/         Semantic TypeScript DSL
  compiler/    DSL → validation → graph compilation
  graph/       Semantic Application Graph (nodes, traversal, validation)
  runtime/     Application mounting, lifecycle, signal/event integration
  state/       Reactive signals, derived state, stores
  events/      Event bus, DOM event bridge
  scheduler/   Microtask update scheduler with priority queues
  dom/         DOM adapter abstraction (BrowserDOMAdapter, ServerDOMAdapter)
  renderer/    StreetUI's own DOM renderer — mount, patch, reconcile, SSR, hydrate
  testing/     Test renderer and query helpers
  devtools/    Graph inspector, print utilities, node stats
  router/      Client-side routing, navigation, route lifecycle

apps/
  playground/  Live browser playground
  docs/        Documentation

examples/
  basic-app/       Counter app — full end-to-end demonstration
  streetui-docs/   Multi-page docs site built on @streetui/router
  streetui-data/   Router + resource() + errorBoundary against a real HTTP API
  streetui-ssr/    Server rendering + hydration of one universal app
```

---

## Quick start

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

---

## DSL example

```ts
import { signal } from '@streetui/state';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { createRuntime } from '@streetui/runtime';
import { createRenderer } from '@streetui/renderer';

const count = signal(0);

const app = streetui.app({ name: 'Counter' });

app.page('home', page => {
  page.section('main', section => {
    section.heading('Counter');
    section.text(count);          // reactive — updates DOM automatically
    section.button('Increment', {
      onClick: () => count.update(n => n + 1),
    });
  });
});

const compiled = compile(app);
const renderer = createRenderer();
const runtime  = createRuntime({ renderer });

runtime.mount(compiled, document.getElementById('app')!);
```

---

## Rendering model

The renderer creates real DOM nodes using browser APIs via `DOMAdapter`.
When a signal changes, the signal's subscriber fires synchronously and
patches only the affected DOM node — no full re-render, no diffing the
entire tree.

```
Signal.set(value)
  → subscriber fires
  → patchNode(ctx, graphNode, propKey, newValue)
  → dom.setTextContent / setAttribute / setProperty
  → targeted DOM mutation
```

---

## Routing

Multi-page applications are built with `@streetui/router`, which sits *above*
the pipeline and drives which page is mounted. It reuses StreetUI's own signals
(for route state and active links) and the core `CleanupRegistry` (for route
teardown) — no virtual DOM, no second reactive system, no third-party deps. On
navigation only the affected route subtree is recreated; the shell persists.

```ts
import { createRouter, mountRouter, routerOutlet } from '@streetui/router';

const router = createRouter({
  routes: [
    { path: '/',              builder: (page) => page.section('home', s => s.heading('Home')) },
    { path: '/docs/:section', builder: (page, ctx) => page.section('d', s => s.heading(ctx.params.section ?? '')) },
    { path: '*',              builder: (page) => page.section('nf', s => s.heading('404')) },
  ],
});

mountRouter(router, {
  container: document.getElementById('app')!,
  shell: (shell) => { shell.section('nav', n => n.link('Home', { href: '/' })); routerOutlet(shell); },
});
```

See `packages/router/README.md` for routes, dynamic/query parameters,
navigation, active links, 404 handling, and route lifecycle cleanup.

---

## Async data: resources & error boundaries

Real applications talk to real APIs. `resource()` (in `@streetui/state`) is a
framework-native async primitive: it runs a `Promise`-returning loader and
exposes the result as ordinary StreetUI signals — `status`
(`'idle' | 'loading' | 'success' | 'error'`), `data`, `error`, plus the derived
`loading` and `isRefetching`. There is no second reactive system, no virtual
DOM, and no HTTP client baked in: the loader is any async function, so plain
`fetch()` (or anything else) works.

```ts
import { resource, derived } from '@streetui/state';

const products = resource<Product[]>(({ signal }) =>
  fetch('/api/products', { signal }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<Product[]>;
  }),
);

// Consume reactively — these are the same signals used everywhere else.
page.when(products.loading, (l) => l.text('Loading…'));
page.listOf('items', derived(() => products.data.get() ?? []), (p, _i, c) =>
  c.text(`${p.name} — $${p.price}`),
);
```

`resource()` guards against the hard parts automatically: overlapping requests
are ordered by a monotonic run id (an older response can never overwrite a newer
one), the in-flight request is aborted via `AbortController` when it is
superseded or the owner is disposed, and `refetch()` preserves the previous
`data` while reloading (surfaced as `isRefetching`). Register `dispose` with a
route's `ctx.onCleanup` and navigating away tears the resource down — it will
never update detached UI.

Failures are contained with the `errorBoundary` DSL block, which swaps its body
for a fallback when an observed error signal becomes non-null (or the body
throws while building) and hands the fallback a `retry()`:

```ts
c.errorBoundary('products', (body) => {
  body.listOf('items', list, (p, _i, x) => x.text(p.name));
}, {
  source: products.error,
  onRetry: () => void products.refetch(),
  fallback: (fb, error, retry) => {
    fb.text(`Unable to load (${(error as Error).message}).`);
    fb.button('Retry', { onClick: retry });
  },
});
```

It reuses the same reactive `when()` machinery, so the fallback subtree and all
its handlers are torn down on removal; it does *not* trap arbitrary global
errors, and errors stay observable. A complete, runnable data-driven app (real
local HTTP server, loading → list → error → retry, router-scoped cleanup) lives
in `examples/streetui-data`. See `packages/state/README.md` for the full
`resource()` reference.

---

## Server rendering & hydration

StreetUI renders the *same* application on the server and in the browser. The
server turns a compiled app into an HTML string; the browser then *hydrates*
that HTML — adopting the existing DOM and attaching behavior — instead of
throwing it away and re-rendering. Both sides consume the identical semantic
graph (DSL → Compiler → Graph); there is no second renderer, no virtual DOM, and
no third-party SSR or hydration framework.

The only new abstraction is a second `DOMAdapter`. `renderToString` drives a
`ServerDOMAdapter` (a pure in-memory node model that serializes to HTML) through
the *same* `mountGraph` used in the browser, so there is no duplicated rendering
logic and no `window`/`document` assumption on the server:

```ts
import { renderToString, serializeState } from '@streetui/renderer';

const html = renderToString(compile(app));          // "<h1>…</h1><section>…"
```

`renderToString` mounts, serializes, then disposes — an SSR render never leaves
a live subscription behind. To move server-resolved state to the client, embed
it once as an inert, XSS-safe JSON island and read it back during hydration:

```ts
const island = serializeState({ 'products': data }); // <script type="application/json" …>
// …ship `html + island`, then in the browser:
import { createRenderer, readState } from '@streetui/renderer';
import { BrowserDOMAdapter } from '@streetui/dom';

const seed = readState(new BrowserDOMAdapter(), document)['products'];
const renderer = createRenderer();
renderer.hydrate(compile(app), document.getElementById('app')!);
```

Hydration walks the graph top-down against the server DOM, matching positionally
(every node maps to exactly one element). Matching subtrees are adopted in place;
a local mismatch repairs only that subtree rather than tearing down the app.
After hydration the app is fully live — events fire, signals patch the *same*
nodes, `when()` toggles, keyed lists reorder without rebuilding, and controlled
inputs are two-way bound. `resource()` accepts `initialData`/`initialError` so a
server-resolved fetch is not repeated on the client. `mountRouter(router, {
hydrate: true })` hydrates the shell and the initial route, then takes over
client-side navigation.

A complete, runnable example — a Node `server-entry.ts` that prints a document
and exits cleanly, plus a `browser-entry.ts` that hydrates it — lives in
`examples/streetui-ssr`. See `packages/renderer/README.md` for the full
`renderToString` / `hydrate` / state-transfer reference.

---

## Packages

| Package | Description |
|---|---|
| `@streetui/core` | Identity, lifecycle, diagnostics |
| `@streetui/dsl` | Semantic TypeScript DSL |
| `@streetui/compiler` | DSL → graph compilation pipeline |
| `@streetui/graph` | Semantic Application Graph |
| `@streetui/runtime` | Mounting, signal wiring, lifecycle |
| `@streetui/state` | Reactive signals and stores |
| `@streetui/events` | Event bus and DOM bridge |
| `@streetui/scheduler` | Batched microtask scheduler |
| `@streetui/dom` | DOM adapter abstraction |
| `@streetui/renderer` | StreetUI's own DOM renderer |
| `@streetui/testing` | Test renderer and query helpers |
| `@streetui/devtools` | Graph inspector and debug tools |
| `@streetui/router` | Client-side routing, navigation, active links, route lifecycle |
