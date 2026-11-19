# M10 Security Model

The Playground control API can read and write project files, run builds, and
drive a browser. It is designed for **local agent sessions only**.

## Token handling

- A 64-byte hex bearer token is generated per session and returned once, in the
  `session_attached` JSONL event and the Playground UI bootstrap.
- Authenticated routes require `Authorization: Bearer <token>`; failures return
  `401`. The token is deleted from `window.__PLAYGROUND_TOKEN__` at UI boot and
  is never served to the preview iframe or application modules.
- `POST /api/session/shutdown` sets the session's revoked flag **before**
  stopping the server, so every later authenticated request fails even while
  the socket is draining. Programmatic `stop()` revokes it too.
- `session_stopped` is emitted exactly once per session (shutdown or stop).

## Network exposure

- Default host is `localhost`; Host-header checks allow only `localhost`,
  `127.0.0.1`, `::1`, or the configured host.
- The HMR WebSocket validates the `Origin` header with the same localhost rule.
- Malformed WebSocket frames and oversized payloads (>1 MiB) are rejected;
  request bodies are capped at 2 MiB.

## File-system restrictions

Control-path file operations resolve the target inside the project root and
reject:

- paths that escape the root (`..`, absolute paths),
- symlink escapes (checked via `realpath`, including the parent for new files),
- anything under `node_modules`,
- non-regular files for export (symlinks are skipped).

## Resource limits

- Playground diagnostics buffer: 1000 events by default, configurable with
  `PlaygroundOptions.eventsMaxSize`; oldest entries are dropped first.
- Dev-server browser console/error ring buffers: 1000 entries each.
- Browser inspection requests time out after 30 s and are rejected on hub
  shutdown, so no promise or timer is left dangling.
- M11 screenshots: files are written only under
  `<project>/.streetui-cache/screenshots/<sessionId>/`, capped at 24 images,
  retrieved by generated id (never by caller-supplied paths), and deleted on
  shutdown. Automation operations are serialized and time out; disconnecting or
  stopping the playground terminates the browser process. Playwright remains an
  optional dev-only provider, never a runtime dependency.

## Out of scope

Remote execution, multi-host sessions, and publishing `@streetui/playground`.
Do not expose the control API port on a public interface.
