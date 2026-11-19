# StreetUI Application

This is a StreetUI application. It uses the official StreetUI toolchain
(`streetui` CLI) — not Vite, Rollup, Webpack, or another framework's dev server.

## Commands

```bash
npm run dev        # StreetUI dev server (default http://localhost:3000)
npm run build      # production build → dist/client, dist/server
npm run start      # serve the production build (SSR)
npm run preview    # serve dist/client statically
npm run doctor     # diagnose the environment
npm run typecheck  # tsc --noEmit (type checking is separate from the build)
```

## Machine-readable mode

For coding agents, use `--json`. Events are JSONL on stdout; human logs are
suppressed:

```bash
streetui dev --json
```

Key events:

- `project_detected` — the CLI found a StreetUI project.
- `environment_checked` — toolchain checks.
- `compilation_started` / `compilation_completed`
- `server_started` — dev server is listening.
- `preview_ready` — the URL you can open or pass to a browser tool.
- `file_changed` / `module_updated` — HMR activity.
- `runtime_error` — an error reported by the browser.
- `build_completed` — production build finished.
- `server_stopped`

Every event includes `schemaVersion: 1`, `framework: "streetui"`, and
`timestamp`. Detect `preview_ready` to get the actual preview URL; do not
assume port 3000.

## Architecture

- `src/app.ts` — the universal UI definition (DSL + signals).
- `src/server.ts` — SSR entry; exports `render(request)`.
- `src/main.ts` — browser entry; hydrates the server HTML.
- `public/` — static assets served as-is.

Do not introduce React, Vue, Svelte, JSX, or a second reactive runtime. Do not
replace the StreetUI renderer or compiler.

## Browser verification

Chrome and Firefox are the release targets. A passing HTTP request is not proof
that the app rendered; verify the DOM and console in a real browser when
available. The repository's browser harness records `BLOCKED` rather than
fabricating a pass when a browser binary is missing.
