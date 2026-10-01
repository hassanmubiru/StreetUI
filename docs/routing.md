# Routing

StreetUI's router is client-side, history-aware, and integrates with the same
builder DSL used everywhere else. A route is a path pattern plus a builder that
populates the page when that route is active.

## Defining routes

```ts
import { type RouteDefinition } from 'streetui';

const routes: RouteDefinition[] = [
  { path: '/',           builder: (page) => buildOverview(page, deps) },
  { path: '/dashboard',  builder: (page) => buildDashboard(page, deps) },
  { path: '/users',      builder: (page) => buildUsers(page, deps) },
  { path: '/users/:id',  builder: (page, ctx) => buildUserDetail(page, deps, ctx) },
  { path: '/settings',   builder: (page) => buildSettings(page, deps) },
  { path: '*',           builder: (page) => page.section('nf', (s) =>
                            s.heading('Not found', { id: 'nf', level: 2 })) },
];
```

Route parameters arrive on the `ctx.params` object of the second builder
argument:

```ts
function buildUserDetail(page: PageDSL, deps: AppDeps, ctx: RouteContext): void {
  const id = Number(ctx.params.id ?? '0');
  // ...
}
```

## Reading query parameters

`ctx.query` is a standard [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
built from the current location's search string. Use `.get(name)` to read a
single value — it returns `string | null` (null when the key is absent), so
guard or default it rather than assuming a string:

```ts
function buildExamples(page: PageDSL, deps: AppDeps, ctx: RouteContext): void {
  // /examples?q=form  →  'form' ; /examples  →  null → '' default
  const initialFilter = ctx.query.get('q') ?? '';
  deps.filter.set(initialFilter);

  // Other URLSearchParams methods are available too:
  ctx.query.has('q');            // boolean
  ctx.query.getAll('tag');       // string[] for repeated keys
}
```

Because `ctx.query` is rebuilt per match, reading it inside the route builder
always reflects the path the router just navigated to (including the initial
server-rendered path during SSR/hydration).

## Creating and mounting the router

Pick a history implementation, create the router, and mount it with a persistent
shell and an outlet. The shell (header/nav/sidebar) is built once; only the
outlet content changes on navigation.

```ts
import { createRouter, mountRouter, createBrowserHistory, createMemoryHistory } from 'streetui';

const history = createBrowserHistory();          // or createMemoryHistory('/')
const router = createRouter({ routes, history });

const mounted = mountRouter(router, {
  container: document.getElementById('app')!,
  shell: (sh) => buildShell(sh, router, deps),   // header/nav/sidebar + outlet
});
```

`createMemoryHistory(initialPath)` is useful for tests, server rendering, and
benchmarks where there is no browser URL bar; `createBrowserHistory()` wires up
the real address bar and the back/forward buttons.

## The outlet, custom ids, and SSR adoption

The shell declares the route outlet with `routerOutlet(scope)`. It emits a
container element the router fills on every navigation:

```ts
import { routerOutlet } from 'streetui';

function buildShell(sh: PageDSL, router: Router, deps: AppDeps): void {
  // ...header / nav...
  routerOutlet(sh);                 // default id: ROUTER_OUTLET_ID
  // ...footer...
}
```

The outlet has a two-part identity that the client and server must agree on for
hydration to adopt the server DOM instead of recreating it:

- an element **id** — `ROUTER_OUTLET_ID` (`"streetui-router-outlet"`) by
  default, or a custom id you pass to both `routerOutlet(sh, id)` and
  `mountRouter(router, { outletId: id })`; and
- a reconciliation **key** — exported as `ROUTER_OUTLET_KEY`
  (`"router-outlet"`), the container key `routerOutlet` emits.

A custom id just needs to be passed in both places:

```ts
routerOutlet(sh, 'page-outlet');                       // in the shell
mountRouter(router, { container, outletId: 'page-outlet', shell });
```

### Filling the outlet inline on the server

When you server-render a route into the outlet (so the first paint already has
content), emit the outlet container yourself with the **same key and id** the
client expects. Reference `ROUTER_OUTLET_KEY` instead of restating the literal,
so there is a single source of truth:

```ts
import { ROUTER_OUTLET_KEY } from 'streetui';

function buildShell(sh: PageDSL, router: Router, deps: AppDeps): void {
  // ...header / nav...
  if (ssr) {
    // Server: fill the outlet inline. Same key + id routerOutlet would use.
    sh.container(ROUTER_OUTLET_KEY, (c) => renderActiveRoute(c, router), {
      id: 'page-outlet',
    });
  } else {
    // Client: let the router populate it.
    routerOutlet(sh, 'page-outlet');
  }
  // ...footer...
}
```

On the client, mount with `hydrate: true` and the matching `outletId`:

```ts
mountRouter(router, { container, outletId: 'page-outlet', hydrate: true, shell });
```

The three-way agreement — `routerOutlet` id ⇔ `mountRouter.outletId` ⇔ the SSR
container's key (`ROUTER_OUTLET_KEY`) and id — is what lets the hydrating router
adopt the server-rendered outlet element node-for-node. If the id or key
diverges, the client silently recreates the subtree instead of adopting it. The
router test suite pins this (`outlet-key.hydration.test.ts`): a custom outlet id
round-trips server→hydrate with the outlet element identity preserved.

## Navigating

```ts
router.navigate('/users');   // push a new entry
router.back();               // history back
router.forward();            // history forward
```

Links created with the DSL `link(...)` method are intercepted automatically, so
`<a href="/users">` performs a client-side navigation rather than a full page
load. Nothing router-specific leaks into your view builders — they just call
`link(...)`.

## Cleanup on navigation

Leaving a route tears down everything that route created. Register per-route
cleanup with `ctx.onCleanup`, which the performance app uses to cancel an
in-flight resource and drop its watchers:

```ts
function buildUserDetail(page: PageDSL, deps: AppDeps, ctx: RouteContext): void {
  ctx.onCleanup(() => deps.userDetail.dispose());
  // ...
}
```

On navigation StreetUI removes the old route's DOM, disposes effects and
subscriptions created while it was active, and runs your `onCleanup` callbacks —
so subscriptions, effects, resources and DOM nodes do not accumulate as you move
between routes. The lifecycle test in
[`streetui-node.json`](../benchmarks/results/v1.3/streetui-node.json) mounts,
navigates every route, interacts, and unmounts repeatedly and confirms an
identical node count each cycle with zero orphan nodes after unmount.

## Tearing down the whole app

```ts
mounted.unmount();  // remove all DOM, dispose the active route
router.destroy();   // release history listeners
```

The performance app wraps both in a single `unmount()` that also disposes the
form and resource, which is the pattern to copy for a clean teardown.

Next: [Forms](./forms.md).
