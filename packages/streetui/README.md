# StreetUI

**StreetUI is a complete TypeScript application framework.** It ships its own
reactivity, a semantic UI DSL, a compiler, a semantic application graph, a
direct DOM renderer (no virtual DOM), a router, async resources, data mutations,
first-class components, overlays with portals and focus management, CSS
transitions, accessibility platform, forms, context, i18n, SSR with static-plan
acceleration, hydration, testing utilities, DevTools, and a CLI —
as **one package, one import**.

Current version: **2.1.0** · [Changelog](https://github.com/streetui/streetui/blob/main/CHANGELOG.md)

You install one thing:

```bash
npm install streetui
```

…and you import everything from one place:

```ts
import {
  signal,
  derived,
  streetui,
  compile,
  createRenderer,
  createRouter,
  resource,
  createForm,
  createContext,
  createI18n,
  renderToString,
  serializeState,
} from 'streetui';
```

There is no need to install or reason about a constellation of separate
`@streetui/*` packages. StreetUI is internally modular for maintainability, but
externally it is a single framework with a single public surface.

## Create a new app

```bash
npx streetui create my-app
cd my-app
npm install
npm run dev
```

The generated project depends on exactly one runtime package — `streetui` — and
all of its source imports from `"streetui"`.

## CLI

The CLI is part of the same package:

```bash
streetui create <dir>     # scaffold a new app (choose --template basic | ssr)
streetui dev              # start the dev server (--port, --host)
streetui build            # production build
streetui start            # run the production server (--port, --host)
streetui --help
streetui --version
```

## A tiny app

StreetUI's UI layer is a **semantic builder DSL** — you describe pages and
sections with builders rather than free-standing element functions:

```ts
import { streetui, signal, compile, createRenderer, BrowserDOMAdapter } from 'streetui';

const count = signal(0);

const app = streetui.app({ name: 'counter' });
app.page('home', (page) => {
  page.heading('Hello, StreetUI', { level: 1 });
  page.section('main', (s) => {
    s.text(() => `Count: ${count.get()}`, { id: 'count' });
    s.button('Increment', { id: 'inc', onClick: () => count.set(count.peek() + 1) });
  });
});

const compiled = compile(app);
const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
renderer.mount(compiled, document.getElementById('app')!);
```

## Server-side rendering & hydration

Render on the server and hydrate on the client using the same framework:

```ts
// server
import { renderToString, serializeState } from 'streetui/server';

const html = renderToString(compiled); // → HTML string
const state = serializeState({ counter: { count: 0 } });
```

```ts
// client
import { createRenderer, BrowserDOMAdapter } from 'streetui';

const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
renderer.hydrate(compiled, document.getElementById('app')!); // reuses server DOM
```

## Subpath entries

| Import | What it gives you |
|---|---|
| `streetui` | The full framework: reactivity, DSL, compiler, graph, runtime, renderer, router, forms, context, i18n, components, overlays, transitions, a11y, data, devtools, SSR + hydration. |
| `streetui/server` | Server-rendering subset: `renderToString`, `renderHead`, `ServerDOMAdapter`, `inspectComponents`, `inspectInteractions`, `renderDevToolsReport`. |
| `streetui/testing` | Testing utilities: `render`, `findByRole`, `waitFor`, `renderComponent`, `findComponent`, `trigger`, `openOverlay`, `waitForTransition`. |

## What's inside (and why you don't have to think about it)

Reactivity (signals, derived, effects, batching, stores, resources, mutations),
the semantic DSL and compiler, the semantic application graph, the runtime, a
keyed DOM reconciler with no virtual DOM, first-class components, the router,
forms and validators, context, i18n, overlays (dialog/popover/tooltip/dropdown/
toast) with portals and focus management, CSS-class transitions, an
accessibility platform (keyboard nav, live regions, focus trapping, deterministic
a11y ids), SSR with static-plan acceleration, hydration, DevTools, and the CLI
are all implemented as internal modules and bundled into this one package. You
get the whole framework from `npm install streetui`.

## License

MIT — see [LICENSE](./LICENSE).
