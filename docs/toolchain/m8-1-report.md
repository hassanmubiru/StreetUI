# StreetUI M8.1 — Public npm Registry Verification

- Status: **BLOCKED (honest)** — see "Remaining blockers".
- Date: 2026-11-15
- Evidence: `benchmarks/results/toolchain/registry-smoke.json`.

## 1. Package registry verification matrix

All 18 public packages exist on `https://registry.npmjs.org/` at `3.0.2` with
`latest` = `3.0.2`. However, the published `@streetui/cli` and `streetui` still
declare `esbuild@0.24.2` in `dependencies` — i.e. the published build is the
older toolchain, not the current M0–M8 independent toolchain.

## 2. Published version matrix

| Package | Repo | Published | dist-tag | Matches repo? |
| --- | --- | --- | --- | --- |
| `@streetui/*` (16) | 3.0.2 | 3.0.2 | latest | version yes; **content stale** |
| `streetui` | 3.0.2 | 3.0.2 | latest | version yes; **content stale (esbuild)** |
| `@streetui/cli` | 3.0.2 | 3.0.2 | latest | version yes; **content stale (esbuild)** |
| `create-streetui` | 3.0.2 (repo) | **not published** | — | missing |

## 3. Generator results

- `npm create streetui@latest` → **404** (`create-streetui` not published).
- Fallback: `@streetui/cli` `create` (published) generated both `basic` and
  `ssr` apps successfully from the registry-installed CLI.

## 4. Basic and SSR installation results

Both generated apps installed from the registry; the renderer resolved to
`3.0.2`. Because the published CLI/framework is the esbuild-based build, the
full lifecycle was not run against it (would not validate this toolchain).

## 5. Third-party compatibility results

Fixture matrix remains green (see `npm-compatibility.md`). Real-registry
third-party verification is **BLOCKED** — it must run against a fresh publish of
the current resolver.

## 6–7. Chromium / Firefox results

Not re-run against the stale published build (would be meaningless for this
toolchain). The M8 browser harness remains green against the current toolchain
offline. Real-registry browser verification is blocked pending a fresh publish.

## 8. HMR results

Existing M8 HMR harness (Chromium) remains green on the current toolchain.
Registry-installed HMR verification is blocked pending a fresh publish.

## 9. Production build and preview

The offline external-install harness still verifies `build`/`preview`/`start`
for the current toolchain. Registry-installed build/preview is blocked pending a
fresh publish.

## 10. AI-agent workflow results

The offline agent-workflow harness is green. Registry-installed agent events
(`preview_ready`, `build_completed`) are blocked pending a fresh publish.

## 11. Release readiness assessment

The repo code is release-ready and packs cleanly (19 tarballs, incl. the new
`create-streetui`). **Publication blockers:** (a) publish all 18 packages from
the current repository (remove esbuild), and (b) publish `create-streetui@3.0.2`.
See `docs/toolchain/release-readiness.md`.

## 12. Changed files

- `packages/create-streetui/` — new `npm create streetui@latest` initializer.
- `scripts/pack-tarballs.mjs` — added `create-streetui`; relaxed dist-required
  for non-dist packages.
- `scripts/toolchain-registry-smoke.mjs` — new registry smoke harness.
- `docs/toolchain/release-readiness.md`, `docs/toolchain/npm-compatibility.md`
  (M8.1 finding), `docs/toolchain/m8-1-report.md`.

## 13. Commands executed

```
npm view <pkg> version dist.tarball dist.integrity dist-tags.latest --json   # audit
npm view @streetui/cli dependencies --json                                   # esbuild check
node scripts/toolchain-registry-smoke.mjs
node scripts/pack-tarballs.mjs                                               # 19 tarballs
node scripts/toolchain-external-install.mjs                                  # offline gate (prior)
```

## 14. Remaining blockers

1. **Stale published toolchain** — published 3.0.2 still depends on esbuild.
2. **`create-streetui` not published** — `npm create streetui@latest` 404.

These require a user-authorized `npm publish`; no publishing was performed.

## 15. Recommended next milestone

Publish the current build (all 18 packages + `create-streetui`), then re-run
`node scripts/toolchain-registry-smoke.mjs` and the full browser/HMR/agent
workflows against the live registry to unblock the "real public framework"
claim.
