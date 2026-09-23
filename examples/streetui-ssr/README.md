# streetui-ssr

Universal (server + client) rendering of **one** StreetUI application. A single
semantic definition (`src/app.ts`) is rendered to HTML on the server and
*hydrated* into a live app in the browser — no forked code paths, no second
renderer, no virtual DOM.

## Files

- `src/app.ts` — the one app. `AppState` (reactive signals), `createState(seed?)`,
  `snapshot(state)`, `buildApp(page, state)`, `compileApp(state)`. The UI is a
  counter, a two-way-bound greeter input, a `when()`-gated details block, and a
  keyed todo list — enough to exercise every hydration path.
- `src/document.ts` — `renderDocument(seed?)`: builds state, `renderToString`s
  the body, embeds the state island with `serializeState`, and returns a full
  `<!doctype html>` document. Kept separate so tests can import it without
  triggering `process.exit`.
- `src/server-entry.ts` — minimal Node entry: prints the document to stdout and
  exits cleanly. No browser globals touched.
- `src/browser-entry.ts` — `hydrateApp(container, root?)`: reads the island via
  `readState`, seeds `createState`, compiles, and `renderer.hydrate`s in place.
  Auto-boots when a real `document` is present.
- `src/ssr-example.test.ts` — end-to-end SSR → hydration under happy-dom:
  document shape, DOM adoption (same nodes) + seeded state, in-place increment,
  two-way input, `when()` toggle absent from server HTML, keyed-list reorder
  reuse, and unmount teardown.

## Run

```bash
pnpm --filter @streetui/example-ssr build
node dist/server-entry.js        # prints the server-rendered document, exits 0
pnpm --filter @streetui/example-ssr test
```

The printed HTML already contains the seeded values (e.g. `Count: 5`) and the
`data-streetui-state` island; a browser loading it with `browser-entry.js`
adopts that exact DOM and brings it to life without re-rendering.
