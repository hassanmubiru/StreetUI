# @streetui/renderer

StreetUI's own DOM renderer. It mounts a compiled semantic graph into real DOM,
patches individual nodes when signals change, reconciles keyed lists, renders
the *same* graph to an HTML string on the server, and hydrates server HTML into
a live app in the browser. There is no virtual DOM and no third-party SSR or
hydration framework — browser and server share one pipeline
(DSL → Compiler → Graph → Runtime → Renderer).

## Browser mount

```ts
import { createRenderer } from '@streetui/renderer';

const renderer = createRenderer();                 // BrowserDOMAdapter by default
const handle = renderer.mount(compile(app), document.getElementById('app')!);
// …later
handle.unmount();                                  // disposes subscriptions + listeners
```

`mount` creates the full DOM tree, wires events, and opens signal subscriptions.
When a signal changes, its subscriber patches only the affected node
(`setTextContent` / `setAttribute` / `setProperty`) — no re-render, no diffing.

## Server rendering — `renderToString`

```ts
import { renderToString } from '@streetui/renderer';

const html = renderToString(compile(app));         // "<h1>…</h1><section>…"
// or with an explicit adapter:
renderToString(compile(app), { domAdapter: new ServerDOMAdapter() });
```

`renderToString` runs the exact same `mountGraph` pipeline used in the browser,
but against a `ServerDOMAdapter` — a lightweight in-memory node model that
serializes to HTML. It emits only the application's own elements (the synthetic
container is not serialized), so you embed the result wherever the client will
mount, e.g. `<div id="app">${html}</div>`.

Void elements are emitted HTML5-style — `<img src="…">` and `<input …>` with no
self-closing slash and no closing tag. Text and attribute values are escaped, so
markup is XSS-safe by construction.

**Lifecycle (no leaked subscriptions).** The synchronous mount opens signal
subscriptions; on the server those would live forever. `renderToString`
therefore disposes the root instance immediately after serializing — SSR has a
*render* lifecycle only. Mutating a signal after `renderToString` returns is a
safe no-op; the live *runtime* lifecycle is established later on the client by
`hydrate`.

## State transfer — `serializeState` / `readState`

Server-resolved state (e.g. a fetched list) crosses to the client as an inert
JSON island rather than being re-fetched:

```ts
import { serializeState, readState } from '@streetui/renderer';
import { BrowserDOMAdapter } from '@streetui/dom';

// server:
const island = serializeState({ products: data });  // <script type="application/json" data-streetui-state>…</script>
// ship `html + island`

// client:
const state = readState(new BrowserDOMAdapter(), document);
const products = state['products'];
```

`serializeState` returns `''` for an empty map, and escapes `<`, `>`, `&`,
`U+2028`, and `U+2029` as `\uXXXX` code points so the payload can never break out
of the `<script>` (a literal `</script>` in the data is neutralized).
`readState` is routed through a `DOMAdapter`, so it never assumes a global
`document` and returns `{}` when the island is absent or unparseable — hydration
then proceeds as a cold client render.

## Hydration — `hydrate`

```ts
const renderer = createRenderer();
const handle = renderer.hydrate(compile(app), document.getElementById('app')!);
```

`hydrate` walks the graph top-down against the server DOM, matching each graph
node positionally to one element by tag. Matching subtrees are **adopted in
place** — the same element objects are reused, never deleted and recreated. A
local mismatch (e.g. server emitted `<h1>` where the client graph expects `<p>`)
repairs only that subtree via a fresh mount at that position; the rest of the app
is untouched. Surplus server DOM beyond the graph is removed.

After hydration the app is fully live and behaves exactly like a browser mount:

- **Events** are wired once (single listener per node — no duplicates).
- **Reactive text/attributes** patch the *same* server node on signal change.
- **`when()`** toggles its branch in place, even when the branch was absent from
  the server HTML.
- **Keyed lists** (`listOf`) reorder by reusing the existing server `<li>`
  nodes rather than rebuilding them.
- **Controlled inputs** adopt their server value and are two-way bound —
  typing updates the signal, and signal changes update the input.

`runtime.hydrate` uses `this._renderer.hydrate ?? this._renderer.mount`, so a
renderer without hydration support degrades gracefully to a cold mount.

## Router & resource hydration

`mountRouter(router, { hydrate: true, container, shell })` hydrates the
persistent shell and the initial route from the server HTML, resolving dynamic
params and query the same way on both sides, then takes over client-side
navigation (subsequent route changes mount fresh; the shell persists). See
`packages/router/README.md`.

`resource()` accepts `initialData` / `initialError` / `initialStatus` so a
server-resolved fetch seeds the client and is *not* repeated on hydration (pass
`immediate: true` only if you deliberately want a client refetch). See
`packages/state/README.md`.

## Server environment & error handling

`renderToString` runs under plain Node.js with no `window`/`document`/`location`
/`localStorage` assumptions (all DOM access goes through the adapter), so it is
framework-neutral and drops into any Node HTTP layer (including StreetJS). Errors
thrown while building the graph surface normally out of `renderToString`; the
renderer does not swallow them. In the app itself, failures stay observable and
contained via the `errorBoundary` DSL block (see the root README), which works
identically after hydration.

## Streaming (future)

Streaming SSR (flushing HTML in chunks / progressive hydration) is intentionally
**not** implemented in v0.4. The current model renders a complete document and
hydrates it in one pass. The `ServerDOMAdapter` + `mountGraph` split leaves room
to add a streaming serializer later without a second renderer; it is tracked as
future work.

## Public API

`renderToString`, `RenderToStringOptions`, `serializeState`, `readState`,
`STATE_MARKER_ATTR`, `createRenderer` (with `mount` / `hydrate`), and the
`RenderHandle` returned by both. All rendering paths consume a
`CompiledApplication` from `@streetui/compiler`.
