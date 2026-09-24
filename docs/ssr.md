# Server-side rendering (SSR)

The same application description that mounts in the browser renders to an HTML
string on the server. SSR in StreetUI is a Node-only concern, so the server
helpers live on the `streetui/server` subpath and the main `streetui` barrel
re-exports `renderToString` and the state helpers.

## Rendering to HTML

Build the app exactly as you would for the client, compile it, and render:

```ts
import { renderToString, serializeState } from 'streetui';

const deps = createDeps(options);
const compiled = compilePage(deps, view, theme);

const body = renderToString(compiled);
```

`renderToString` walks the compiled application graph and produces markup with
the attributes the client hydration step needs to adopt each node. It is
deterministic: given the same inputs it produces byte-identical output, which is
what makes hydration mismatch-free.

## Serializing state for the client

The client must rebuild the *same* reactive graph the server used, or hydration
would have nothing consistent to adopt. Serialize a snapshot of the state into a
script tag and embed it next to the markup:

```ts
const stateScript = serializeState({ [STATE_KEY]: snapshot(deps) });
const island = `<div id="app">${body}</div>${stateScript}`;
```

Keep the snapshot small — it is the inputs needed to reconstruct deps (locale,
query, current filter, sizes), not the rendered data. In the performance app the
snapshot is a handful of scalars; the 10,000 rows are regenerated deterministically
on both sides from the same seed rather than shipped in the HTML.

## A full document

Wrap the island in a document and point at the client entry that will hydrate it:

```ts
function renderDocument(options: RenderOptions = {}): string {
  const { html } = renderIsland(options);
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<title>StreetUI Console</title></head><body>' + html +
    '<script type="module" src="/browser-entry.js"></script></body></html>';
}
```

## What to measure

For a realistic app the SSR figures worth tracking are generation time, the
transferred HTML size, and — on the client — hydration duration and time to
first interaction. The performance app records its per-route SSR body sizes in
[`streetui-node.json`](../benchmarks/results/v1.3/streetui-node.json) under
`ssrByView`; the 10,000-row users route is the large one because its rows are in
the markup, while the other routes are small.

Note that these are this application's SSR sizes measured in Node; they are not a
framework-wide constant and are not comparable across different apps.

## Streaming

The 1.x SSR renderer builds a complete document string; it does not stream.
Streaming SSR, if added, would be an additive API in a future minor — see
[api-v1.0.md](./api-v1.0.md).

Next: [Hydration](./hydration.md).
