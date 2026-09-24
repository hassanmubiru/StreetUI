# StreetUI 1.0 — Public Framework Consolidation Report

**Objective (spec §1):** StreetUI must ship and be understood as ONE complete
UI framework — a single `npm install streetui` and one import surface — rather
than 17 separate `@streetui/*` packages. Internal modularity is preserved; the
public/npm experience is unified.

This report states only results that were actually verified in this environment.
Blocked items are marked BLOCKED with the reason, not faked.

---

## Result summary (spec §25 fields)

| Field | Result |
| --- | --- |
| **StreetUI version** | `1.0.0` (single authoritative source: `packages/streetui/src/version.ts` → `VERSION`; CLI `CLI_VERSION`; `streetui --version` → `1.0.0`) |
| **Public npm package** | `streetui` |
| **Number of public packages** | **1** (`streetui`). 17 `@streetui/*` modules remain **internal/private**, inlined into the one package. |
| **Build** | **PASS** — `turbo run build`: 28/28 tasks successful (incl. the unified `streetui` package and all 7 examples). |
| **Typecheck** | **PASS** — `turbo run typecheck`: 46/46 tasks successful. |
| **Tests** | **PASS** — `turbo run test`: 46/46 tasks successful, **631 tests passing** (incl. 12 new consolidated public-API tests). |
| **Browser** | **BLOCKED** — no Chromium/Playwright available in this sandbox. Not run, not faked. SSR/hydration verified in a DOM environment (happy-dom) instead. |
| **SSR** | **PASS** — `renderToString(compile(app))` returns an HTML **string**; verified from `streetui`, `streetui/server`, and from the packed tarball (renders `Count: 2`). |
| **Hydration** | **PASS** — `renderer.hydrate(compiled, container)` adopts server DOM in place and stays reactive (verified: adopted node identity preserved, signal update propagates to `Count: 5`). |
| **CLI** | **PASS** — `streetui create/dev/build/start`, `--help/--version/--port/--host`; bundled bin scaffolds `basic` and `ssr` templates; `streetui --version` → `1.0.0`. |
| **Generated project** | **PASS** — dependencies are exactly `{ "streetui": "1.0.0" }`; all source imports from `"streetui"`; no unreplaced tokens; typechecks against the built `streetui` dist. |
| **Clean npm install** | **BLOCKED (registry)** — the offline sandbox has no npm registry (esbuild fetch → `ENOTCACHED`/E403). The **tarball install** of `streetui` itself was verified functional (see below), with its one runtime dep `esbuild@0.24.2` provided from the local store. |
| **Tarball** | **PASS** — `streetui-1.0.0.tgz` (58 files, 531 KB): `dist/` + `templates/` + `README.md` + `LICENSE` + `package.json`. No `@streetui/` import leaks in shipped `.d.ts`; `esbuild` stays external in `dist/index.js` (0 references). |
| **Public API** | Single import surface: **144** runtime value exports from `streetui`; **6** from `streetui/server`; **9** from `streetui/testing`. Full framework reachable (reactivity, DSL, compiler, graph, runtime, renderer, router, resources, forms + validators, context, i18n, a11y, SSR, hydration, state serialization, devtools, CLI). |
| **Remaining limitations** | (1) No public **registry publish/install** (403 offline). (2) No **real browser** (no Chromium/Playwright). (3) No **`pnpm install --frozen-lockfile`** (offline). (4) The DTS bundling step needs `NODE_OPTIONS=--max-old-space-size=8192` on this 3.9 GB VM (default heap OOMs; typical CI has more RAM). |

---

## What was built (spec §3–§14)

The unified package lives at `packages/streetui/`. It **bundles** every internal
`@streetui/*` module into its own `dist/` so a consumer installs one thing:

