# Getting started

StreetUI is a semantic UI framework for TypeScript. You describe an application
with a small builder DSL, StreetUI compiles that description into an application
graph, and a direct-to-DOM renderer mounts it — with fine-grained reactivity, no
virtual DOM, and no diffing of your whole tree on every change.

Everything you need comes from a single package:

```ts
import {
  signal, derived, effect, batch,   // reactivity
  streetui, compile,                // describe + compile an app
  createRenderer, BrowserDOMAdapter, // render to the DOM
  createRouter, mountRouter,         // routing
  createForm, required, email,       // forms
  resource,                          // async data
  renderToString, serializeState, readState, // SSR + hydration
} from 'streetui';
```

You never import an internal `@streetui/*` package to build an app. The public
surface is the one `streetui` package (plus the `streetui/server` and
`streetui/testing` subpaths for Node-only helpers and test utilities).

## Your first app

A StreetUI page is built by a function that receives a page builder. You add
sections, headings, text, buttons and inputs to it. Reactive values (`signal`
and `derived`) can be passed anywhere a string is accepted, and the renderer
wires them so that only the affected DOM node updates when they change.

```ts
import { signal, derived, streetui, compile, createRenderer, BrowserDOMAdapter } from 'streetui';

const count = signal(0);

const app = streetui.app({ name: 'counter' });
app.page('home', (page) => {
  page.section('counter', (s) => {
    s.heading('Counter', { id: 'title', level: 1 });
    s.text(derived(() => `count: ${count.get()}`), { id: 'count' });
    s.button('increment', { id: 'inc', onClick: () => count.set(count.peek() + 1) });
  }, { id: 'root' });
});

const compiled = compile(app);
const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
const handle = renderer.mount(compiled, document.getElementById('app')!);
// later: handle.unmount();
```

Clicking the button writes to `count`. The `derived` label recomputes, and the
renderer updates exactly one text node — not the heading, not the button, and
not any sibling region. That targeted update is the core property the rest of
these guides build on.

## The mental model

StreetUI has four stages, and it helps to keep them distinct:

1. **Describe.** `streetui.app(...)` / `page.section(...)` build a declarative
   description using the DSL. No DOM exists yet.
2. **Compile.** `compile(app)` turns the description into a `CompiledApplication`
   — a semantic application graph the renderer can mount or hydrate.
3. **Render.** `createRenderer({ domAdapter })` produces a renderer;
   `renderer.mount(compiled, container)` creates real DOM once.
4. **React.** Signals drive future updates directly against the DOM nodes they
   own. There is no re-render of the description or re-compilation.

On the server the same compiled application is turned into HTML with
`renderToString`; in the browser the same description hydrates that HTML in
place. You write the app once and it runs in both places.

## What to read next

- [Reactivity](./reactivity.md) — `signal`, `derived`, `effect`, `batch`, and
  the difference between `get()` and `peek()`.
- [Components](./components.md) — how the builder DSL composes sections, lists,
  conditionals and error boundaries, and how to factor reusable pieces.
- [Routing](./routing.md) — `createRouter` / `mountRouter`, route parameters,
  history and cleanup.
- [Forms](./forms.md) — `createForm`, validators, field state, and field
  isolation.
- [Data](./data.md) — `resource` for async loading, retry and abort.
- [SSR](./ssr.md) — rendering to HTML and serializing state.
- [Hydration](./hydration.md) — adopting server DOM without recreating it.

Every example in these guides is taken from, or matches, the real
`examples/streetui-performance-app`, which exercises the whole framework in one
application.
