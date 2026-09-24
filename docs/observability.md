# Observability & Diagnostics

StreetUI has **no telemetry service**. It never sends anything over the network,
and it never logs on its own by default. Instead the framework exposes small,
optional boundaries: your application hands StreetUI a logger, and the framework
routes the diagnostics it already produces through it. With nothing attached
there is no logging and no cost.

Everything here is privacy-safe by construction: contexts carry non-sensitive
identifiers (package, operation, node id, route, resource id) — never tokens,
secrets, cookies, or form values.

## Framework diagnostics (`@streetui/core`)

### `DiagnosticSink`

The application-provided logging seam. Every method is optional; the framework
calls only the ones present, and a sink must not throw.

```ts
interface DiagnosticContext {
  readonly package?: string;    // e.g. '@streetui/renderer'
  readonly operation?: string;  // e.g. 'hydrate', 'compile', 'navigate'
  readonly nodeId?: string;
  readonly route?: string;
  readonly resource?: string;
}

interface DiagnosticSink {
  debug?(message: string, context?: DiagnosticContext): void;
  info?(message: string, context?: DiagnosticContext): void;
  warn?(message: string, context?: DiagnosticContext): void;
  error?(message: string, context?: DiagnosticContext): void;
}
```

### `consoleDiagnosticSink(logger?)`

A ready-made sink that forwards to a `console`-like object, appending the
context as a compact ` [package=…, operation=…]` suffix. Pass your own logger to
route elsewhere:

```ts
import { consoleDiagnosticSink } from 'streetui';

const sink = consoleDiagnosticSink();          // → console
const custom = consoleDiagnosticSink(myLogger); // → your logger
```

### `frameworkError(message, context?)` / `StreetFrameworkError`

Builds an error whose message carries structured, non-sensitive context so a
developer immediately sees which package/operation/node was involved. The
message never embeds a stack or environment values — production stack-disclosure
decisions stay with your server layer.

```ts
throw frameworkError('unknown node type', {
  package: '@streetui/renderer',
  operation: 'mount',
  nodeId: node.id,
});
```

### `reportDiagnostic(sink, level, message, context?)`

Routes a diagnostic to a sink if it implements that level. Safe to call with
`undefined` (the default no-logging posture) and never throws even if the sink
method does.

## Scheduler diagnostics (`@streetui/scheduler`)

The scheduler isolates job failures — one throwing job never stops the others.
By default a swallowed error is reported to `console.error`. Install a sink to
route those failures through your own logger instead:

```ts
import { scheduler } from 'streetui';

scheduler.setDiagnostics({
  error(message, context) {
    myLogger.error(message, context);   // context is the thrown error
  },
});

scheduler.setDiagnostics(undefined);    // restore default console reporting
```

`SchedulerDiagnostics` is a local structural type (`{ error?(message, context?) }`)
so the scheduler stays dependency-free; it is structurally compatible with
`DiagnosticSink`'s `error` method. Default behaviour is unchanged when no sink is
installed — opt-in, no network.

## Hydration diagnostics (`@streetui/renderer`)

Hydration is self-repairing: when server DOM does not match the graph at a
position, the renderer mounts a fresh subtree in place and drops the offending
element. That recovery is silent by design — a local mismatch must never tear
down the whole app, and nothing is ever thrown globally.

In development you can **observe** those repairs without changing them by
attaching a `HydrationDiagnosticSink` to the renderer. For each mismatch it
reports the type (`tag-mismatch` | `missing-element` | `surplus-element`), what
was `expected`, what was `found`, the `path`, the `nodeId`/`nodeType`, the
recovery `action`, and a one-line `message`.

```ts
import {
  createHydrationDiagnosticCollector,
  consoleHydrationDiagnosticSink,
} from 'streetui';

// Accumulate into an array (tests, DevTools panel):
const { sink, diagnostics } = createHydrationDiagnosticCollector();
createRenderer({ domAdapter, hydrationDiagnostics: sink });

// Or just surface each as a console warning in dev:
createRenderer({ domAdapter, hydrationDiagnostics: consoleHydrationDiagnosticSink() });
```

When no sink is attached there is zero additional work on the hydration path.

## What StreetUI never does

No hosted telemetry. No mandatory logging. No network sends. No `console`
duplication when a sink is installed. No stack or environment disclosure in
framework error messages. Every boundary above is inert until the application
opts in.