- **JS**: tsup with `noExternal: [/^@streetui\//]` (esbuild inlines all internal
  JS). `esbuild` is the sole runtime dependency and stays external (the bundled
  CLI's `build` command needs it).
- **Types**: tsup `dts: { resolve: [/^@streetui\//] }` (rollup-dts inlines the
  internal `.d.ts`), followed by `scripts/scrub-dts.mjs` (comment-aware) which
  rewrites any residual `@streetui/*` mentions inside declaration comments and
  **fails loudly** on real statement-level import/require leaks.
- **Entry points**: `.` (full framework), `./server` (curated SSR subset),
  `./testing` (test helpers) — all in the SAME npm package.
- **Version**: single-sourced in `src/version.ts`; CLI derives from the same value.

### Notable defect found and fixed (spec §13)

Building the declarations naively produced **two** structurally-identical but
nominally-distinct `StreetApp` classes (`StreetApp` + `StreetApp$1`) — because
each internal package ships a pre-bundled `.d.ts`, so `@streetui/dsl` (used by
`streetui.app()`) and `@streetui/compiler` (used by `compile()`) each carried
their own copy. A real consumer calling `compile(streetui.app(...))` hit
`TS2345: separate declarations of a private property '_graph'`.

**Fix:** resolve internal **types from source, not dist**. Added
`tsconfig.build.json` (paths `@streetui/* → ../*/src/index.ts`, no `rootDir`) used
only by the dts build; the package's own typecheck keeps `tsconfig.json` (with
`rootDir` for self-referential export-map resolution). Result: a single shared
`StreetApp`, `index.d.ts` shrank 126 KB → 79 KB, and a scaffolded consumer app
now typechecks cleanly against the shipped types.

---

## End-to-end verification performed

**Whole monorepo (canonical `turbo` pipeline, in the build sandbox):**
`build` 28/28 · `typecheck` 46/46 · `test` 46/46 (631 tests). No regressions.

**Consolidated public-API suite** (`packages/streetui/src/streetui.public.test.ts`,
12 tests, imports ONLY from `streetui` / `streetui/server` / `streetui/testing`):
version, headline-API presence, reactivity, DSL+compile+SSR, hydration
(DOM adoption + reactivity), router (params/query), forms (reactive validity),
i18n (reactive + locale switch), context, and both subpaths.

**Examples (spec §16)** — all 7 rewritten to import from `streetui` and depend
only on `streetui`; each typechecks and passes its vitest suite:
basic-app (12), streetui-account (10), streetui-data (6), streetui-docs (9),
streetui-full-app (5), streetui-showcase (20), streetui-ssr (7).

**Packed-tarball consumer (spec §11, §18–§19, as far as the sandbox allows):**
extracted `streetui-1.0.0.tgz` into a clean project's `node_modules` (esbuild
supplied from the local store since the registry is blocked), then verified:
- ESM `import { … } from 'streetui'` → `VERSION 1.0.0`, SSR renders `Count: 2`.
- CJS `require('streetui')` and `require('streetui/server')` work.
- `tsc --noEmit` (NodeNext, `strict`, `skipLibCheck: false`) compiles a consumer
  `.ts` against the shipped `.d.ts` — both `streetui` and `streetui/server`
  subpaths resolve.
- The tarball's `create-bin.js` scaffolds an `ssr` app whose dependencies are
  exactly `{ "streetui": "1.0.0" }`; `bin.js --version` → `1.0.0`.

**Docs (spec §21):** root `README.md` and `docs/README.md` reframed around
"StreetUI — a complete TypeScript UI framework", leading with `npm install
streetui`, a single-import example, the two subpaths, and `npx streetui create
my-app`. Forward-facing docs' copyable code examples now import from `streetui`.
Historical version reports (`performance-v0.7`, `performance-browser-v0.8`,
`performance-hotpaths`) and legitimate internal-architecture prose were left
intact. No published-to-registry or browser-tested claims were added.

---

## Release criteria (spec §24)

A developer can `npx streetui create my-app; cd my-app; npm install; npm run dev`
building the whole app with `import { … } from "streetui"` and **no** individual
`@streetui/*` installs — verified against the built/packed artifact for every
step except the network `npm install` of the transitive `esbuild` dependency,
which is BLOCKED by the offline registry (esbuild itself is present in the repo
and the package resolves and runs once it is available).

## Artifacts

- `packages/streetui/streetui-1.0.0.tgz` — the primary release artifact.
- `packages/streetui/dist/` — built bundle (ESM + CJS + inlined `.d.ts`).
