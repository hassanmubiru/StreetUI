# M15 — CI / ecosystem reliability: report

**Status:** complete for everything this environment can prove. Every gate below is
recorded with its real result and its **evidence target**; nothing is reported as
something it is not. `3.2.2` remains the published release — M15 is verification
and hardening, not a new version.

**Evidence targets** (never conflated):

| Target | What it means |
|---|---|
| `local-workspace` | Ran against the working tree / workspace links |
| `local-packed` | Ran against tarballs produced by `pack-tarballs.mjs` |
| `npm-registry` | Ran against the real public npm registry |
| `github-actions` | Produced by GitHub Actions — **not produced here** |

---

## 1. Summary

| Area | Result | Evidence |
|---|---|---|
| Shared harness exit semantics | PASS | `scripts/lib/harness-status.mjs`, 32/32 unit tests |
| Browser matrix (3 engines × dev/prod) | PASS 6/6 | `benchmarks/results/toolchain/{chromium,firefox,webkit}-{dev,prod}.json` |
| SSR + hydration + dev regeneration | PASS 3/3 | `benchmarks/results/toolchain/ssr-hydration.json` |
| HMR reliability | PASS 3/3 | `benchmarks/results/toolchain/hmr.json` |
| Full axe-core audit | PASS 3/3 (0 violations) | `benchmarks/results/toolchain/a11y-axe.json` |
| Visual a11y (colour contrast + focus) | PASS 6/6 | `benchmarks/results/v2.5/visual-a11y.json` |
| Agent workflow JSON contract | PASS | `AGENT WORKFLOW PASSED` |
| Agent control-API e2e | PASS | `benchmarks/results/toolchain/agent-e2e.json` |
| Agent visual e2e (3 engines) | PASS 3/3 | `benchmarks/results/toolchain/agent-visual-e2e.json` |
| Playground browser harness (3 engines) | PASS 3/3 | `benchmarks/results/toolchain/playground-browser.json` |
| External developer acceptance | PASS 3/3, `local-packed` | `benchmarks/results/toolchain/external-developer-e2e.json` |
| Registry smoke | PASS, `npm-registry` | `benchmarks/results/toolchain/registry-smoke.json` |
| Registry compatibility (4 pkgs + 2 probes) | PASS 18/18, `npm-registry` | `benchmarks/results/toolchain/registry-compat.json` |
| Registry lifecycle e2e | PASS, `npm-registry` | `benchmarks/results/toolchain/registry-e2e.json` |
| Node 18/20/22/24 matrix | PASS 4/4 | `benchmarks/results/toolchain/node-matrix.json` |
| All 10 templates | PASS 10/10 | `toolchain-template-audit.mjs` output |
| Public API inventory | PASS, 0 missing | `dist-tarballs/api-inventory.json` |
| Dependency / supply-chain policy | PASS, 0 policy defects | `benchmarks/results/toolchain/dependency-audit.json` |
| Strict NodeNext consumer against packed tarballs | PASS | `consumer-smoke.mjs` phase 4 |
| Release chain (check → pack → verify → smoke → dry-run) | PASS | `dist-tarballs/release-manifest.json` |
| GitHub Actions | **BLOCKED** — account billing lock | not code |

Repo-wide gates: `turbo run typecheck` **52/52**, `turbo run test` **52/52**,
`eslint packages apps examples` **0 problems**.

---

## 2. Defects found and fixed during M15

Each defect below was reproduced before the fix and re-verified after it.

### D-1 — `streetui/testing` referenced an undeclared subpath

`streetui/testing`'s declarations contained
`export * from 'streetui/diagnostics'`, but the manifest declared no such
subpath. An external consumer importing `streetui/testing` therefore failed with
`TS2307: Cannot find module 'streetui/diagnostics'`.

Root cause: `tsconfig.build.json` mapped `@streetui/*` only to
`../*/src/index.ts`, so the declaration bundler emitted a bare re-export, and the
`scrub-dts` step rewrote it into a dangling self-reference.

