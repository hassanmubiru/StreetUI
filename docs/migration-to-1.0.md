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

## If you are on an earlier 0.x

Upgrading from 0.6–0.8 to 1.0 is still expected to be drop-in for the public
API, but those versions predate parts of the current surface (for example the
0.9 DevTools, testing, and observability packages). If you skipped releases,
read the [changelog](../CHANGELOG.md) for what was *added* between your version
and 1.0 — additions are backward compatible, but you may want to adopt them.

Update every `@streetui/*` dependency to `1.0.0` together. Because internal
edges are version-locked at pack time, mixing a `1.0.0` package with a `0.9.x`
one is unsupported and the release check will flag the divergence.

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
