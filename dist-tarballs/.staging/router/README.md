# @streetui/router

Client-side routing for StreetUI applications: route matching, navigation,
active-link state, 404 handling, and route lifecycle cleanup — built entirely on
StreetUI's own primitives (signals, the compiler, the runtime, the renderer).

It introduces **no** virtual DOM, **no** second reactive system, and **no**
third-party dependencies. The router sits *above* the existing pipeline and
composes it:

```
DSL → Compiler → Semantic Application Graph → Runtime → Renderer → DOM
                                   ▲
                              @streetui/router  (drives which page is mounted)
```

Route state is a StreetUI `signal`; route cleanup reuses the core
`CleanupRegistry`; each route is compiled and mounted as an ordinary StreetUI
application tree. Only the affected route subtree is re-created on navigation —
the shell persists.

## Quick start

```ts
import { createRouter, mountRouter, routerOutlet } from '@streetui/router';

const router = createRouter({
  routes: [
    { path: '/',            builder: (page) => page.section('home', s => s.heading('Home')) },
    { path: '/docs',        builder: (page) => page.section('docs', s => s.heading('Docs')) },
    { path: '/docs/:section', builder: (page, ctx) =>
        page.section('doc', s => s.heading(ctx.params.section ?? '')) },
    { path: '/products',    builder: (page, ctx) =>
        page.section('p', s => s.text(`page ${ctx.query.get('page') ?? '1'}`)) },
    { path: '*',            builder: (page) => page.section('nf', s => s.heading('404')) },
  ],
});

mountRouter(router, {
  container: document.getElementById('app')!,
  shell: (shell) => {
    shell.section('nav', (n) => {
      n.link('Home', { href: '/' });
      n.link('Docs', { href: '/docs' });
    });
    routerOutlet(shell); // route content renders here
  },
});
```

## Routes

A route is `{ path, builder }`. The builder receives the page scope and a
`RouteContext`, and builds the page with the normal StreetUI DSL.

Patterns support:

| Pattern            | Matches                          | Captures            |
| ------------------ | -------------------------------- | ------------------- |
| `/`, `/docs`       | that exact path                  | —                   |
| `/users/:id`       | `/users/123`                     | `params.id = "123"` |
| `/files/*`         | `/files/a/b/c`                   | `params['*'] = "a/b/c"` |
| `*`                | anything (use as the 404 route)  | `params['*']`       |

Routes are matched in definition order — the first match wins, so list a `*`
route last.

## Dynamic parameters

`:name` segments are captured into `ctx.params` (percent-decoded):

```ts
{ path: '/users/:id', builder: (page, ctx) => {
    page.section('u', s => s.heading(`User ${ctx.params.id}`));
} }
```

## Query parameters

The query string is parsed into a standard `URLSearchParams` on `ctx.query`:

```ts
{ path: '/products', builder: (page, ctx) => {
    const page$ = ctx.query.get('page') ?? '1'; // /products?page=2 → "2"
} }
```

## Navigation

```ts
router.navigate('/docs');                 // push a new history entry
router.navigate('/docs', { replace: true }); // replace the current entry
router.navigate('/products?page=2');      // query strings are carried through
router.back();
router.forward();
```

Internal navigation uses `history.pushState`/`replaceState` — **no full-page
reload**. Genuine browser back/forward is handled via `popstate`.

Clicks on internal `<a>` elements (rendered by the existing `link()` DSL) are
intercepted for client-side navigation. External links are left untouched:
absolute URLs (`https://…`), `target="_blank"` (i.e. `link(…, { external: true })`),
`mailto:`/`tel:`, in-page `#anchors`, and modified clicks (⌘/Ctrl/Shift/Alt or
non-left button) all behave normally. Disable interception with
`mountRouter(router, { …, interceptLinks: false })`.

## Active links

`isActive` returns a reactive `ReadonlySignal<boolean>` you can consume like any
StreetUI signal (e.g. inside `when()`):

```ts
router.isActive('/docs');                 // true on /docs and /docs/anything (prefix)
router.isActive('/docs', { exact: true }); // true only on exactly /docs
```

## 404 routes

Add a `*` route as the last entry; it renders as a normal StreetUI page tree
(no special renderer path). Its match reports `currentRoute.get().isFallback === true`.
If you omit a `*` route, a minimal built-in 404 page is used; override it with
`createRouter({ routes, notFound })`.

## Route lifecycle & cleanup

On navigation A → B, the router disposes route A completely before mounting B:

1. runs A's route-scoped `CleanupRegistry` (everything registered via
   `ctx.onCleanup`), then
2. unmounts A's runtime — which disposes DOM nodes, event listeners and signal
   subscriptions via the existing `NodeInstance.dispose()` / renderer teardown.

Register any manually-created resources (effects, timers, subscriptions) with
`ctx.onCleanup` so they are torn down on navigation:

```ts
{ path: '/live', builder: (page, ctx) => {
    const stop = effect(() => console.log(count.get()));
    ctx.onCleanup(stop);                       // disposed when leaving /live
    const t = setInterval(tick, 1000);
    ctx.onCleanup(() => clearInterval(t));
} }
```

There is no second cleanup system — this is the same `CleanupRegistry` the
runtime and renderer already use.

## Hydration (SSR)

When the shell + initial route were rendered on the server, hydrate instead of
mounting cold:

```ts
mountRouter(router, { container, hydrate: true, shell });
```

With `hydrate: true`, `mountRouter` adopts the server-rendered shell and the
initial route's DOM in place (same element objects, no rebuild), resolving
dynamic params and query identically on both sides. Client-side navigation then
takes over — subsequent route changes render fresh into the outlet while the
shell persists. Use `createMemoryHistory(path)` with the same initial path on
the server so the initial match agrees. See `packages/renderer/README.md` for
`renderToString` and the state island.

## History adapters

`createRouter` uses a browser history by default. For tests or non-DOM
environments, pass an in-memory history (deterministic `back()`/`forward()`):

```ts
import { createMemoryHistory } from '@streetui/router';
const router = createRouter({ routes, history: createMemoryHistory('/docs') });
```

## API reference

- `createRouter({ routes, history?, notFound? }): Router`
  - `router.currentRoute: ReadonlySignal<RouteMatch>`
  - `router.navigate(to, { replace? })`, `router.back()`, `router.forward()`
  - `router.isActive(path, { exact? }): ReadonlySignal<boolean>`
  - `router.destroy()`
- `mountRouter(router, { container, shell?, outletId?, renderer?, interceptLinks?, hydrate? }): MountedRouter`
- `routerOutlet(scope, id?)` — declare the outlet inside a shell
- `createBrowserHistory()`, `createMemoryHistory(initial?)`
- Matching helpers: `matchPattern`, `matchRoutes`, `normalizePath`, `splitTarget`
- Types: `RouteDefinition`, `RouteContext`, `RouteMatch`, `Router`, `RouterHistory`
