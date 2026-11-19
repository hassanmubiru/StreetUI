# ADR 0001 — Independent StreetUI Toolchain

- Status: accepted
- Date: 2026-11
- Applies to: `@streetui/cli`, `streetui`

## Context

StreetUI is a self-contained TypeScript framework with its own DSL, compiler,
Semantic Application Graph (SAG), runtime, renderer, routing, forms, SSR,
hydration, and DevTools. Previously the CLI delegated bundling to **esbuild**
(`bundle: true`) for both `dev` and `build`, and live reload was a full-page SSE
mechanism.

The framework must own its developer experience the same way it owns its
renderer: a real development server, module graph, HMR, production builder,
preview, and CLI — without depending on Vite, Rollup, Webpack, Parcel, Rspack,
Turbopack, or another framework's dev server/HMR.

## Decisions

1. **Module-preserving production build.** `streetui build` uses the same
   resolver, module graph, and TypeScript transform as the dev server. Every
   reachable module is emitted as ESM with rewritten relative specifiers,
   hashed filenames, extracted CSS, emitted assets, source maps, and a manifest.
   There is no scope hoisting, tree shaking, or minification in v1; these are
   documented limitations, not silent features.

2. **TypeScript compiler API only.** `ts.transpileModule` + a custom AST
   transformer performs TypeScript→JavaScript for dev, build, and config
   loading. esbuild is removed from the CLI's runtime dependencies. Type
   checking remains separate (`tsc --noEmit`). `typescript` is the single
   runtime dependency added.

3. **Own low-level utilities, no bundler substitutes.** The resolver, module
   graph, dev server, WebSocket (RFC 6455), watcher, builder, and preview are
   implemented in-repo on Node builtins. esbuild/tsup remain devDependencies for
   building the framework's own packages, never for user applications.

4. **Dev module serving is unbundled ESM.** Project and package modules are
   transformed on demand, cached by content hash, and served as ESM with
   rewritten specifiers. Bare `@streetui/*` and package imports are resolved
   through package `exports` conditions and served under `/@streetui/pkg/...`.

5. **HMR guarantees.** CSS hot-swap in place; modules that call
   `import.meta.hot.accept()` re-run their callback with preserved state;
   everything else falls back to a verified full reload. Build errors surface
   in an overlay and never leave the app silently broken. The HMR transport is
   StreetUI's own WebSocket protocol.

6. **CLI surface.** `create`, `dev`, `build`, `start` are preserved. `preview`
   serves `dist/client` statically (independent of compiler/HMR) and `doctor`
   diagnoses the environment. `--json` emits a stable JSONL event stream for AI
   agents (`schemaVersion: 1`, `framework: "streetui"`).

7. **Output layout preserved.** `dist/client/` + `dist/server/` with
   `manifest.json` and hashed assets under `dist/client/assets/`.

## External dependencies

| Dependency | Type | Why |
| --- | --- | --- |
| `typescript` | runtime | TypeScript compiler API for transpilation |
| `node:*` | builtin | HTTP, crypto, fs watching, URL, path |
| Playwright | optional/dev | browser verification harness; never a runtime dep |

## Non-goals / limitations

- No bundling, scope hoisting, tree shaking, or minification in production output.
- HMR state preservation only for CSS and explicit `accept()` boundaries.
- TypeScript transform is slower than esbuild; measured, not claimed.
- Dev SSR rebuilds the server graph to a fresh temp directory per change.

## Consequences

- StreetUI apps run without installing Vite or any other bundler.
- The dev server, HMR, and builder share one resolver + graph + transform.
- AI agents can drive `streetui dev --json` and read `preview_ready`.
- The package size grows by `typescript` (the framework's runtime transform engine).
