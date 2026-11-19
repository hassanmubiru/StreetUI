# M10 Playground Control API

The Playground exposes an authenticated HTTP control API on the same server as
the dev server, under the `/__playground` prefix. Start it with
`streetui playground --json` and wait for `session_attached`, which carries the
`url`, `previewUrl`, `port`, `sessionId`, and `token`.

## Authentication and host rules

- Every `/api/*` route except `GET /api/session` requires
  `Authorization: Bearer <token>`; otherwise `401 { error: "unauthorized" }`.
- Hosts are restricted to `localhost`, `127.0.0.1`, `::1`, or the configured
  host; otherwise `403 { error: "bad host" }`.
- After `POST /api/session/shutdown` the token is revoked and every subsequent
  authenticated call returns `401`.
- Request bodies are capped at 2 MiB; larger bodies return `413`.

## Endpoints

| Method & path | Description |
|---------------|-------------|
| `GET /api/session` | Public. `{ project, frameworkVersion, previewUrl, hmrPath, prefix, sessionId }`. |
| `POST /api/session/shutdown` | Revokes the token, emits `session_stopped`, stops the dev server. `DELETE` also accepted. |
| `GET /api/files` | Lists project-relative source files (ignores `node_modules`, `dist`, `.git`, caches). |
| `GET /api/file?path=` | Reads one file. |
| `POST /api/file` | Writes/creates/renames/deletes a file (JSON body with `path`, `content`, `to`). |
| `PUT /api/file` | Alias for write. |
| `DELETE /api/file?path=` | Deletes a file. |
| `GET /api/diagnostics` | `{ events }` — the bounded in-memory JSONL event buffer (default 1000 entries). |
| `POST /api/build` | Production build; emits `build_started` / `build_completed`. |
| `GET /api/templates` | Lists create templates. |
| `POST /api/create` | Scaffolds a project from a template. |
| `GET /api/export` | Streams the project as a zip. |
| `GET /api/browser/status` | `{ connected, clients, automation, previewUrl }`. |
| `GET /api/browser/clients` | M11: every connected target (`hmr` + `automation`). |
| `POST /api/browser/automation/connect` | M11: launch the optional Playwright provider (`engine`, `viewport`, `url`). |
| `POST /api/browser/automation/disconnect` | M11: close the automation browser. |
| `GET /api/browser/automation/status` | M11: `{ connected, engine?, url?, connectedAt? }`. |
| `GET /api/browser/dom` | Serialized DOM of the connected preview (`clientId` optional since M11). |
| `GET /api/browser/element?selector=` | Element attributes, dimensions, text, HTML. |
| `POST /api/browser/screenshot` | M11: real PNG via the automation provider; returns metadata. Binary at `GET /api/browser/screenshot/<id>`. |
| `POST /api/browser/interact` | M11: click/type/fill/select/press/submit/scroll/navigate/reload/resize/wait/evaluate. |
| `GET /api/browser/inspect` | M11: structured visual inspection (viewport, elements, diagnostics). |
| `POST /api/browser/disconnect` | M11: expire one `clientId` (HMR or automation). |
| `POST /api/browser/navigate` | `{ url }` — navigates the preview. |
| `POST /api/browser/reload` | Reloads the preview. |
| `GET /api/browser/console` | `browser_console` events captured this session (`clientId` filter since M11). |
| `GET /api/browser/errors` | `browser_error` and `runtime_error` events captured this session (`clientId` filter since M11). |

All paths above are relative to `/__playground`.

## Errors

Legacy routes return `{ error: string }`. The browser-inspection routes return
structured errors:

```json
{ "ok": false, "error": { "code": "E_BROWSER_UNAVAILABLE", "message": "No browser is connected to the dev server." } }
```

| Code | Meaning |
|------|---------|
| `E_BROWSER_UNAVAILABLE` | No browser client is connected (HTTP 503). |
| `E_AUTOMATION_UNAVAILABLE` | M11: automation is not connected, or Playwright/browser binaries are unavailable (HTTP 503). |
| `E_CLIENT_REQUIRED` | M11: multiple browsers are connected and no `clientId` was given (HTTP 400). |
| `E_CLIENT_NOT_FOUND` | M11: unknown or disconnected `clientId` (HTTP 404). |
| `E_ELEMENT_NOT_FOUND` | M11: the selector did not match a visible element. |
| `E_NAVIGATION_FAILED` | M11: navigation or reload failed. |
| `E_SCREENSHOT_FAILED` | M11: the browser did not produce a valid PNG. |
| `E_BAD_REQUEST` | M11: missing/invalid operation parameters (HTTP 400). |
| `E_INSPECTION_FAILED` | The browser command failed or timed out (30 s request timeout). |
| `E_UNSUPPORTED` | The preview cannot perform the operation (e.g. screenshot on an HMR-only client). |

M11 targeting rule: with no `clientId`, a single available target is used (M10
behavior); several targets require an explicit `clientId`. Ids always belong to
the current session.

Browser command results are otherwise `{ ok: true, payload }`, where `payload`
is the browser's response body (for example `{ html }` for `dom`).
