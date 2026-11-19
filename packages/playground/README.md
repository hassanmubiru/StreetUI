# @streetui/playground

The StreetUI Playground: a local, StreetUI-built IDE plus an authenticated
control API for AI coding agents. It orchestrates the independent StreetUI
toolchain (`@streetui/cli`) — it is not a separate dev server, bundler, or
framework.

## Run it

The normal entry point is the StreetUI CLI inside a StreetUI project:

```bash
streetui playground --json
```

`session_attached` is printed on stdout and contains `url`, `previewUrl`,
`sessionId`, and a bearer `token`. Use the token as
`Authorization: Bearer <token>` for every `/__playground/api/*` call except
`GET /api/session`. `session_ready` is emitted exactly once when the server and
preview are ready.

The IDE itself is served at `/__playground/` for human developers.

## What the control API covers

- **Files and builds**: list/read/write/rename/delete project files (with
  traversal, symlink, and `node_modules` protection), production builds, and a
  bounded JSONL diagnostics buffer.
- **Browser inspection (HMR clients)**: DOM and element inspection, navigate,
  reload, console/runtime-error capture, and browser-confirmed HMR outcomes
  (`hmr_applied` / `hmr_failed`). SSR-graph edits rebuild SSR and reload instead.
- **Browser automation (M11, optional Playwright provider)**: real browser
  sessions with `automation/connect`, real PNG screenshots with IHDR-verified
  dimensions and id-based retrieval, interactions (click, type, fill, select,
  press, submit, scroll, navigate, reload, resize, waits, `evaluate`), and
  structured visual inspection (viewport/document dimensions, positioned
  elements, coded error/warning diagnostics).
- **Multi-client targeting**: `browser/clients` lists targets; operations take
  an explicit `clientId` when several browsers are connected
  (`E_CLIENT_REQUIRED`, `E_CLIENT_NOT_FOUND`), and stale clients can be expired
  with `browser/disconnect`.
- **Session lifecycle**: `session_stopped` on shutdown, token revocation,
  browser-process termination, and screenshot cleanup.

## Optional browser automation

Playwright is **optional and development-only**. It is not a dependency of this
package, of the CLI, or of StreetUI applications:

```bash
npm install --no-save playwright
npx playwright install chromium   # and/or firefox
```

If Playwright or a browser binary is unavailable, automation operations return
`E_AUTOMATION_UNAVAILABLE` and everything else keeps working. No screenshot or
browser result is ever fabricated.

## Security

Localhost-only by default with Host/Origin validation; bearer-token
authentication; token revocation on shutdown; project-root file restrictions;
request-size limits; bounded event buffers; screenshot files confined to
`<project>/.streetui-cache/screenshots/<sessionId>/` and retrieved by generated
id only; browser processes terminated and pending operations timed out on
shutdown. Do not expose the control API on a public interface.

## Documentation

Full protocol and workflow references (GitHub):

- [Agent protocol](https://github.com/hassanmubiru/StreetUI/blob/main/docs/toolchain/m10-agent-protocol.md)
- [Control API](https://github.com/hassanmubiru/StreetUI/blob/main/docs/toolchain/m10-control-api.md)
- [Browser automation](https://github.com/hassanmubiru/StreetUI/blob/main/docs/toolchain/m11-browser-automation.md)
- [Visual QA workflow](https://github.com/hassanmubiru/StreetUI/blob/main/docs/toolchain/m11-visual-qa-workflow.md)

Requires Node.js >= 18. The Playground uses StreetUI's own toolchain — no Vite,
Rollup, Webpack, React, Vue, or JSX.
