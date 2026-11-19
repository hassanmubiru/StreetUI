# StreetUI Playground — Architecture

The Playground is an **orchestration layer** on top of the independent StreetUI
toolchain. It is a StreetUI-built IDE (DSL → Compiler → Graph → Runtime →
Renderer) plus a local server that reuses the existing dev server, resolver,
HMR, and builder. It never simulates execution and never uses Vite/another
bundler/another framework.

## Roles

- **`@streetui/playground`** (new package):
  - `ui/` — the IDE (StreetUI app + CodeMirror 6 editor host).
  - `server/` — `runPlayground(project)` local orchestration + control API.
- **`@streetui/cli`** — new `streetui playground` command spawns the Playground
  server for the resolved project and relays its JSONL `preview_ready` event.
- **Existing toolchain** — `createDevServer` (dev server + HMR + module graph +
  TypeScript transform) is reused in-process via the `beforeRequest` mount hook.

## Execution modes

1. **Local (primary).** `streetui playground` starts the dev server for the
   target project and mounts the Playground at `/__playground/`. The preview
   iframe points at the real dev-server URL. HMR drives live updates; the
   documented reload fallback applies when a change cannot be preserved safely.
2. **Browser-only artifact** (investigated; limited). Serving a self-contained
   built StreetUI artifact is possible, but arbitrary npm installation is not
   available in a browser, so full Node development is not promised in that
   mode.
3. **Remote** (design only; not built). See `remote-execution.md`.

## Control API

All `/__playground/api/*` routes (except `/session`) require the per-session
token (`Authorization: Bearer <token>`), which is injected into the served page.

- `GET /session` — project root, framework version, preview URL, HMR path.
- `GET /files` — file list (skips `node_modules`, `dist`, `.git`, caches).
- `GET /file?path=` — read.
- `POST /file` `{path, content}` — write (creates parent dirs).
- `PUT /file` `{from, to}` — rename/move.
- `DELETE /file?path=` — delete.
- `POST /build` — runs the production build; returns summary.

## Security

- Localhost binding by default; explicit host opt-in.
- Every file path is resolved with `path.relative` containment against the
  project root (no traversal, no unrelated-host access).
- Control routes are token-authenticated; the WebSocket HMR origin is validated.
- No arbitrary shell execution from browser requests.
- No environment secrets are exposed to browser code.
- The preview iframe is sandboxed (`allow-scripts allow-same-origin allow-forms
  allow-popups allow-downloads`); `allow-same-origin` is required so the app's
  ESM modules load (an opaque-origin sandbox triggers cross-origin CORS blocks
  on module scripts). This is acceptable because the project code is the user's
  own local code and the server is localhost-bound.

## UI components

- Header: brand, project name, Run / Build / Share / (future Settings).
- File explorer: tree from `/files`, click to open.
- Editor host: CodeMirror 6 with TypeScript support; Ctrl/Cmd+S saves.
- Preview: responsive device presets; iframe to the real dev server.
- Bottom panels: Console, Diagnostics, Build output.

## Milestones status (M9)

- M9.0 architecture + audit — done.
- M9.1 UI shell — done (header/explorer/editor/preview/panels).
- M9.2 local execution integration — done (`runPlayground` + CLI command).
- M9.3 editing/live dev — done (read/write/save/HMR/diagnostics/build).
- M9.4 templates/persistence — partial (operates on any StreetUI project; 10
  in-UI templates + IndexedDB browser persistence are follow-ups).
- M9.5 AI-agent integration — documented (see `ai-agents.md`); control API is
  the authorized surface.
- M9.6 browser artifact mode — investigated/limited documented.
- M9.7 reliability/release prep — browser smoke + regression run; publishing gated.
