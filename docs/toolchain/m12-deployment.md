# M12.6 — Production Deployment Readiness

Verified against a real scaffolded StreetUI application (the
`examples/streetui-dashboard` app) built with the published CLI at 3.2.1.

## Build and start commands

```bash
npm run build        # dist/client (hashed assets, manifest.json, extracted CSS)
                     # dist/server (Node SSR bundle + package.json)
npm run start        # SSR server, default http://localhost:3000
```

`streetui start` serves the SSR bundle for every non-asset route and static
files from `dist/client`. `streetui preview` is for **client-only static
builds**: it serves `dist/client` with SPA fallback when an `index.html`
exists. For SSR templates use `start` — `preview` returns 404 at `/` because
there is no static `index.html`.

## Conventional Node.js hosting

Requirements: Node.js >= 18, `PORT` and `HOST` environment variables optional
(default `3000`, `localhost`).

```bash
PORT=8080 HOST=0.0.0.0 npx streetui start --port 8080 --host 0.0.0.0
```

- Environment variables: `PORT`, `HOST`, and your application's own
  `process.env` values are read at runtime by the SSR bundle (no build-time
  secret embedding).
- Assets: everything in `public/` is copied to `dist/client` and served as-is;
  CSS is both extracted to a file and inlined via `renderStyles()` where used.
- Health checks: `GET /` returns a full HTML document when the app renders;
  use `GET /__streetui/health` only if your application defines it (there is no
  built-in health route).
- Logging: startup and errors go to stdout/stderr (and JSONL with `--json`).
- Graceful shutdown: `SIGTERM`/`SIGINT` stop the server (`docker stop -t 10` or
  `systemctl stop`); in-flight requests finish before the process exits.

## Docker-based environments

`examples/streetui-dashboard/Dockerfile` (multi-stage: deps → build → runtime):

```bash
docker build -t streetui-dashboard examples/streetui-dashboard
docker run --rm -p 3000:3000 streetui-dashboard
docker stop -t 10 <container-id>
```

The image installs dependencies, runs the production build, and starts
`streetui start --port 3000 --host 0.0.0.0` with a `HEALTHCHECK` against `/`.
No host adapters are invented: this is a plain Node SSR process in a container.

## Static hosting (client-only builds)

For apps with **no** SSR entry (`serverEntry` absent), `streetui build` emits
only `dist/client`. Serve that directory with any static host (nginx, object
storage + CDN, or `streetui preview`). Static hosting does **not** provide SSR:
hydration happens in the browser, so initial HTML is the static shell only.
Do not describe a static deployment as server-rendered.

## SSR-capable hosting

For apps with `serverEntry`, deploy the Node SSR process (`streetui start`) to
any Node host, container platform, or VM. The server returns complete HTML per
route plus a state island for hydration; the client then takes over with no
node recreation. Verified: `/`, `/users`, `/projects`, `/settings`, and a 404
route all render correctly in production (`start`), and `/users` returns a
populated table (`of 24 users`) rather than a loading state.

## Reproduction

```bash
cd examples/streetui-dashboard
npm install
npm run build
PORT=3000 npm run start
curl -s http://localhost:3000/users | grep -o "of 24 users"
```