Fix: real `streetui/diagnostics` entry point — source
(`packages/streetui/src/diagnostics.ts`), tsup entry, `tsconfig.build.json` path
for `@streetui/compiler/diagnostics`, `exports["./diagnostics"]` (import +
require), and a `REQUIRED_SUBPATHS.streetui` pin. `consumer-smoke.mjs` phase 4
keeps it fixed.

### D-2 — API inventory covered 17 packages and no subpaths

`api-inventory.mjs` scanned a hardcoded list and only the `.` entry, so a broken
subpath declaration could never be caught. It now derives the package set from
`scripts/lib/public-packages.mjs`, walks **every** declared `exports` subpath
(including nested `import`/`require` conditions), resolves each `types` target on
disk, classifies bin-only packages, and exits nonzero on a missing target or a
package-name mismatch.

Result: **19 packages, 682 values, 461 types, 23 subpaths, 0 missing, 0 mismatched.**

### D-3 — Harness exit codes could be green without a verified scenario

Several harnesses wrote `process.exit(0)` unconditionally. All maintained
harnesses now decide their exit code through `scripts/lib/harness-status.mjs`:
`FAIL`/`ERROR`/unknown/mismatch → 1; a requested engine/mode with **no record** →
1; `BLOCKED`-only coverage → 0 locally but 1 under `CI` or `--require`.

### D-4 — `--engines` was silently ignored (evidence-integrity bug)

Harnesses that parsed only `--engine` dropped `--engines` entirely: a run with
`--engines chromium,firefox,webkit` executed only the default set and still exited
0, reporting `unreported=0` for an engine the caller had asked for. This is the
exact failure mode the evidence contract forbids.

Reproduced: `node scripts/toolchain-browser-tests.mjs --engines chromium,firefox,webkit --mode both`
→ 4 records (chromium/firefox only), `exit 0`, WebKit never attempted.

Fix: one shared parser in `scripts/lib/browser-engines.mjs` —
`enginesFromArgv()` accepts either spelling (and rejects both at once),
`modesFromArgv()`, and `assertNoUnknownSelectionFlags()` fails loudly on
`--browser`, `--target=web`, `--servers`, etc. instead of ignoring them. All 12
browser harnesses now use it; `ci-workflow-audit.mjs` forbids inline argv parsing.

Re-verified: the same command now records **6/6 verified** including WebKit
26.6, `exit 0`; `--browser webkit` exits 1 with
`Unknown selection flag "--browser"`.

### D-5 — `--no-sandbox` broke WebKit in the Playground automation provider

`packages/playground/src/automation.ts` passed `args: ['--no-sandbox']` to every
engine. `--no-sandbox` is a Chromium flag; WebKit exits during startup, so
`connect()` always failed with
`Target page, context or browser has been closed` and every WebKit agent session
was BLOCKED even though WebKit ran fine through the shared launcher.

Isolated reproduction: `webkit.launch({ headless: true, args: ['--no-sandbox'] })`
fails, `webkit.launch({ headless: true })` returns 26.6.

Fix: engine-specific launch args (`--no-sandbox` for Chromium only), matching the
shared launcher. Re-verified: `toolchain-agent-visual-e2e.mjs --engines
chromium,firefox,webkit` → **3/3 VERIFIED**.

### D-6 — Relative `--tarballs` paths were reinterpreted as git specs

`toolchain-external-developer-e2e.mjs` forwarded `--tarballs dist-tarballs`
verbatim into an `npm install` that runs inside a temp project, so npm treated
the relative paths as `ssh://git@github.com/dist-tarballs/...`:

```
npm error command git --no-replace-objects ls-remote ssh://git@github.com/dist-tarballs/streetui-graph-3.2.2.tgz.git
npm error git@github.com: Permission denied (publickey).
```

Fix: resolve the directory against the caller's cwd immediately and fail early if
it does not exist. Re-verified: `--tarballs dist-tarballs` → **3/3 verified**,
`local-packed`.

### D-7 — Evidence artifacts did not all declare their evidence target

