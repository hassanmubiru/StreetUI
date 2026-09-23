# Production server & security

`streetui start` serves a production build using only `node:http`. No second
server framework is introduced — the CLI orchestrates the existing StreetUI
render pipeline. This document describes how requests are handled and the
security properties of the static-asset layer.

## Request handling

For each request the server first attempts to serve a matching static asset from
the built client directory. If no static file matches, the request falls through
to server-side rendering (SSR), which runs the compiled application and returns
HTML plus the hydration island. Unmatched dynamic routes render the app's
not-found handling.

## Static assets

Static responses are sent with:

- the correct `Content-Type` derived from the file extension,
- `X-Content-Type-Options: nosniff` to stop content-type sniffing,
- `Cache-Control: public, max-age=3600` in production, and `no-cache` in dev so
  local edits are always picked up.

## Path-traversal protection

The requested URL path is resolved against the client directory and the result
is validated by containment, not by string prefix:

- the decoded path is rejected outright if `decodeURIComponent` throws
  (malformed percent-encodings such as `%zz`) or if it contains a NUL byte,
- the resolved absolute path must be *inside* the client directory —
  containment is checked with `path.relative`, so a resolved path that is empty,
  starts with `..`, or is absolute-elsewhere is refused,
- this also blocks the classic prefix-sibling escape: a directory named
  `<clientDir>-secret` is **not** treated as being inside `<clientDir>`.

A request that fails any of these checks does not error — it simply falls
through to the renderer, which returns normal not-found output.

## Error disclosure

Render errors are always logged server-side. The response, however, depends on
mode: in production the client receives a generic `Internal Server Error` with
no stack; only in dev mode is the error detail returned, to aid debugging. This
closes an information-disclosure hole where internal paths or stack frames could
otherwise leak to a production client.

## What was deliberately not added

- No new HTTP framework, router, or middleware system — `node:http` only.
- No streaming SSR.
- No TLS termination, rate limiting, or auth layer; those belong to the
  deployment environment (reverse proxy / platform), not to the framework's
  reference server.

The behavior above is covered by real HTTP tests in
`packages/cli/src/serve.test.ts`, which start an actual server and issue real
`fetch` requests.
