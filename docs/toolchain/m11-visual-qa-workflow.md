# M11 Agent Visual QA Workflow

A complete visual development loop for an AI agent: edit, see, interact, detect,
fix, and verify a real StreetUI application — no Playground UI required. Human
developers can keep using the Playground IDE unchanged.

All calls are relative to the playground origin and, except `GET /api/session`,
require `Authorization: Bearer <token>`.

## 1–3. Start, attach, discover

```bash
streetui playground --json
```

Read until `session_attached` and keep `url`, `previewUrl`, `sessionId`, and
`token`. `session_ready` follows exactly once.

```http
GET /__playground/api/session
GET /__playground/api/files
```

## 4–5. Edit and build the application

```http
POST /__playground/api/file
{ "path": "src/app.ts", "content": "…" }
```

Watch diagnostics for `file_changed` and `module_updated`. A production build
is `POST /api/build` (step 15 verifies it); the dev server is already running.

## 6–7. Connect a real browser and inspect

```http
POST /__playground/api/browser/automation/connect
{ "engine": "chromium", "viewport": { "width": 900, "height": 600 } }

GET /__playground/api/browser/inspect?limit=25&maxText=1500
```

`inspection.appRootEmpty === false` plus visible text and positioned elements
proves the app rendered — an HTTP 200 alone does not.

## 8. Capture a screenshot

```http
POST /__playground/api/browser/screenshot
{ "fullPage": false }
```

Fetch `screenshot.url` and verify the PNG yourself: signature
`89 50 4E 47 0D 0A 1A 0A`, IHDR width/height equal to the metadata. Full-page
and custom-viewport captures use `fullPage` and `viewport`.

## 9. Interact

```http
POST /__playground/api/browser/interact
{ "operation": "click", "selector": "#increment" }
POST /__playground/api/browser/interact
{ "operation": "fill", "selector": "#step-input", "value": "3" }
POST /__playground/api/browser/interact
{ "operation": "click", "selector": "#increment" }
GET /__playground/api/browser/inspect?selector=%23count-display
```

The element's `text` should now read `Count: 5`. A missing selector returns
`E_ELEMENT_NOT_FOUND`, not a silent no-op.

## 10–11. Retrieve errors and identify problems

```http
GET /__playground/api/browser/errors?clientId=automation
GET /__playground/api/browser/inspect
```

Use `runtimeErrorCount`, `failedRequestCount`, and the coded `diagnostics`
(errors vs. warnings) to decide what to fix. Warnings such as
`W_BROKEN_IMAGE` or `W_OUTSIDE_VIEWPORT` are not automatically failures.

## 12–13. Fix the source and verify HMR

Edit the file again, then wait in diagnostics for the module's outcome:

- `hmr_applied` — the browser confirmed the update. For CSS imports this is the
  normal path; verify the visual result, e.g.
  `{ "operation": "evaluate", "expression": "getComputedStyle(document.body).backgroundColor" }`
  and confirm application state was preserved.
- `hmr_failed` — no accept handler (or an apply error): the browser performed a
  full reload. Re-inspect; state resets by design.
- An SSR-graph edit rebuilds SSR and reloads the page. It must **not** be
  reported as `hmr_applied`; a window-level marker disappearing confirms the
  reload.

## 14. Capture the fixed UI

Take a second screenshot and compare it with the first using the real PNG
bytes — never assume the fix worked from the event alone.

## 15–16. Build and verify production

```http
POST /__playground/api/build
```

`build_completed` includes `outDir`, `files`, and `durationMs`; check that
`outDir/manifest.json` exists. Optionally serve it with `streetui start` and
point another automation session at that URL for a production visual check.

## 17. Shut down

```http
POST /__playground/api/browser/disconnect   # optional: close a specific client
POST /__playground/api/session/shutdown
```

The playground disconnects automation, deletes the session's screenshot
directory, emits `session_stopped`, revokes the token, and stops the dev
server. Another authenticated call must now return `401` (or the socket is
gone). Multi-client work uses `GET /api/browser/clients` plus explicit
`clientId` targeting; ambiguous calls fail with `E_CLIENT_REQUIRED`.

The complete acceptance run for this workflow is
`node scripts/toolchain-agent-visual-e2e.mjs --engines chromium,firefox`.