Several harnesses wrote results without a `target`/`evidenceTarget` field, so a
reader (or a later report) had to infer whether a JSON file came from the
workspace, from tarballs, or from the registry — the exact conflation the
evidence rules forbid. Every artifact now carries the label itself:

`toolchain-browser-tests` (per engine/mode), `toolchain-ssr-hydration`,
`toolchain-hmr`, `toolchain-a11y-axe`, `toolchain-playground-browser-tests`,
`toolchain-node-matrix` (`evidenceTarget` alongside its `target` install source),
`toolchain-registry-compat` (registry or `local-workspace` under `--local`), and
`dependency-audit`. Verified by inspection of all 11 toolchain artifacts.

### D-8 — Preview SPA fallback 404'd client-only builds

`startPreview` fell back to `index.html` only when no manifest existed, but a
client-only build writes both a manifest and `index.html`, so `/` returned 404.
Fixed to `options.spaFallback ?? hasIndex` with two regression tests in
`preview.test.ts`.

### D-9 — Dashboard documented the wrong environment variable

`data.ts` named `STREETUI_DASHBOARD_API_URL` while the implementation read
`STREETUI_PUBLIC_DASHBOARD_API_URL`. Corrected, together with a note on why the
public prefix is required for client inlining.

### Not a defect (investigated and dismissed)

- The plan's "malformed `'context'`" claim about the package list was a display
  artifact; `scripts/lib/public-packages.mjs` is valid and pinned by 32 tests.
- `agent-e2e.json` reports `hmr_failed` with `reason: "no accept handler"`. That
  is the client entry's designed full-reload path, not a failure. The artifact now
  records `hmrOutcomes` with the reason, and the deliberately injected
  `agent-e2e-boom` error is recorded under `errorCapture` so a count of 2 is
  explicable rather than suspicious.
- `agent-visual-e2e.json` records `browserVersion: null` with a real user agent:
  the automation provider exposes the engine, not the browser version. Documented
  rather than guessed.

---

## 3. Exact commands and results

Run from the repository root.

### Unit and static gates

```bash
node --test scripts/lib/*.test.mjs                 # 32 pass / 0 fail
node scripts/ci-workflow-audit.mjs                 # WORKFLOW AUDIT OK — 252 assertions
node scripts/dependency-audit.mjs                  # 0 policy defects
node scripts/api-inventory.mjs                     # 19 pkgs / 23 subpaths / 0 missing
./node_modules/.bin/turbo run typecheck            # 52/52 (needs pnpm on PATH)
./node_modules/.bin/turbo run test                 # 52/52
./node_modules/.bin/eslint packages apps examples  # 0 problems
```

`turbo` needs a package-manager binary on PATH; use
`PATH=/tmp/pnpm-shim:$PATH` when `pnpm` is absent. One parallel `turbo run test`
invocation failed `@streetui/cli#test` transiently; the same suite passes
standalone (`vitest run` → 113/113) and via `--filter=@streetui/cli --force`, and
a full rerun passed 52/52. No test was changed to make it pass.

### Browser matrices

```bash
node scripts/toolchain-browser-tests.mjs --engines chromium,firefox,webkit --mode both
# chromium/dev OK · chromium/prod OK · firefox/dev OK · firefox/prod OK
# webkit/dev OK   · webkit/prod OK      → 6/6, exit 0
# versions: chromium 153.0.8010.12, firefox 159.0, webkit 26.6

node scripts/toolchain-ssr-hydration.mjs --engines chromium,firefox,webkit   # 3/3 PASS
node scripts/toolchain-hmr.mjs --engines chromium,firefox,webkit             # 3/3 PASS
node scripts/toolchain-a11y-axe.mjs --engines chromium,firefox,webkit        # 3/3, 0 violations / 7 routes
node scripts/visual-a11y-axe.mjs --engines chromium,firefox,webkit --mode both  # 6/6 PASS
```

