# Testing

`@streetui/testing` renders a real StreetUI app into a real DOM (happy-dom /
jsdom) using the **same renderer the app ships with**. There is no private-graph
access and no second assertion framework — you bring your own test runner
(Vitest, node:test, …) and assert on the DOM these helpers hand back.

## Rendering an app

### `render(app)`

Compiles and mounts a `StreetApp` into a detached container, returning a
`RenderResult`:

```ts
import { render } from '@streetui/testing';

const r = render(app);

r.getByTag('button');        // first <button> (throws if missing)
r.getAllByTag('li');         // every <li>
r.getByText('Sign in');      // first leaf element containing the text
r.getAllByText('Item');      // every element whose text includes it
r.query('.card');            // querySelector (nullable)
r.queryAll('.card');         // querySelectorAll → Element[]
r.find('.card');             // querySelector that throws if nothing matches
r.flush();                   // force pending scheduler work
r.container;                 // the root container element
r.handle;                    // the underlying RenderHandle
r.unmount();                 // tear down and detach
```

### `renderOnce(app, testFn)`

Renders, runs `testFn(result)`, then unmounts and resets the id counter — even
if the test throws. Use it to avoid manual cleanup:

```ts
await renderOnce(app, (r) => {
  expect(r.getByText('Hello')).toBeTruthy();
});
```

## Queries

Beyond the container-scoped `getBy*` on `RenderResult`, two role/text helpers
work against any `Element`:

### `findByText(container, text)`

First leaf element whose text content includes `text` (throws if none).

### `findByRole(container, role, options?)` / `findAllByRole(...)`

Match by ARIA role — an explicit `role="…"` first, then the element's implicit
role (`button`, `link`, `heading`, `textbox`, `checkbox`, `radio`,
`navigation`, `form`). Optionally filter by accessible name:

```ts
findByRole(r.container, 'button', { name: 'Submit' });
findAllByRole(r.container, 'heading');
```

`findByRole` throws if zero or more than one element matches; refine ambiguous
matches with `{ name }`.

## Flushing & waiting for async work

### `flushUpdates()`

Flush all pending scheduler work, yield once to the microtask queue (so a
resolved `resource` loader applies), then flush again. `await` it after
triggering a change that schedules a DOM patch.

### `waitFor(check, options?)`

Poll `check` until it returns truthy (or stops throwing), flushing updates
between attempts. Rejects with the last error after `timeout` (default 1000ms;
`interval` default 10ms). Use it for assertions that only become true once async
work settles:

```ts
await waitFor(() => r.getByText('Loaded'));
```

## SSR → hydrate → assert

### `renderServerThenHydrate(build, options?)`

Exercises the exact production SSR path: render `build()` to HTML on the
"server", mount that HTML into a container, then hydrate the **same** app
against it. The builder is invoked twice (server then client) with
`resetIdCounter` between, so deterministic ids line up.

```ts
const h = renderServerThenHydrate(() => makeApp(), { collectDiagnostics: true });

h.serverHtml;        // the server-produced HTML (pre-hydration)
h.container;         // the now-hydrated container
h.handle;            // live RenderHandle
h.diagnostics;       // HydrationDiagnostic[] — empty unless a real mismatch
h.flush();
h.unmount();
```

Set `collectDiagnostics: true` to capture any hydration mismatches (see
[Observability](./observability.md)). With a correct app the array stays empty —
a non-empty array is a genuine server/client divergence to fix.

## Notes

These helpers require a DOM. In a real browser they run against the browser's
DOM; in a runner they run against happy-dom/jsdom. StreetUI does not fabricate a
browser environment — where no DOM is available the DOM-backed helpers cannot
run, and that limitation is documented rather than mocked away.
