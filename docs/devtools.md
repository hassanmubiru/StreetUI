# DevTools

StreetUI ships a first-class DevTools surface in `@streetui/devtools`. It is a
**headless inspection layer**: every function turns the framework's own data —
the one compiled graph and the app's live reactive objects — into plain,
read-only snapshots. A browser panel, a CLI command, or a test can render those
snapshots however it likes.

Three principles hold throughout:

- **No second graph, no second reactive system.** Everything is derived from the
  single `CompiledApplication` and the app's own signals.
- **Explicit activation, zero production cost.** Nothing in the runtime imports
  `@streetui/devtools`. A session exists only once your dev code calls
  `createDevTools`. It is never a CLI runtime dependency either.
- **Inspection only, never mutation.** No inspector writes a signal, dispatches
  an event, or subscribes to the reactive graph. Sensitive surfaces (resource
  payloads, form values) are hidden unless you explicitly opt in.

## `createDevTools(compiled, sources?, options?)`

Creates a `DevToolsSession` over one compiled application.

```ts
import { compile } from 'streetui';
import { createDevTools } from 'streetui';

const compiled = compile(app);

const devtools = createDevTools(
  compiled,
  // sources: the app's own live reactive objects, registered explicitly
  {
    signals: { count: countSignal, name: nameSignal },
    resources: { user: userResource },
    router,
    forms: { login: loginForm },
    contexts: { theme: themeContext },
    i18n,
  },
  // options
  {
    perfThresholds: { maxDepth: 12 },
    redactSignals: true,       // hide signal values in shared sessions
    i18nCheckKeys: ['app.title', 'app.cta'],
  },
);

console.log(devtools.format());   // plain-text report
```

The compiled graph knows signal *ids* but not the live `Signal` instances, so
the app hands DevTools whichever reactive surfaces it wants visible via
`sources`. Every field of `sources` is optional — a session works with none of
them (structure-only).

### The session

```ts
interface DevToolsSession {
  readonly snapshot: DevToolsSnapshot;   // most recent capture
  refresh(): DevToolsSnapshot;           // recompute every panel from live state
  selectNode(id: string): InspectedNode | undefined;  // tree inspector (§8)
  format(): string;                      // plain-text report
}
```

Live values change **only** when you call `refresh()`. This is the explicit
refresh protocol: DevTools pulls, it is never pushed to, and it never subscribes
to a signal. Between refreshes it adds no cost to the running app.

`selectNode(id)` walks the captured graph and returns that node's subtree, so a
UI tree inspector can drill into a selected node without building its own graph.

## Panels

Each `refresh()` produces a `DevToolsSnapshot` with these panels:

- **application** — identity (name/version/compiledAt), node count, max depth,
  pages, signal count, event-handler count, state-binding count, error and
  warning counts. Sourced from `inspectApplication`.
- **graph** — the full `InspectedNode` tree (id, type, key, props, event types,
  state bindings, children, depth).
- **signals** — `boundSignalIds` (distinct signal ids referenced anywhere in the
  graph) plus `live`, one `SignalInspection` per registered signal.
- **performance** — the `PerfSnapshot` plus `diagnosePerformance` findings.
- **router / resources / forms / contexts / i18n** — present only when the
  corresponding source was registered.

## Reactive inspectors

The panels compose these standalone inspectors, which you can also call
directly. All are one-shot `peek`s — no subscription, no mutation.

### `inspectSignal(signal, options?)`

```ts
interface SignalInspection {
  readonly kind: SignalKind;             // 'writable' | 'derived'
  readonly value: unknown;               // redacted if requested
  readonly observerCount: number | undefined;
}
```

Pass `{ redact: true }` to replace the value with `'[redacted]'`, or a function
to map the raw value to a safe display form.

### `inspectResource(resource, options?)`

Reports `status`, `loading`, `isRefetching`, `hasData`, `hasError`, and the
error's `errorName` (constructor name only). The loaded `data` and error
`errorMessage` are **omitted unless** you pass `{ includeData: true }`, because
a resource payload commonly carries user or secret data.

### `inspectForm(form, options?)`

Reports `fields`, per-field validation `errors`, `touched`, `dirty`, `valid`,
and `status`. Entered field `values` are **omitted unless** you pass
`{ includeValues: true }`, because form fields frequently hold passwords.

### `inspectRouter(router)`

Reports the current route's `path`, `pattern`, `params`, `query`, and
`isFallback`.

### `inspectContext(context)`

Reports the context's `description` (from its Symbol) and whether a provider is
active. No context value is dumped.

### `inspectI18n(i18n, options?)`

Reports the active `locale` and available `locales`. Pass
`{ checkKeys: [...] }` to also get `missingKeys` — the probed keys with no
translation in the active or fallback locale.

## Application & performance inspection

`inspectApplication(compiled)` returns the `ApplicationInspection` the panels are
built on. `diagnosePerformance(compiled, thresholds?)` returns `PerfDiagnostic[]`
(`{ code, message, observed, threshold }`) computed from the same
`PerfSnapshot`. Both are pure reads of the one graph; DevTools disabled means
neither is ever called, so there is no hot-path cost in production.