The full axe-core audit requires `@axe-core/playwright` in an isolated dev-only
location. It was installed for this run at `/tmp/streetui-a11y` (never into the
workspace, so it can never become a runtime dependency). With it absent the
harness correctly reports BLOCKED and exits 0 locally / 1 with `--require`:

```bash
node scripts/toolchain-a11y-axe.mjs --engines chromium --require   # exit 1, BLOCKED
```

`visual-a11y-axe.mjs` overwrites its artifact per run, so the full matrix was run
last to leave complete coverage on disk.

### Agent and Playground harnesses

```bash
node scripts/toolchain-agent-workflow.mjs                          # PASSED
node scripts/toolchain-agent-e2e.mjs                               # 1/1 PASS, local-workspace
node scripts/toolchain-agent-visual-e2e.mjs --engines chromium,firefox,webkit  # 3/3 VERIFIED
node scripts/toolchain-playground-browser-tests.mjs --engines chromium,firefox,webkit  # 3/3 PASS
```

### Ecosystem harnesses

```bash
node scripts/toolchain-registry-smoke.mjs --engines chromium            # PASS, npm-registry
node scripts/toolchain-registry-compat.mjs --engines chromium,firefox   # 18/18 PASS, npm-registry
node scripts/toolchain-registry-e2e.mjs --engines chromium              # PASS, npm-registry
node scripts/toolchain-external-developer-e2e.mjs \
  --engines chromium,firefox,webkit --tarballs dist-tarballs            # 3/3 PASS, local-packed
node scripts/toolchain-node-matrix.mjs                                  # 18/20/22/24 all PASS
node scripts/toolchain-template-audit.mjs                               # 10/10 PASS
node scripts/toolchain-external-install.mjs                             # PASSED
```

Registry-compat evidence: supported `nanoid`, `clsx`, `date-fns`,
`@fontsource/inter` all render in dev and prod on both engines; the unsupported
probes produce the intended diagnostics (`CommonJS diagnostic` for `slugify`,
`Node-builtin dependency` for `node-fetch@2`) rather than silent breakage.

### Performance

```bash
node scripts/toolchain-perf.mjs --warmup 3 --samples 7
# create 2.6ms · cold dev startup 325.5ms · warm SSR 1.2ms · HMR 60.4ms · warm build 364.4ms
node scripts/browser-harness.mjs --engines chromium --mode dev --warmup 2 --samples 5   # OK
node scripts/browser-harness-firefox.mjs                                               # OK
```

Defaults are `--warmup 5 --samples 20`; raw observations are preserved beside the
computed summary, cold and warm phases are never averaged, and one engine per
artifact.

### Release chain (local, no publish)

```bash
node scripts/release-check.mjs                          # OK — 19 packages (18 coordinated)
node scripts/apply-publish-metadata.mjs --check         # up to date across 19 packages
node scripts/pack-tarballs.mjs                          # 19 tarballs @ 3.2.2
node scripts/verify-tarballs.mjs                        # OK — 19 tarballs
node scripts/consumer-smoke.mjs                         # ESM + CJS + CLI flow + strict NodeNext
node scripts/publish-packages.mjs --dry-run             # 19 packages ready (dry run only)
```

---

## 4. Product changes in M15

### `mutation` cancellation contract

Documented in `packages/state/README.md` and covered by a new
`describe('mutation — cancellation contract')` block:

- last-run-wins on the same instance; overlapping runs are not serialized;
- the superseded run still settles for its own caller but never writes state and
  never fires `onSuccess`/`onError`/`onSettled`;
- independent mutation instances stay fully concurrent;
- every live run receives a fresh `AbortController` (`MutationRunContext { signal }`);
- a cancelled run never resolves into a false `success`;
- **abort is transport-only** — it does not roll back anything the server already
  did;
- `dispose()` is final and idempotent.

One-argument mutators keep working (`({ n }) => n * 2`).

### Dashboard real-HTTP integration

`examples/streetui-dashboard` now has a genuine HTTP data path, not a documented
one:

