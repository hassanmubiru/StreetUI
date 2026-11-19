# M10 Agent Protocol (JSONL)

StreetUI's machine-readable interface for AI coding agents. With `--json`, the
CLI and the Playground write **one JSON object per line (JSONL)** to stdout.
Human-readable logs are suppressed or redirected to stderr.

## Envelope

Every event carries the same base fields:

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `1` | Protocol version. Consumers must reject unknown versions. |
| `eventId` | `string` | Unique ID for this event (UUID v4, `crypto.randomUUID()`). |
| `sessionId` | `string` | ID of the agent session the event belongs to. All events produced by one playground/dev process share it. |
| `framework` | `"streetui"` | Producer identifier. |
| `timestamp` | `string` | ISO-8601 UTC timestamp. |
| `event` | `string` | Event type (see below). |

`eventId` is generated per event; `sessionId` is generated once per session and
threaded through the CLI dispatch, dev server, builder, preview server, and
playground orchestrator. Use `sessionId` to correlate every artifact of a run
and `eventId` to de-duplicate retries.

The protocol is **additive and backward compatible** within `schemaVersion: 1`:
new event types and new optional payload fields do not change the version.

## Event types

Lifecycle:

- `project_detected` — `{ root, version, template? }`
- `environment_checked` — `{ ok, checks: [{ name, ok, detail }] }`
- `compilation_started` — `{ mode: "development" | "production" }`
- `compilation_completed` — `{ mode, modules, durationMs }`
- `server_started` — `{ url, port, host, version? }`
- `preview_ready` — `{ url, port, status: "ready", version? }`
- `server_stopped` — no payload

Playground session:

- `playground_started` — `{ url, port, host }`
- `session_attached` — `{ url, previewUrl, port, host, token, version? }`.
  **`token` is a secret.** It authenticates the control API and must never be
  placed in the preview iframe or page scripts.
- `session_stopped` — `{ reason? }`. Emitted once, on control-API shutdown or
  when the playground is stopped programmatically.
- `session_ready` — `{ url, port, host }`. Emitted exactly once, after the
  server and preview are actually ready (M11).
- `browser_connected` / `browser_disconnected` — `{ url, clientId? }`. Emitted
  when a browser target actually connects or disconnects: HMR preview clients
  (ids like `c1`) and the M11 automation provider (`clientId: "automation"`).
- `preview_inspected` — `{ url, title?, route?, readyState }`. Emitted after a
  real visual inspection (M11), never on a schedule.

Files, HMR, and builds:

- `file_changed` — `{ file }` (absolute source path).
- `module_updated` — `{ id, url, accepted }`. Emitted when the update is
  **broadcast**, not when the browser confirms it.
- `hmr_applied` — `{ file, accepted: true }`. Emitted when a browser confirms
  it applied the update for `file` (module id).
- `hmr_failed` — `{ file, error }`. Emitted when a browser fails to apply the
  update; a full reload follows.
- `build_started` — no payload
- `build_completed` — `{ outDir, files, durationMs }`
- `build_failed` — `{ error }`

Browser diagnostics:

- `runtime_error` — `{ message, stack? }` (also logged to the terminal).
- `browser_console` — `{ level: "info" | "warn" | "error", message, file?, line?, clientId? }`.
- `browser_error` — `{ message, stack?, file?, line?, column?, clientId? }`.
- `diagnostics_updated` — `{ diagnostics: DiagnosticEntry[] }`.

Since M11, `sessionId` is always non-empty: every producer resolves one at the
session boundary (`options.sessionId ?? makeEventId()`), including standalone
`createEventLogger` use. The `sessionId ?? ''` fallbacks no longer exist.

### DiagnosticEntry

`{ id, severity: "error" | "warning" | "info", code, message, file?, line?,
column?, stack?, suggestion? }`.

## Correlating an edit with its result

1. `file_changed(file)` — the watcher saw the write.
2. `module_updated(id, url, accepted)` — the update was broadcast.
3. `hmr_applied(file = id)` **or** `hmr_failed(file = id, error)` — the browser
   outcome. Only after `hmr_applied` may an agent claim the edit is live.

A CSS update confirms after its stylesheet module imports; a JS update confirms
after its accept callback runs. Failures always trigger a full reload.

## Producing events programmatically

`createEventLogger({ write, now, sessionId })` returns an `EventLogger`:

- `send(type, payload, { sessionId? })` builds the envelope (fresh `eventId`,
  `timestamp`, `schemaVersion`) and writes one JSONL line.
- `emit(event)` writes a fully-formed event unchanged.

`silentEventLogger` discards everything and is used internally with `--json`.
