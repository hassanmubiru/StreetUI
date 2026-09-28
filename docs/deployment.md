# Deployment

```
npm install streetui
```

StreetUI apps render on the server and hydrate on the client from a single
package. Server-only code lives behind the `streetui/server` subpath so it is
never pulled into the client bundle. This page covers building and running an
app in production.

## Build

Produce the client and server bundles with the CLI:

```
streetui build     # → dist/client, dist/server
streetui start     # serve the production build
```

`start` serves the built output on `--port` / `--host` (defaults `3000` /
`localhost`). For most deployments this is all you need.

## Rendering manually

If you host StreetUI inside your own server, render on the server via the
`streetui/server` subpath and hydrate on the client from the main entry:

```ts
// server
import { compile } from 'streetui';
import { renderToString, renderHead, serializeState, ServerDOMAdapter } from 'streetui/server';

const compiled = compile(app);
const body = renderToString(compiled);      // HTML for #app
const head = renderHead(compiled);           // <title>/<meta>/<link> from head()
const state = serializeState(/* … */);       // seed for hydration

const html = `<!doctype html>
<html><head>${head}</head>
<body><div id="app">${body}</div>
<script type="module" src="/client.js"></script></body></html>`;
```

```ts
// client entry (client.js)
import { createRenderer, BrowserDOMAdapter, compile } from 'streetui';
// hydrate the server-rendered markup instead of re-creating it
```

The three public subpaths are `streetui` (client + shared), `streetui/server`
(SSR: `renderToString`, `renderHead`, `serializeState`, `ServerDOMAdapter`), and
`streetui/testing`. Nothing else is public.

## What must not reach the browser

Server rendering, the CLI, testing helpers, and DevTools are tooling/server
concerns and are **excluded from client bundles** by tree-shaking. A minimal
client bundle does not include the SSR serializer (`ServerDOMAdapter` /
`renderToString`), the CLI (`buildProject` / `startServer` / `createProject`),
testing helpers, DevTools, or Node built-ins. This boundary is enforced by a
leak-check that bundles a client entry and scans for those identifiers.

## Security note

If you expose the server build directly, put it behind your own
authentication/authorization and a reverse proxy as appropriate — the framework
renders your app but does not impose an access-control policy. See
[Production server](production-server.md) for the hardening notes that ship with
the CLI server.

## Verifying a release consumer

Before deploying, you can verify the packaged framework installs and renders
outside the monorepo: pack the tarballs, install them in a throwaway directory,
and confirm `renderToString(compile(app))` emits your heading and signal values
over both ESM and CJS. See [Publishing](publishing.md).

See also: [SSR](ssr.md), [Hydration](hydration.md), [CLI](cli.md).
