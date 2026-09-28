# StreetUI Documentation

StreetUI is a TypeScript-first semantic application framework with its own
compiler, semantic application graph, reactivity, and DOM renderer — no virtual
DOM, no React/Vue/Preact, no JSX runtime.

It ships as a **single npm package**, `streetui`. You install one package and
import everything from it:

```bash
npm install streetui
```

```ts
import { signal, streetui, compile, createRenderer, createRuntime } from 'streetui';
```

Two curated subpaths live in the same package: `streetui/server`
(`renderToString`, `serializeState`, `readState`, `ServerDOMAdapter`) and
`streetui/testing` (`render`, `findByRole`, `waitFor`, `renderServerThenHydrate`,
`flushUpdates`). Scaffold a new app with:

```bash
npx streetui create my-app     # templates: basic, ssr
```

Internally StreetUI is still modular (the `@streetui/*` modules described in
[Architecture](./architecture.md)), but consumers never install those
individually — only `streetui`.

StreetUI is a **complete application framework**: reactivity, components,
routing, data, forms, async UI, overlays, accessibility, transitions, document
metadata, SSR, hydration, testing, DevTools, and a CLI — all from one package.
This portal indexes the reference docs. All of it describes **real, shipped
APIs**; nothing here documents a planned feature as if it exists.

## Learning path

Read these in order to build a complete app, from your first page to a deployed
production build. Every page begins with `npm install streetui` and uses only
real, shipped APIs.

1. [Getting started](./getting-started.md) — the mental model and your first app.
2. [Architecture](./architecture.md) — core concepts: DSL → compiler → semantic
   graph → runtime → renderer → DOM.
3. [Components](./components.md) — the builder DSL, composition, `when`, `listOf`,
   the `component()` primitive, and native child composition.
4. [Reactivity](./reactivity.md) — `signal`, `derived`, `effect`, `batch`, and
   `get()` vs `peek()`.
5. [Routing](./routing.md) — `createRouter` / `mountRouter`, params, history, and
   cleanup.
6. [Data](./data.md) — `resource` for async loading; `mutation`, the
   form → mutation → invalidate write path, the optional `createClient` HTTP
   client, and `createAuthSession`.
7. [Forms](./forms.md) — `createForm`, validators, field state, and field isolation.
8. [Async UI](./async-ui.md) — `asyncBoundary` and `errorBoundary` over the
   `resource` state machine.
9. [Overlays](./overlays.md) — `dialog` / `popover` / `tooltip` / `dropdown` /
   `toast` and the `portal` beneath them.
10. [Accessibility](./accessibility.md) — focus utilities, `createAnnouncer`,
    `a11yIds`, and `rovingMenu`.
11. [Transitions](./transitions.md) — the CSS class-based enter/leave engine.
12. [SSR](./ssr.md) — `renderToString`, `renderHead`, and state serialization.
13. [Hydration](./hydration.md) — adopting server DOM with the zero-node guarantee.
14. [Testing](./testing.md) — `render`, role/text queries, `waitFor`, and the
    `renderServerThenHydrate` workflow.
15. [DevTools](./devtools.md) — `createDevTools`, `renderDevToolsHTML`, the
    one-call `renderDevToolsReport`, and the reactive inspectors.
16. [CLI](./cli.md) — `create` / `dev` / `build` / `start` and the programmatic API.
17. [Deployment](./deployment.md) — building, serving, and the client/server boundary.

The [Application platform](./application-platform.md) page ties overlays,
transitions, async UI, metadata, and i18n together through the showcase app.

## Release & 1.0

- [Public API statement & report](./api-v1.0.md) — the frozen 1.0 surface (168
  values, 171 types across 17 packages, all stable), the semver policy, how the
  surface is enforced, and the post-1.0 roadmap.
- [Migrating to 1.0](./migration-to-1.0.md) — there is nothing to migrate; the
  small version-alignment fixes, and what "stable" commits the project to.
- [Release process](./release-process.md) — the release gates and the scripts
  that enforce them, and the honest BLOCKED status of the browser and registry
  gates.
- [Browser & runtime support](./browser-support.md) — target environments, what
  was validated (happy-dom, Node 22), and what was not (real browsers).
- [Changelog](../CHANGELOG.md).

## Getting started

- The repository [README](../README.md) — install, monorepo layout, quick start.
- [Architecture](./architecture.md) — how an app flows from the TypeScript DSL
  through the compiler, the one semantic graph, the runtime, and the renderer to
  the DOM; reactivity, lifecycle, SSR/hydration, router, resources, and the CLI.

## Reference by area

Beyond the ordered learning path above, these group the same docs by concern:

- **Building UI:** [Components](./components.md), [Reactivity](./reactivity.md),
  [Overlays](./overlays.md), [Accessibility](./accessibility.md),
  [Transitions](./transitions.md).
- **Data & navigation:** [Routing](./routing.md), [Data](./data.md),
  [Forms](./forms.md), [Async UI](./async-ui.md).
- **Rendering & delivery:** [SSR](./ssr.md), [Hydration](./hydration.md),
  [CLI](./cli.md), [Deployment](./deployment.md).
- **The platform, tied together:** [Application platform](./application-platform.md)
  — overlays, transitions, async & error boundaries, document metadata
  (`head` / `renderHead`), and i18n, demonstrated by the showcase.

## Developer experience

- [DevTools](./devtools.md) — `createDevTools`, the panel snapshot, the explicit
  refresh protocol, node selection, the one-call `renderDevToolsReport`, and the
  reactive inspectors (`inspectSignal` / `inspectResource` / `inspectRouter` /
  `inspectForm` / `inspectContext` / `inspectI18n`), including their redaction
  defaults.
- [Testing](./testing.md) — `render` / `renderOnce`, container and role/text
  queries, `flushUpdates` / `waitFor`, and the `renderServerThenHydrate`
  SSR→hydrate→assert workflow.
- [Observability & Diagnostics](./observability.md) — `DiagnosticSink`,
  `frameworkError`, `consoleDiagnosticSink`, the scheduler's `setDiagnostics`,
  and dev-only hydration diagnostics. No telemetry, no network sends.
- [Integration Boundaries](./integration.md) — where the app meets the DOM,
  HTTP/async data, the URL, forms, i18n, logging, testing, and the CLI, and the
  boundaries StreetUI deliberately does not cross.

## Performance

- [Performance overview](./performance.md)
- [Hot paths](./performance-hotpaths.md)
- [v0.7 performance work](./performance-v0.7.md)
- [Browser-validation notes (v0.8)](./performance-browser-v0.8.md)

## Operations

- [Production server](./production-server.md) — serving a built app.
- [Publishing](./publishing.md) — release metadata, packaging, and the
  non-mutating release check.

## Per-package reference

The public packages are documented at their source and in the sections above:
`core`, `state`, `graph`, `dsl`, `compiler`, `runtime`, `events`, `scheduler`,
`dom`, `renderer`, `router`, `forms`, `i18n`, `context`, `devtools`, `testing`,
and `cli`. `benchmarks` is private and not published.

## Example applications

Real, buildable examples live under [`examples/`](../examples): `basic-app`,
`streetui-account`, `streetui-data`, `streetui-docs`, `streetui-showcase`,
`streetui-ssr`, and `streetui-full-app`. The **`streetui-showcase`**
`platform-showcase` app is the primary end-to-end integration example for the
2.0 application platform — routing, overlays, transitions, async data, error
handling, the form → mutation → refetch write path, per-route metadata, i18n,
a11y, and SSR + hydration together; `streetui-full-app` covers the same
SSR/hydration/router/forms/resources/context/i18n baseline.
