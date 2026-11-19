# M11 Browser Automation

M11 adds a real browser automation provider to the Playground. Instead of
pretending the HMR preview iframe can capture images, an **optional Playwright
provider** drives an actual browser against the dev server's preview URL:
screenshots, interactions, and structured visual inspection.

## Provider model

- `packages/playground/src/automation.ts` — one `AutomationManager` per
  playground session (one automation browser per session, isolated from other
  projects).
- Playwright is loaded lazily (`await import('playwright')`). It is an
  **optional development-only** dependency, never a runtime dependency of
  StreetUI or of applications. If it is missing, every automation operation
  fails with `E_AUTOMATION_UNAVAILABLE` and an install hint:
  `npm install --no-save playwright && npx playwright install chromium`.
- If the exact browser build Playwright expects is absent, the provider retries
  with a real executable found in `~/.cache/ms-playwright`. If no binary exists,
  the operation is `E_AUTOMATION_UNAVAILABLE` (never simulated).
- Operations are serialized through a promise queue; default timeout 10 s
  (configurable up to 30 s). Disconnecting or stopping the playground closes the
  context and browser, and the session's temporary screenshots are deleted.

The M10 HMR-client inspection (`inspect_dom`, `inspect_element`, `navigate`,
`reload`) still works unchanged for human-opened preview tabs.

## Connecting

```http
POST /__playground/api/browser/automation/connect
Authorization: Bearer <token>
{ "engine": "chromium", "viewport": { "width": 900, "height": 600 } }
```

```json
{ "ok": true, "connected": true, "engine": "chromium", "url": "http://localhost:41097/", "connectedAt": "2026-11-19T06:00:00.000Z" }
```

`engine` is `chromium` (default), `firefox`, or `webkit`. `url` defaults to the
preview URL. `POST /api/browser/automation/disconnect` closes the browser;
`GET /api/browser/automation/status` reports `{ connected, engine?, url?,
connectedAt? }`.

Connecting emits `browser_connected` with `clientId: "automation"`;
disconnecting emits `browser_disconnected`. A visual inspection emits
`preview_inspected`, and session startup emits `session_ready` exactly once.

## Screenshots

```http
POST /__playground/api/browser/screenshot
{ "fullPage": false, "viewport": { "width": 800, "height": 500 } }
```

```json
{
  "ok": true,
  "screenshot": {
    "id": "6f0c2f0e-…",
    "format": "png",
    "width": 800,
    "height": 500,
    "bytes": 21034,
    "fullPage": false,
    "createdAt": "2026-11-19T06:01:00.000Z",
    "url": "/__playground/api/browser/screenshot/6f0c2f0e-…"
  }
}
```

- PNG only. `width`/`height` are read from the returned PNG's IHDR chunk, never
  from the request, so metadata always matches the real image.
- `fullPage: true` captures the full scrollable document (height ≥ viewport).
- `viewport` optionally resizes before capturing.
- Retrieval: `GET /__playground/api/browser/screenshot/<id>` returns
  `image/png` bytes. Retrieval is **by generated id only**; caller-supplied
  paths are never accepted, and unknown/malformed ids return
  `404 E_NOT_FOUND`.
- Files live in `<project>/.streetui-cache/screenshots/<sessionId>/`, capped at
  24 images (oldest deleted first), and the session directory is removed on
  shutdown. Requesting a screenshot for a non-automation `clientId` returns
  `E_UNSUPPORTED`.

## Interactions

```http
POST /__playground/api/browser/interact
{ "operation": "click", "selector": "#increment" }
```

```json
{ "ok": true, "operation": "click", "selector": "#increment", "durationMs": 42 }
```

| Operation | Inputs | Notes |
|-----------|--------|-------|
| `click` | `selector` | |
| `type` | `selector`, `text` | focuses then types |
| `fill` | `selector`, `value`/`text` | replaces input value |
| `select` | `selector`, `value` | `<select>` option |
| `press` | `key`, optional `selector` | keyboard key, default `Enter` |
| `submit` | `selector` | submits via Enter |
| `scroll` | `x`/`y` or `selector` | `scrollIntoView` for selectors |
| `navigate` | `url` | defaults to preview URL |
| `reload` | — | |
| `resize` | `width`, `height` | 64–4096 px |
| `waitForSelector` | `selector`, `timeoutMs` | waits for visibility |
| `waitForNavigation` | optional `url`, `timeoutMs` | |
| `waitForStable` | `timeoutMs` | `networkidle` |
| `evaluate` | `expression` | returns `{ value }` in the page context; non-serializable results are stringified |

Failures are structured, e.g. `{ "ok": false, "error": { "code":
"E_ELEMENT_NOT_FOUND", "message": "…" } }`. Codes: `E_ELEMENT_NOT_FOUND`,
`E_NAVIGATION_FAILED`, `E_INTERACTION_FAILED`, `E_BAD_REQUEST`,
`E_AUTOMATION_UNAVAILABLE`, `E_SCREENSHOT_FAILED`.

## Visual inspection

```http
GET /__playground/api/browser/inspect?selector=%23count-display&limit=25&maxText=1500
```

Returns `{ ok, inspection }` with:

- `url`, `title`, `route`, `readyState`
- `viewport` and `document` dimensions
- `visibleText` (bounded by `maxText`, with `truncated`)
- `elements`: at most `limit` entries (default 40, max 200) of
  `{ tag, id, className, text, visible, rect: { x, y, width, height },
  outsideViewport }`. With `selector`, only the first match is returned.
- `consoleErrorCount`, `runtimeErrorCount`, `failedRequestCount`,
  `brokenImageCount`, `appRootEmpty` (`null` when there is no `#app`)
- `diagnostics`: coded entries (`E_PAGE_ERROR`, `E_CONSOLE_ERROR`,
  `E_REQUEST_FAILED` as errors; `W_BROKEN_IMAGE`, `W_EMPTY_APP_ROOT`,
  `W_OUTSIDE_VIEWPORT` as warnings), each with `severity`, `message`,
  `clientId`, `timestamp`, and `url` where relevant
- `screenshotId` of the latest capture, when one exists

`GET /api/browser/element?selector=` on the automation client returns the same
element shape; `GET /api/browser/dom` returns the full serialized HTML only on
explicit request.

## Multi-client targeting

`GET /api/browser/clients` lists every target:
`[{ id: "c1", kind: "hmr" }, { id: "automation", kind: "automation", engine,
url, connectedAt }]`.

For `dom`, `element`, `navigate`, `reload`:

- `clientId` selects a specific HMR client or `automation`.
- With no `clientId`: a single available target is used (M10 behavior);
  multiple targets return `400 E_CLIENT_REQUIRED`; none returns
  `503 E_BROWSER_UNAVAILABLE`.
- Unknown or disconnected ids return `404 E_CLIENT_NOT_FOUND`.

`console` and `errors` accept `clientId` to return only that client's entries
(HMR events carry `clientId` since M11); without it, HMR entries plus the
automation log are returned. `POST /api/browser/disconnect { "clientId": "c2" }`
expires a stale HMR client (or the automation browser) and emits
`browser_disconnected`. Clients always belong to the current playground
session; ids from other sessions simply do not resolve.
