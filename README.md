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
  dom/         DOM adapter abstraction (BrowserDOMAdapter)
  renderer/    StreetUI's own DOM renderer — mount, patch, reconcile
  testing/     Test renderer and query helpers
  devtools/    Graph inspector, print utilities, node stats
  router/      Client-side routing, navigation, route lifecycle

apps/
  playground/  Live browser playground
  docs/        Documentation

examples/
  basic-app/       Counter app — full end-to-end demonstration
  streetui-docs/   Multi-page docs site built on @streetui/router
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
