# StreetUI Documentation

StreetUI is a TypeScript-first semantic application framework with its own
compiler, semantic application graph, reactivity, and DOM renderer — no virtual
DOM, no React/Vue/Preact, no JSX runtime.

This portal indexes the reference docs. All of it describes **real, shipped
APIs**; nothing here documents a planned feature as if it exists.

## Getting started

- The repository [README](../README.md) — install, monorepo layout, quick start.
- [Architecture](./architecture.md) — how an app flows from the TypeScript DSL
  through the compiler, the one semantic graph, the runtime, and the renderer to
  the DOM; reactivity, lifecycle, SSR/hydration, router, resources, and the CLI.

## Developer experience

- [DevTools](./devtools.md) — `createDevTools`, the panel snapshot, the explicit
  refresh protocol, node selection, and the reactive inspectors
  (`inspectSignal` / `inspectResource` / `inspectRouter` / `inspectForm` /
  `inspectContext` / `inspectI18n`), including their redaction defaults.
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
`streetui-ssr`, and `streetui-full-app` — the primary end-to-end integration
example exercising SSR, hydration, navigation, forms, resources, context, and
i18n together.
