# StreetUI

**StreetUI is a complete TypeScript UI framework.** It ships its own reactivity,
a semantic UI DSL, a compiler, a semantic application graph, a direct DOM
renderer (no virtual DOM), a router, async resources, forms and validation,
context, accessibility helpers, internationalization, server-side rendering with
hydration, testing utilities, devtools, and a CLI — as **one package, one
import**.

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
const renderer = createRenderer(new BrowserDOMAdapter());
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

const renderer = createRenderer(new BrowserDOMAdapter());
renderer.hydrate(compiled, document.getElementById('app')!); // reuses server DOM
```

## Subpath entries

| Import                | What it gives you                                      |
| --------------------- | ------------------------------------------------------ |
| `streetui`            | The full framework: reactivity, DSL, compiler, graph, runtime, renderer, router, forms, context, i18n, devtools, SSR + hydration. |
| `streetui/server`     | A curated server-rendering subset (`renderToString`, `serializeState`, `readState`, `ServerDOMAdapter`). |
| `streetui/testing`    | Testing utilities (`render`, `findByRole`, `waitFor`, …). |

## What's inside (and why you don't have to think about it)

Reactivity (signals, derived, effects, batching, stores, resources), the
semantic DSL and compiler, the semantic application graph, the runtime, a
keyed DOM reconciler with no virtual DOM, the router, forms and validators,
context, i18n, SSR, hydration, devtools, and the CLI are all implemented as
internal modules and bundled into this one package. You get the whole framework
from `npm install streetui`.

## License

MIT — see [LICENSE](./LICENSE).
