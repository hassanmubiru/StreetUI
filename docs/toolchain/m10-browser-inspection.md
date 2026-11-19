# M10 Browser Inspection

Inspection rides on the existing HMR WebSocket (`/__streetui_hmr`). The dev
server exposes its `WebSocketHub` on `RunningDevServer.hub`; the Playground
control API uses it to talk to the connected preview.

## Request/response over HMR

Server → browser:

```json
{ "type": "inspect_dom", "requestId": "r169…" }
```

Browser → server:

```json
{ "type": "inspect_dom_response", "requestId": "r169…", "ok": true, "payload": { "html": "<html>…" } }
```

Failures use `"ok": false` and an `error` string. `WebSocketHub.sendRequest`
generates the `requestId`, correlates the response in its frame dispatcher, and
rejects after a 30 s timeout. `sendToClient` is fire-and-forget and returns
`false` for unknown client ids. `hub.clientIds` lists connected browsers;
`hub.closeAll()` rejects every pending request.

## Browser commands

| Command | Payload | Response payload |
|---------|---------|------------------|
| `inspect_dom` | — | `{ html }` — `document.documentElement.outerHTML` |
| `inspect_element` | `{ selector }` | `{ attributes, dimensions: { x, y, width, height }, text, html }`; `ok: false` when the selector matches nothing |
| `navigate` | `{ url }` | `{ url }` after assigning `location.href` |
| `reload` | — | acknowledged, then the page reloads |
| `screenshot` | — | HMR clients cannot capture images (`E_UNSUPPORTED`); use the M11 automation provider for real PNG screenshots |
| `get_console` / `get_errors` | — | use the control API ring buffer instead |

M11 adds real screenshots, interactions, structured visual inspection, and
multi-client targeting through the automation provider — see
`m11-browser-automation.md`.

The HTTP equivalents are documented in `m10-control-api.md`
(`/api/browser/dom`, `/element`, `/navigate`, `/reload`, `/screenshot`).

## Console and error capture

- Browser `log` messages become `browser_console` JSONL events.
- `window.onerror` / `unhandledrejection` become `runtime_error` **and**
  `browser_error` events.
- The dev server keeps a bounded ring buffer (1000 entries) of console lines
  and errors; the Playground surfaces the captured events through
  `GET /api/browser/console` and `GET /api/browser/errors`.

## HMR confirmation

`hmr_applied` / `hmr_failed` are emitted only after the browser reports the
outcome for a given module id. See `m10-agent-protocol.md` for the exact
correlation sequence an agent should wait for.
