# Integration Boundaries

StreetUI is a self-contained framework, but a real application always meets the
outside world somewhere: the DOM, an HTTP backend, the URL, form input,
translations, a logger, a test runner. This document describes those seams and
where each one lives. StreetUI does not invent extra `@streetui/foo` packages to
"integrate" with things — it exposes the boundary and lets your app supply the
implementation.

## DOM

The renderer never touches the DOM directly; it goes through a small adapter
(`@streetui/dom`). `BrowserDOMAdapter` runs in a browser or a happy-dom/jsdom
test; `ServerDOMAdapter` backs `renderToString` on the server. Same renderer
code, two environments. If you need to render somewhere unusual, implement the
adapter interface rather than forking the renderer.

## HTTP / async data

Data fetching is *your* concern; StreetUI models the *result* as reactive state.
`resource(fetcher)` in `@streetui/state` wraps any async function — `fetch`, a
typed client, a DB call on the server — and exposes `status`, `loading`, `data`,
`error`, `isRefetching`, `refetch()`, and abort. StreetUI never ships an HTTP
client and makes no network calls of its own. On SSR a resource can be seeded so
the client does not re-fetch on hydration.

## Routing / URL

`@streetui/router` matches the current path against declared patterns and
exposes the match as the `currentRoute` signal. It drives navigation and route
lifecycle and, on first load, adopts server-rendered route nodes instead of
remounting them. The URL is the integration point; the router reads and writes
it, and the rest of the app reacts to `currentRoute`.

## Forms / input

`@streetui/forms` owns validation state (`values`, `errors`, `touched`,
`dirty`, `valid`, `status`) as signals. Controlled inputs bind to those signals.
Submission is your handler — the forms package validates and tracks state; it
does not post anything anywhere.

## Internationalization

`@streetui/i18n` holds the active `locale`, the available `locales`, and
translation lookup (`has(key)`, translation accessors). You provide the message
catalogs. It integrates by being a reactive source like any other signal, so UI
re-renders when the locale changes.

## Logging / observability

The application supplies the logger. StreetUI routes the diagnostics it already
produces through an optional `DiagnosticSink` (`@streetui/core`), the scheduler's
`setDiagnostics`, or a `HydrationDiagnosticSink` on the renderer. Nothing is
logged, and nothing crosses the network, unless you attach a sink. See
[Observability](./observability.md).

## Testing

`@streetui/testing` integrates with any test runner. It renders through the real
renderer into a real DOM and hands back plain DOM elements plus SSR→hydrate
helpers; you assert with whatever assertion library you already use. It is not a
Jest/Vitest replacement. See [Testing](./testing.md).

## DevTools

`@streetui/devtools` integrates by *reading* — it composes the one compiled
graph and the app's live reactive objects into inspection snapshots. It is never
imported by the runtime or the CLI, so it is never part of the production or
build path. See [DevTools](./devtools.md).

## The CLI

`@streetui/cli` is the integration point for the developer workflow: `create`
scaffolds a project, `dev` runs a dev server, `build` produces a production
bundle, `start` serves it. It depends on the runtime framework packages but not
on `@streetui/devtools`.

## Boundaries StreetUI deliberately does not cross

No HTTP client, no data-fetching library, no component library, no animation
system, no state-management replacement, no plugin marketplace, no hosted
dashboard, no telemetry backend. Each of these is either your application's
choice or explicitly out of scope.
