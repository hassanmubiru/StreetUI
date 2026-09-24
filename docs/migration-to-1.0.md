# Migrating to StreetUI 1.0

**Short version: there is nothing to migrate.** StreetUI 1.0.0 is a
stabilization release. It freezes the public API that took shape over the 0.x
series and puts every published package on one coordinated version number. No
public API was removed, renamed, or changed in a breaking way relative to 0.9.
Code written against 0.9 compiles and runs unchanged against 1.0.

This document exists to say that clearly, to record the small
version-alignment fixes that shipped with 1.0, and to explain what "stable" now
commits the project to.

## What changed

The only behavioral changes are internal version-alignment corrections that a
consumer of a *0.9* install would not have depended on, because they were bugs:

The CLI reported the wrong version. `@streetui/cli` had `CLI_VERSION` pinned at
`0.6.0`, so `streetui --version` and the framework version written into
scaffolded projects were stale. Both now report `1.0.0`. If you parsed
`streetui --version` output, expect `1.0.0`.

Scaffolding templates pinned stale dependency versions. The `basic` and `ssr`
project templates declared their `@streetui/*` dependencies at `0.1.0`. A
freshly-created project therefore asked for framework packages that no longer
matched the installed toolchain. Templates now pin to the framework version, so
`create` produces a project whose dependencies resolve to the framework you ran
it with. Existing projects are unaffected; only newly scaffolded ones benefit.

That is the complete list. Nothing in `core`, `state`, `graph`, `dsl`,
`compiler`, `runtime`, `events`, `scheduler`, `dom`, `renderer`, `router`,
`forms`, `i18n`, `context`, `devtools`, or `testing` changed shape.

## Installing 1.0: one package instead of many

The most visible packaging change is that StreetUI is now consumed as a
**single npm package**, `streetui`, rather than a set of separately-installed
`@streetui/*` packages. You install one dependency:

```bash
npm install streetui
```

and import every public symbol from it, with two curated subpaths in the same
package:

```ts
import { signal, streetui, compile, createRenderer, createRuntime } from 'streetui';
import { renderToString, serializeState, readState } from 'streetui/server';
import { render, findByRole, renderServerThenHydrate } from 'streetui/testing';
```

If you previously depended on several `@streetui/*` packages, the mechanical
change is to replace those dependencies with the one `streetui` dependency and
repoint the imports:

```diff
- import { signal, derived } from '@streetui/state';
- import { streetui } from '@streetui/dsl';
- import { compile } from '@streetui/compiler';
- import { createRenderer } from '@streetui/renderer';
+ import { signal, derived, streetui, compile, createRenderer } from 'streetui';
```

The **exported names and their behavior are unchanged** — only the specifier
moves. Server-only helpers (`renderToString`, `serializeState`, `readState`,
`ServerDOMAdapter`) live under `streetui/server`, and the test helpers
(`render`, `findByRole`, `waitFor`, `renderServerThenHydrate`, `flushUpdates`)
under `streetui/testing`. Internally StreetUI is still modular, but that
modularity is now an implementation detail rather than something you install.

Note this repository's `streetui` package has **not** been published to a public
npm registry in this environment (see [Release process](./release-process.md)
and [Publishing](./publishing.md) for the honest, BLOCKED registry gate); the
single-package shape is verified via offline tarball consumption, not a registry
install.

## If you are on an earlier 0.x

Upgrading from 0.6–0.8 to 1.0 is still expected to be drop-in for the public
API, but those versions predate parts of the current surface (for example the
0.9 DevTools, testing, and observability packages). If you skipped releases,
read the [changelog](../CHANGELOG.md) for what was *added* between your version
and 1.0 — additions are backward compatible, but you may want to adopt them.

Replace any set of `@streetui/*` dependencies with the single `streetui`
dependency at `1.0.0` and repoint imports as shown above. (Internally the
modules remain version-locked and coordinated; the release check still flags any
divergence within the packaged set.)

## What "1.0 stable" commits us to

From 1.0.0 onward the public API is governed by semantic versioning, described
in full in [`api-v1.0.md`](./api-v1.0.md):

Breaking changes to any stable public export require a major version bump.
Additive, backward-compatible changes are minor releases. Bug fixes are patch
releases. Anything the framework does not intend as public is marked internal
and kept out of the public barrels — the API inventory confirms zero internal,
deprecated, or experimental exports leak today.

## What 1.0 does not claim

Two release gates could not be validated in the build environment and are
reported honestly rather than assumed. Real-browser behavior was validated
against a spec-compliant DOM, not a shipped browser, and the packages have not
been published to a registry from here. See
[`browser-support.md`](./browser-support.md) and
[`release-process.md`](./release-process.md) for the exact status of each gate.
