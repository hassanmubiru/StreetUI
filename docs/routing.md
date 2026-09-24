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
