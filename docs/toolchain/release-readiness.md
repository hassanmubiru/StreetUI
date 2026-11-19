# StreetUI Release Readiness (M8.3)

## Versions

- Framework `@streetui/*` (16): **3.1.0** (repo + published; coherent).
- `@streetui/cli`, `streetui`: rep **3.1.1** (corrective candidate).
- Published on npm: `@streetui/cli@3.1.0` and `streetui@3.1.0` are **stale**
  (declare `esbuild@0.24.2` and fail project generation). 
- `create-streetui`: unpublished.

## Corrective release (authorized only)

Publish `@streetui/cli` and `streetui` at **3.1.1** from this repository build
(no esbuild), then re-run `scripts/toolchain-registry-e2e.mjs` and the full
browser/HMR/agent/third-party matrix. Framework packages stay at 3.1.0.

## Validation (3.1.1 candidate, offline)

- `pack-tarballs.mjs` → 19 tarballs (cli/streetui @ 3.1.1).
- external-install (both templates) PASS.
- Vitest 96/96, typecheck clean, ESLint clean.
- Chromium + Firefox dev/prod OK; agent-workflow PASS; HMR (Chromium) PASS.

## Readiness

The repo is ready to ship 3.1.1 for cli/streetui. The current public 3.1.0 CLI
is not usable; a corrective publish is required before declaring the independent
toolchain publicly available.
