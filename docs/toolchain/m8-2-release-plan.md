# StreetUI M8.2 — Release Plan (3.1.0)

## Status

- **Preparation complete; publication NOT executed.**
- npm auth: authenticated as **`error51`** (`npm whoami`).
- Release candidates packed as **19 tarballs** at **3.1.0** (verified offline:
  `scripts/toolchain-external-install.mjs` passes for both templates).
- `create-streetui@3.1.0` dry-run publish verified (public access).

## Version & semver

- Selected: **3.1.0** across all 19 public packages (and root).
- Rationale: the independent toolchain is a backwards-compatible capability
  addition (new dev server/HMR/builder), so it is a **minor** bump. Do not
  republish 3.0.2.
- Internal `@streetui/*` runtime deps are **pinned exact** to `3.1.0`.

## Dependency publication order (topological)

Runtime dependencies first:

1. `@streetui/core`, `@streetui/state`, `@streetui/events`,
   `@streetui/scheduler`, `@streetui/dom`, `@streetui/context`
2. `@streetui/graph` (→ core), `@streetui/forms` (→ state),
   `@streetui/i18n` (→ state)
3. `@streetui/dsl` (→ core, graph, state)
4. `@streetui/compiler` (→ core, graph, dsl, state)
5. `@streetui/runtime` (→ core, graph, state, events, scheduler, compiler, dsl)
6. `@streetui/renderer`, `@streetui/devtools`
7. `@streetui/router`, `@streetui/testing`
8. `@streetui/cli` (runtime dep: typescript only)
9. `streetui` (bundles framework at build; runtime dep: typescript only)
10. `create-streetui` (→ `@streetui/cli`)

## Exact commands (for the authorized publisher)

Run from the repo root after `npm run build`:

```bash
# stage A — leaves
npm publish --access public --workspace @streetui/core
npm publish --access public --workspace @streetui/state
npm publish --access public --workspace @streetui/events
npm publish --access public --workspace @streetui/scheduler
npm publish --access public --workspace @streetui/dom
npm publish --access public --workspace @streetui/context
# stage B
npm publish --access public --workspace @streetui/graph
npm publish --access public --workspace @streetui/forms
npm publish --access public --workspace @streetui/i18n
# stage C
npm publish --access public --workspace @streetui/dsl
# stage D
npm publish --access public --workspace @streetui/compiler
# stage E
npm publish --access public --workspace @streetui/runtime
# stage F
npm publish --access public --workspace @streetui/renderer
npm publish --access public --workspace @streetui/devtools
# stage G
npm publish --access public --workspace @streetui/router
npm publish --access public --workspace @streetui/testing
# stage H
npm publish --access public --workspace @streetui/cli
npm publish --access public --workspace streetui
# stage I
cd packages/create-streetui && npm publish --access public
```

All packages use `--access public` (scoped) / default public (unscoped) and tag
`latest`. `publishConfig.access: "public"` is set in every public manifest.

## Validation (already run)

- `tsc --noEmit` (cli) ✓, ESLint (cli) ✓
- Vitest **96/96** ✓
- `tsup` builds: `@streetui/cli` ✓, `streetui` ✓
- Offline external-install (3.1.0 candidates, both templates) ✓
- Browser harness (Chromium + Firefox dev/prod), HMR (Chromium), security tests,
  agent-workflow — green on the current toolchain (M8 run)

## Rollback / partial-publication recovery

- Published versions are immutable. If a step fails mid-sequence:
  - Fix, then **bump to the next patch/minor** for the affected package(s);
    never overwrite an already-published version.
  - Re-run publication from the failing stage forward (earlier stages remain
    valid at 3.1.0).
  - Never change `latest` dist-tag manually; `npm publish` sets it. If a bad
    publish must be deprecated, use `npm deprecate` (out of scope; user-
    authorized only).

## Corrective 3.1.1 delta (M8.3)

The published `@streetui/cli@3.1.0` and `streetui@3.1.0` are stale (esbuild,
missing templates). Corrective release (user-authorized only):

```bash
# from repo root, after building cli + streetui at 3.1.1
npm publish --access public --workspace @streetui/cli
npm publish --access public --workspace streetui
```

Framework packages stay at 3.1.0. After publishing, re-run
`node scripts/toolchain-registry-e2e.mjs` and the full browser/HMR/agent/
third-party matrix against the live registry.

## Approval gate

**Stop here.** The actual `npm publish` run requires explicit user approval.
This document describes exactly what will be published and in what order; no
publish has been executed in this session.
