# M10 Agent Workflow

A complete machine-readable session. Every step below is available without a
human in the loop; browser steps require a connected preview.

## 1. Start and attach

```bash
streetui playground --json
```

Read stdout line by line until `session_attached`. Record `url`, `previewUrl`,
`sessionId`, and `token`. All later events share this `sessionId`.

## 2. Discover

```http
GET /__playground/api/session
GET /__playground/api/files
Authorization: Bearer <token>
```

`GET /api/session` is public and confirms `sessionId`; `/api/files` lists the
editable project files.

## 3. Modify

```http
POST /__playground/api/file
{ "path": "src/app.ts", "content": "…" }
```

The dev server recompiles on write. Wait, in order, for:

1. `file_changed` for the written path,
2. `module_updated` for the module id,
3. `hmr_applied` for the same id — **only now is the edit live**.

If `hmr_failed` arrives instead, read `error`; the browser performed a full
reload. Re-inspect before claiming success.

## 4. Diagnose

- `GET /api/diagnostics` returns the buffered JSONL events (bounded, default
  1000) when you missed part of the stream.
- `GET /api/browser/console` and `GET /api/browser/errors` return captured
  `browser_console`, `browser_error`, and `runtime_error` entries.

## 5. Inspect the running app

```http
GET /__playground/api/browser/status
GET /__playground/api/browser/dom
GET /__playground/api/browser/element?selector=%23app
```

`status.connected === false` means no preview is open; inspection then returns
`503 E_BROWSER_UNAVAILABLE`. Open `previewUrl` in a browser and retry.

## 6. Fix, rebuild, verify

Repeat steps 3–5 until the runtime is clean, then:

```http
POST /__playground/api/build
```

Wait for `build_completed` (`outDir`, `files`, `durationMs`). `build_failed`
carries the error string.

## 7. Stop

```http
POST /__playground/api/session/shutdown
```

The playground emits `session_stopped`, revokes the token, and stops the dev
server (`server_stopped` follows). Verify revocation: another authenticated
call must return `401`. Exit the CLI process afterwards; do not reuse the
`sessionId`.

## Reference

- Event envelope and every event type: `m10-agent-protocol.md`
- Endpoint table and error codes: `m10-control-api.md`
- Browser command protocol: `m10-browser-inspection.md`
- Token, path, and buffer rules: `m10-security.md`