- `createHttpDataSourceFromClient(client)` — the reusable seam;
- `createServerDataSource(env)` — mock when unset, HTTP + `Authorization: Bearer`
  when configured, reading `STREETUI_DASHBOARD_API_TOKEN` (deliberately not
  `STREETUI_PUBLIC_*`) so the credential can never be inlined into a client
  bundle;
- reads retry with backoff and honour `Retry-After`; writes never retry;
  multipart upload keeps a real boundary;
- `http-patterns.test.ts` (20 tests) and `http-e2e.test.ts` (18 tests) drive a
  real `node:http` server over a socket, including SSR asserting the token never
  appears in the rendered document.

Dashboard suite: 65/65 tests, `tsc --noEmit` clean.

### Shared infrastructure added

- `scripts/lib/harness-status.mjs` — the single source of exit-code truth.
- `scripts/lib/perf-stats.mjs` — sampling statistics used by the perf harnesses.
- `scripts/dependency-audit.mjs` — TS-compiler-API dependency/supply-chain scan
  with documented exceptions and a recorded artifact.
- `test:scripts`, `audit:workflow`, `audit:dependencies`, `audit:api`,
  `perf:toolchain` npm scripts.

---

## 5. What is blocked, and why

### GitHub Actions — BLOCKED (owner action)

Jobs do not start:

```
The job was not started because your account is locked due to a billing issue
```

This is an account state, not a code defect. Every browser capability the
workflows exercise has been run locally on all three engines, but **local
results are not GitHub CI evidence**, and none is reported as such. The workflows
themselves are asserted by `ci-workflow-audit.mjs` (252 assertions).

### Registry publication — BLOCKED (approval)

Packing, verification, the offline consumer smoke test and the publish dry run all
pass. Actual publication is the one irreversible action and requires explicit
maintainer approval, which has not been given. Nothing was published.

### Clean-checkout acceptance — BLOCKED

All M8–M15 work in this checkout is uncommitted. A clean-checkout run is therefore
impossible until the work is committed with approval; local and packed evidence is
labelled accordingly.

### Networked advisory checks

`pnpm audit` intermittently hits `ECONNRESET` against `registry.npmjs.org`.
Retries succeeded for every run recorded here. A network failure is classified
BLOCKED, never "clean". Current advisories (28 occurrences: low 3, moderate 17,
high 4, critical 4) resolve through root dev tooling and the `streetjs-website`
example; **no advisory resolves through a published package's runtime
dependency**. No automatic fix was applied.

---

## 6. Documentation updated

- `README.md` — subpath list incl. `streetui/diagnostics`, 19-package build,
  verification command block, evidence labels.
- `CHANGELOG.md` — `Unreleased — M15` with **Fixed** / **Added** / **Changed**.
- `docs/README.md` — mutation cancellation pointer, HTTP integration, verification
  harnesses, M15 entries.
- `docs/ROADMAP.md` — M15 completed; remaining work moved to Planned.
- `docs/release-process.md` — SSOT package set, real API-inventory scope, stale
  `dist/` guard, strict consumer, evidence-target table, current gate status.
- `docs/deployment.md` — fourth public subpath, `STREETUI_PUBLIC_*` boundary,
  consumer verification.
- `docs/toolchain/http-integration.md` — new.
- `docs/toolchain/m15-api-consistency.md` — new.
- `CONTRIBUTING.md` — release set, shared exit contract, evidence labels, bin
  collision, server-only secret rule, release sequence.
- `SECURITY.md` — new "Client/server data boundary" section.
- `examples/streetui-dashboard/README.md` — HTTP files, server-only token.
- `packages/streetui/README.md` — 3.2.2, full CLI surface, subpath table.
- `AGENTS.md` — M15 section and corrected tool inventory.

---

## 7. Reproducing this report

Every command in section 3 is non-mutating against the source tree except
`pack-tarballs.mjs`, which writes `dist-tarballs/`. No `git` mutation, no version
bump and no publication was performed. The pre-change backup at
`/tmp/streetui-m15-prechange-20261124T180545Z` was re-verified after all work:
`sha256sum -c SHA256SUMS` → all OK.
