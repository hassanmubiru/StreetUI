# StreetUI Playground — AI Agents

The Playground exposes an **authorized, token-authenticated control API** that
AI coding agents can use to work on a project, plus the existing JSONL dev-server
events. Agent permissions are explicit: reading/writing project files, running
the dev session, running builds, and reading diagnostics/preview URL. There is
no implicit shell execution from browser requests.

## Agent workflow

1. Open/resolve the project (`streetui playground <dir>`).
2. Read the session (`GET /__playground/api/session` with the token) → project
   root, framework version, preview URL.
3. List/read files (`GET /files`, `GET /file?path=`).
4. Edit files (`POST /file` `{path, content}`) → HMR pushes the update.
5. Read diagnostics/console from the dev-server events (the HMR WebSocket, or
   via the JSONL events the CLI emits).
6. Run a production build (`POST /build`).
7. Preview: open the `previewUrl` in a browser/preview surface.

## Token

The server injects a per-session token into the served page. Agents that access
the control API must present it (`Authorization: Bearer <token>`). Do not treat
the token as a user credential; it scopes a localhost session.

## Honest limits

- A working `previewUrl` does **not** mean an AI host panel has rendered it. The
  host must explicitly open/embed the URL.
- The Playground does not become a "Claude artifact" automatically.
- Browser-only mode cannot run arbitrary npm installs.

## Security

- File paths are confined to the project root.
- No shell execution from browser requests; no host-secret exposure.
- Localhost binding by default.
