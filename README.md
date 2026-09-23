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
  devtools/    Graph inspector, application inspection, print utilities, node stats
  router/      Client-side routing, navigation, route lifecycle
  forms/       Reactive form model + synchronous validation (on signals)
  context/     Build-time provider/consumer scoping (no prop drilling)
  i18n/        Reactive, typed internationalization (on signals)
  cli/         Developer CLI — create/dev/build/start + project tooling

apps/
  playground/  Live browser playground
  docs/        Documentation

examples/
  basic-app/         Counter app — full end-to-end demonstration
  streetui-docs/     Multi-page docs site built on @streetui/router
  streetui-data/     Router + resource() + errorBoundary against a real HTTP API
  streetui-ssr/      Server rendering + hydration of one universal app
  streetui-account/  The whole platform in one app — router + resources + forms +
                     validation + context + i18n + a11y + SSR + hydration
```

Accessibility is a **cross-cutting** concern rather than a package: deterministic
id helpers live in `@streetui/core` (`a11yIds`), and ARIA/`role`/`tabindex`
attributes flow through the DSL's existing attribute API — see the Accessibility
section below.

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

## Forms & validation

`@streetui/forms` is a reactive form model built **on the same signals** as the
rest of StreetUI — no second state system. A field's `value` is a writable
`Signal<string>` that plugs straight into the DSL's `input({ bind })`, so the
renderer's existing binding is the only listener; `values`, `errors`, `touched`,
`dirty`, `valid`, and the submission `status` are all (derived) signals.

```ts
import { createForm, required, email, minLength } from '@streetui/forms';

const form = createForm({
  initialValues: { email: '', password: '' },
  validators: {
    email: [required(), email()],           // ordered — first error wins
    password: [required(), minLength(8)],
  },
  onSubmit: async (values) => { await createAccount(values); },   // may throw
});

page.input({ bind: form.field('email').value, type: 'email' });
page.button(
  derived(() => (form.submitting.get() ? 'Creating…' : 'Create account')),
  { disabled: form.submitting, onClick: () => void form.submit() },
);
```

`form.submit()` marks every field touched, then either stays `idle` (invalid —
errors now visible) or runs `idle → submitting → success | error`, capturing a
thrown value in `form.submitError`. Built-in validators are `required`,
`minLength`, `maxLength`, `email`, `pattern`; a custom one is just
`(value: string) => string | undefined`. Async validation is deliberately out of
the synchronous core — layer it on with `resource()`. Call `form.dispose()` on
teardown (e.g. `ctx.onCleanup`). See `packages/forms/README.md`.

---

## Context — no prop drilling

`@streetui/context` is a tiny build-time value stack that mirrors the synchronous
top-down DSL build — **not** React Context and **not** a reactive system.
`provide(value, run)` pushes a value for the duration of `run()` (during which
nested builders execute and may `consume()`), then pops it; consumers resolve the
nearest active provider or the required default.

```ts
import { createContext } from '@streetui/context';

const FormContext = createContext<FormScope | null>(null, 'app.form');

page.form('signup', (fb) => {
  FormContext.provide({ form, i18n }, () => {
    textField(fb, 'email');   // reads form + i18n via FormContext.consume()
  });
});
```

Put a **signal** into a context to make the shared value reactive — the signal
owns the reactivity and the normal node lifecycle tears it down. See
`packages/context/README.md`.

---

## Accessibility

StreetUI keeps accessible markup **semantic-first**: use the real element
(`heading`, `button`, `link`, `section`, `form`), add ARIA only when semantics
fall short, and never inject ARIA automatically. ARIA/`role`/`tabindex`
attributes flow through the DSL's **existing** attribute API — no parallel a11y
API to learn:

```ts
page.section('nav', (n) => n.link('Home', { href: '/' }), { role: 'navigation' });
page.text(error, { role: 'alert', ariaLive: 'polite' });
page.button('Menu', { ariaExpanded: open, ariaControls: 'menu-panel' });
```

ARIA state attributes serialize as the strings `"true"`/`"false"` (so they are
never silently dropped during SSR), and this holds through hydration.

For the id relationships accessible markup needs — `aria-labelledby`,
`aria-describedby`, a dialog title — use `a11yIds()` from `@streetui/core`. It
derives ids from a stable base string with **no counter and no randomness**, so
the server and client always compute the same ids and a re-rendered subtree
never breaks its associations:

```ts
import { a11yIds } from '@streetui/core';

