# Browser & runtime support

This document states which environments StreetUI 1.0 targets, and — just as
importantly — exactly what was and was not validated when this release was
built. Nothing here is aspirational: where a target could not be exercised in
the build environment, it is marked as such rather than claimed.

## Target environments

StreetUI compiles to standard ES2022 and depends only on standard DOM APIs
through a small adapter (`BrowserDOMAdapter`). It is designed for current
evergreen browsers — recent Chromium (Chrome, Edge), Firefox, and Safari — and
uses no vendor-specific or experimental platform features. There is no virtual
DOM and no JSX runtime; the renderer talks to `document` through the adapter, so
any environment providing a spec-compliant DOM is a candidate host.

For server-side rendering the runtime is Node. The repository declares
`"engines": { "node": ">=18.0.0" }`, and the current validation run completed on
Node 24. SSR uses a separate `ServerDOMAdapter` that builds markup as strings and
does not require a DOM global, so `renderToString` runs in a plain Node process.

## What was validated in this release

DOM-dependent packages (`dom`, `renderer`, `router`, `testing`, and the
DOM-exercising benchmarks) run their suites under **happy-dom**, a
spec-compliant DOM implementation, in the vitest `happy-dom` environment. Every
other package runs in the vitest `node` environment. The full suite is green on
Node 24.

Against that DOM, hydration is validated end to end: exact server-node adoption
(object identity preserved, no recreation), event wiring, reactive updates on
adopted nodes, conditional (`when`) toggling, keyed-list identity across
reorders, controlled inputs, unmount cleanup, hydration-boundary preservation,
and local self-repair for **all three** divergence types the hydrator
distinguishes — tag mismatch, missing element, and surplus element — each with
an opt-in diagnostic.

SSR is validated by rendering real applications to HTML and asserting on the
markup, including through the offline consumer smoke test that imports the
packed tarballs and server-renders through both the ESM and CJS entry points.

## Real-browser evidence and remaining limits

The current validation run exercised real browser engines. The Chromium
performance harness completed with measured mount, hydration, frame, memory, and
long-task data. The website harness also collected separate Chrome and Firefox
route/performance measurements, with no console errors, and the Chromium axe scan
reported zero violations across the tested routes.

This is not a complete browser support matrix: Safari was not exercised, and the
standalone Playwright Firefox performance harness remains BLOCKED because its
managed Firefox binary is not installed in this environment. The website
Firefox measurements came from the available browser path and are kept separate
from the Chromium results. No result is substituted or averaged across engines.

## Compatibility policy

Within the 1.0 line, the minimum Node version and the browser baseline will not
be raised in a patch or minor release. Raising either is a breaking change and
would accompany a major version bump, per the semver policy in
[`api-v1.0.md`](./api-v1.0.md).
