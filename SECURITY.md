# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities through a **private** channel: use GitHub's
"Report a vulnerability" flow at
https://github.com/hassanmubiru/StreetUI/security/advisories or contact the
maintainers directly. Do **not** open a public issue with exploit details,
session tokens, or secrets. Include the affected package and version, impact,
and a reproduction where possible. We will acknowledge the report and work on a
fix before public disclosure.

## Supported versions

The latest coordinated release line is supported for security fixes. Check
`CHANGELOG.md` for the current version (3.2.2 on npm).

## Scope and security model

- The Playground control API is **local-only by design**: localhost binding,
  Host/Origin validation, bearer-token authentication, and token revocation on
  shutdown. Never expose it on a public interface.
- File operations are restricted to the project root with traversal, symlink,
  and `node_modules` protection; request bodies and WebSocket frames are size
  limited; event buffers are bounded.
- Screenshot files are confined to
  `<project>/.streetui-cache/screenshots/<sessionId>/`, retrieved by generated
  id only (never caller-supplied paths), capped, and deleted on shutdown.
- Playwright is an optional, development-only automation provider. It is not a
  runtime dependency of StreetUI, the CLI, or generated applications.
- No telemetry or network sends from the framework itself.

## Client/server data boundary

- Only `STREETUI_PUBLIC_*` environment variables are inlined into client
  bundles. Any other `process.env.X` member access in code reachable from the
  browser module graph is compiled to `undefined` — treat that as a hard rule,
  not a convention.
- Server credentials (API tokens, bearer secrets) must be read only in server
  entry points or modules the browser graph never imports. The reference
  implementation is `createServerDataSource()` in
  `examples/streetui-dashboard/src/http-patterns.ts`, which reads
  `STREETUI_DASHBOARD_API_TOKEN` (deliberately not `STREETUI_PUBLIC_*`) and
  injects `Authorization: Bearer …` server-side.
- For user sessions, prefer an `HttpOnly` cookie over a token readable from
  JavaScript, so a script-injection bug cannot exfiltrate the credential.
- Aborting a mutation cancels client-side waiting only; it is **not** a
  server-side rollback. Do not build a "cancel the delete" guarantee on it.
- Never serialize server credentials into SSR output, JSON state, or HTML. The
  dashboard's real-socket SSR test asserts the token never appears in the
  rendered document.