const ids = a11yIds('email');   // { input:'email-input', label:'email-label', error:'email-error', ... }
group.text('Email', { id: ids.label });
group.input({ bind, id: ids.input, ariaLabelledBy: ids.label, ariaDescribedBy: ids.error, ariaRequired: true });
```

Keyboard access is handled through the existing event system (`onClick`,
`onKeydown`, …) on the real interactive elements.

---

## Internationalization

`@streetui/i18n` is reactive, typed, and — again — built on signals. `t()`
returns a derived signal that recomputes on locale change; `translate()` is a
one-shot read for values captured once (validator messages, static labels).

```ts
import { createI18n } from '@streetui/i18n';

const i18n = createI18n({ locale: 'en', messages, fallbackLocale: 'en' });

page.heading(i18n.t('app.title'));                       // reactive
page.text(i18n.t('hello', { name: 'Ada' }));             // interpolation: {name}
page.text(i18n.plural('items', count));                  // Intl.PluralRules
shell.button('EN/FR', { onClick: () => i18n.setLocale(next) });   // flips every t()
```

Keys are typed (`keyof M`), a missing key deterministically echoes the key
itself, and interpolation uses `{name}` (no ICU). Because translation is
deterministic, `renderToString()` and `hydrate()` stay in agreement **as long as
the client boots with the same initial locale the server rendered with**. See
`packages/i18n/README.md`.

---

## The whole platform together

`examples/streetui-account` is one realistic "Create account" application that
exercises **every** capability in a single build: `@streetui/router` (pages,
params, SSR + hydration), `@streetui/state` (`signal`/`derived`/`resource` for
async plan loading), `@streetui/forms` (reactive model, validators, submission
lifecycle), `@streetui/context` (form + i18n passed down without prop drilling),
`@streetui/i18n` (typed reactive translation with a live locale toggle), and
`@streetui/core` (`a11yIds` for label/description wiring). Nothing is faked —
plans are fetched over real HTTP and submitting POSTs to a real endpoint, and the
exact same build function renders on the server and hydrates on the client.

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
| `@streetui/forms` | Reactive form model + synchronous validation, on signals |
| `@streetui/context` | Build-time provider/consumer scoping (no prop drilling) |
| `@streetui/i18n` | Reactive, typed internationalization, on signals |
| `@streetui/cli` | Developer CLI: `create` / `dev` / `build` / `start`, config, env, project tooling |

---

## Getting started with the CLI

```bash
npm create streetui@latest my-app
cd my-app && npm install
npm run dev      # start the dev server with live reload
npm run build    # production build → dist/client + dist/server
npm run start    # serve the production build (SSR + hydration)
```

The CLI scaffolds a real, working server-rendered app (no placeholders, no
React, no JSX) and drives the existing StreetUI pipeline — it orchestrates
`create` / `dev` / `build` / `start` without adding a framework layer of its
own. Full reference, configuration, environment-variable rules, and SSR details
are in `packages/cli/README.md`.

---

## Publishing & consuming the packages

Every public package ships as a self-contained npm artifact: dual ESM + CJS
builds, type declarations for both, `sideEffects: false`, a per-package README
and LICENSE, and an `exports` map with matching `import`/`require` types. No
source, tests, benchmarks, temp files, or workspace paths are included in the
tarballs.

The packaging pipeline lives in `scripts/`:

```bash
node scripts/apply-publish-metadata.mjs   # normalize package.json publish fields
node scripts/generate-readmes.mjs         # ensure every package has a README
node scripts/pack-tarballs.mjs            # npm pack each package → dist-tarballs/
node scripts/consumer-smoke.mjs           # install the tarballs OUTSIDE the repo
```

`pack-tarballs.mjs` rewrites every `workspace:*` range to the concrete version
before packing, so the tarballs resolve each other with no workspace linking.
`consumer-smoke.mjs` is the package-quality gate: it creates a throwaway project
outside the monorepo, installs the packed tarballs **offline** (no registry, no
`workspace:`, no symlinks), and renders a page through `@streetui/dsl`,
`@streetui/state`, `@streetui/compiler` and `@streetui/renderer` in both ESM and
CJS. See `docs/publishing.md` for the full flow and current limitations.

---

## Production server & security

`streetui start` serves the production build over `node:http` — no additional
server framework. Static assets are served with correct MIME types,
`X-Content-Type-Options: nosniff`, and cacheable `Cache-Control` in production
(`no-cache` in dev). Path traversal is blocked by resolving each request against
the client directory and rejecting anything that escapes it (including malformed
percent-encodings and prefix-sibling directories). Render errors return a
generic `500` in production and only expose stack detail in dev. Details and the
threat model are in `docs/production-server.md`.

---

## Everything composed

`examples/streetui-full-app` is a single universal app that uses **every**
system at once — signals, i18n, context, forms, resource, SSR, hydration with
DOM-node identity, and client-side routing — verified end to end under a DOM.


