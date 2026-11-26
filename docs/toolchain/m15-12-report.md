# M15.12 — Controlled Integration and Release Preparation: report

**Status: PARTIAL.** Every gate this environment can prove is verified locally and
the release candidate is technically ready. Controlled GitHub integration (review
and merge), GitHub Actions, and npm publication remain blocked on explicit owner
approval and a billing lock. No Git history, GitHub state, or npm release was
changed while preparing this report.

**Prepared:** 2026-11-26. Evidence runs: 2026-11-24..2026-11-25.

Evidence labels are kept separate throughout: `local-workspace`,
`local-packed`, `npm-registry`, and `github-actions`. No local result is reported
as GitHub CI evidence, and no cached snapshot is reported as a fresh registry
read.

---

## 1. Repository status — PARTIAL

- Worktree: `/home/error51/Downloads/StreetUI/.kilo/worktrees/neon-newspaper`
  (linked worktree, branch `m13-production-hardening`).
- HEAD: `0dbb366db1d1cab75bec3170bd8499bfbc74cd03` = `origin/m13-production-hardening`
  (in sync with the pushed remote branch; nothing was pushed or fetched during
  M15.12).
- Base `origin/main`: `62ad4cfd`. `origin/m12-developer-adoption`:
  `6ab3670c`. `origin/build-streetui-toolchain`: `d5d1ce1f`.
- Before M15.12 the working tree was dirty (~748 paths). The M15.12 follow-up
  added **17 modified source/doc/script paths and one new report**; the rest of
  the dirt is pre-existing tracked build output churn (see section 2).
- `turbo run build` 34/34, `turbo run typecheck` 52/52, `turbo run test` 52/52,
  ESLint clean, during the M15.12 verification suite.

The task brief assumed M15 was uncommitted. In fact, before M15.12 started, one
commit (`0dbb366d`, PR #4) had already been made with explicit user approval and
pushed. That fact is recorded here so the plan is based on reality, not on the
brief's assumption. The M15.12 follow-up edits are **not** in that commit.

## 2. Backup verification — VERIFIED (archive), with a noted limitation

Primary backup `/tmp/streetui-m15-prechange-20261124T180545Z`:

- `sha256sum -c SHA256SUMS` → all **22/22 OK** (verified again at the end of the
  M15.12 run).
- Contents preserved: `tracked.patch` (9,702,297 B), `untracked-files.tar.gz`
  (77 K), `inventory.json`, `status.porcelain.z`, `classify.mjs`,
  `source-doc-test-evidence.json`, `generated-build.json`,
  `generated-evidence.json`, `backup-*` and `patch-*` records.

**Limitation, not corruption:** `git apply --check --reverse tracked.patch` now
reports many "does not apply" hunks. That is expected — the worktree moved past
the backup (later M15 edits plus the `0dbb366d` commit and rebuilds). The archive
bytes are intact (checksums pass); it simply no longer reverse-applies to the
current tree, and it is kept read-only for reference.

Older artifacts `/tmp/streetui-m15-worktree.patch`,
`/tmp/streetui-m15-untracked.tar`, `/tmp/streetui-m15-status.txt` are still
present. They are not checksummed and were not used for restoration.

**No destructive cleanup, stash, reset, rebase, or branch switch was performed.**

## 3. GitHub synchronization table

| Artifact | Ref | State | Notes |
|---|---|---|---|
| `origin/main` | `62ad4cfd` | public | Contains M10/M11 (via merged PR #1). Does not contain M12/M13-M15. |
| PR #1 (M10+M11) | `912328ee` | **MERGED** | Base `main`. |
| PR #2 (3.2.1 corrective) | `d5d1ce1f` | OPEN, `CONFLICTING` | Base `main`. Its three commits are ancestors of PR #3. No human review; Copilot blocked by quota. |
| PR #3 (M12) | `6ab3670c` | OPEN, `MERGEABLE`, `UNSTABLE` | Base `main`. Contains PR #2's content. No human review. |
| PR #4 (M13-M15) | `0dbb366d` | OPEN, `MERGEABLE`, `UNSTABLE` | Base `m12-developer-adoption`. No human review; Copilot blocked by quota. Does **not** contain M15.12 follow-up. |
| Local HEAD | `0dbb366d` | = `origin/m13-production-hardening` | The M15 commit is pushed; the M15.12 follow-up is uncommitted in the worktree. |
| npm `3.2.2` | registry | published | Source is NOT synchronized to npm version; see section 7. |

Ancestry: `git rev-list --left-right --count origin/main...HEAD` → `14 5`
(origin/main has 14 commits not in HEAD; HEAD has 5 not in origin/main);
merge-base is `912328ee`. The PRs are mergeable via a merge commit; they are not
fast-forwardable onto `main`.

**Committed / pushed / reviewed / merged:** only PR #1 is merged. PRs #2, #3, #4
are open, unmerged, and have no human approval. "3.2.2 on npm" must never be
read as "M15 source is published" — the published artifacts predate the M15
source changes (confirmed in section 7).

## 4. Git approval gate — BLOCKED (no new integration performed)

No commit, push, PR, merge, force-push, history rewrite, or branch switch was
performed during M15.12. The M15.12 follow-up edits sit uncommitted in the
worktree, on top of HEAD `0dbb366d`.

### Proposed source-only integration plan (requires explicit approval)

1. Keep the current worktree and backup untouched.
2. On approval, create a **separate clean worktree based on the correct source
   commit** `0dbb366d` (or the approved PR head), never reusing the dirty tree.
3. Apply a **reviewed staging allowlist** — the exact M15.12 source/docs/script
   paths, nothing generated:
   - `scripts/lib/harness-status.mjs` + `harness-status.test.mjs`
   - `scripts/toolchain-registry-smoke.mjs`
   - `scripts/consumer-smoke.mjs`
   - `packages/streetui/src/diagnostics.ts` and `streetui.public.test.ts`
   - `docs/toolchain/m15-12-report.md` (this file),
     `docs/toolchain/m15-api-consistency.md`, `docs/toolchain/http-integration.md`
   - `docs/README.md`, `docs/api-v1.0.md`, `docs/deployment.md`
   - `README.md`, `AGENTS.md`, `CHANGELOG.md`
   - `packages/streetui/README.md`, `packages/cli/README.md`,
     `examples/streetui-dashboard/README.md`
   - plus any committed M13-M15 source paths already in PR #4 (unchanged).
4. Rebuild, then rerun the full verification suite (section 9) in that clean
   worktree.
5. Commit the follow-up and push it to PR #4 (or a new PR, as approved).
6. Review and merge PR #3 first, then PR #4; decide PR #2 closure (its content
   is already in PR #3) — all with owner approval.

**Excluded from the allowlist:** `node_modules/`, `.turbo/`, generated `dist/`,
`benchmarks/results/`, `dist-tarballs/`, `.kilo/plans/`, `scripts/_probe-*.mjs`.
Removing previously-tracked generated files (`dist/`, `.turbo/`, `node_modules`
churn) is a **separate change** requiring its own authorization and is not
proposed in this PR.

## 5. Release verification — VERIFIED (local), not published

Run in sequence from this worktree (all 19 packages, `@streetui/playground`
excluded, `create-streetui` included):

| Step | Result |
|---|---|
| `node scripts/release-build.mjs` | RELEASE BUILD OK — every declared declaration exists |
| `node scripts/release-check.mjs` | RELEASE CHECK OK — 19 packages (18 coordinated), 0 warnings |
| `node scripts/apply-publish-metadata.mjs --check` | up to date across 19 packages |
| `node scripts/pack-tarballs.mjs` | 19 tarballs @ 3.2.2 (candidate version) |
| `node scripts/verify-tarballs.mjs` | TARBALL VERIFICATION OK — 19 tarballs |
| `node scripts/consumer-smoke.mjs` | PASS — ESM, CJS, CLI flow, strict NodeNext |
| `node scripts/publish-packages.mjs --dry-run --tag latest` | Dry run complete — 19 packages ready (no publish) |
| `node scripts/api-inventory.mjs` | 682 values, 461 types, 23 subpaths, 0 missing |

Confirmed against the packed manifests: one coordinated version; `create-streetui`
in the additional publish set; `@streetui/playground` absent; every declared
`exports` target exists; declarations present; READMEs included; **no
`workspace:` protocol** remains; dependencies resolve (strict consumer + Node
matrix + external developer acceptance all passed).

The current manifest/inventory live at `dist-tarballs/release-manifest.json` and
`dist-tarballs/api-inventory.json` (regenerated after packing so both exist).

## 6. Unreleased `streetui/diagnostics` — VERIFIED locally, FAILED on npm 3.2.2

The subpath is **unreleased source**, not in npm 3.2.2. Verified:

- Source entry: `packages/streetui/src/diagnostics.ts` (re-exports
  `@streetui/compiler/diagnostics`).
- Build entry: `tsup.config.ts` `diagnostics` entry; `tsconfig.build.json` maps
  `@streetui/compiler/diagnostics` so rollup-dts inlines declarations.
- Manifest: `exports["./diagnostics"]` with `import` + `require` and declaration
  targets; pinned by `REQUIRED_SUBPATHS.streetui`.
- ESM: `import('streetui/diagnostics')` → `analyzeGraph`, `inspectCompilation`,
  `formatInspection` (functions).
- CJS: `require('streetui/diagnostics')` → same exports.
- Declarations: `dist/diagnostics.d.ts` / `.d.cts` self-contained; `types` targets
  exist.
- External consumer: strict NodeNext consumer (`skipLibCheck:false`) imports every
  declared subpath including `streetui/diagnostics` and executes the documented
  example through ESM and CJS (`ESM-DIAGNOSTICS-OK`, `CJS-DIAGNOSTICS-OK`).

**Published baseline defect (registry evidence):** npm 3.2.2's `streetui/testing`
declarations still reference `streetui/diagnostics`, which is not declared. A
strict consumer against npm 3.2.2 fails:

```
error TS2307: Cannot find module 'streetui/diagnostics' or its corresponding type declarations.
```

(Confirmed by downloading and compiling against the published tarball; exit 2.)
This is the D-1 defect that the local candidate fixes; it remains live on npm
until a new coordinated release is published.

**Documentation wording:** root README, `packages/streetui/README.md`,
`docs/deployment.md`, `docs/README.md`, and `AGENTS.md` now mark
`streetui/diagnostics` explicitly **Unreleased / not in npm 3.2.2**, and the
dashboard's `http-patterns.ts` helpers are marked unreleased example code (not
new `streetui` exports). A verified diagnostics example is in
`packages/streetui/README.md` and is exercised by the public API tests and the
consumer smoke. `CHANGELOG.md` records M13/M15/M15.12 capabilities under
**Unreleased**.

## 7. Registry reconciliation — MATCH 16 / LOCAL_ONLY 3 (npm-registry evidence)

Downloaded all 19 published packages from `registry.npmjs.org`, verified
tarball integrity against the published `dist.integrity`, and compared file
hashes against the locally packed candidate.

| Classification | Packages |
|---|---|
| **MATCH (16)** | core, events, scheduler, graph, dsl, compiler, runtime, dom, renderer, router, forms, i18n, context, devtools, testing, create-streetui |
| **LOCAL_ONLY (3)** | `@streetui/state`, `@streetui/cli`, `streetui` |
| VERSION_MISMATCH | none (all 19 at `latest` 3.2.2) |
| PACKAGE_CONTENT_MISMATCH | none (every difference is an explained M15 change) |
| MISSING | none in the 19-set; `@streetui/playground` correctly absent by design |

Differences in the 3 local-only packages are exactly the M15 source changes:

- `@streetui/state` (7 files): `mutation` per-run abort/run-context + README.
- `@streetui/cli` (15 files): preview SPA fallback, SSR runner Node-18 handling,
  README — plus rebuilt bundles.
- `streetui` (48 files): new `./diagnostics` entry and bundled declarations,
  rebuilt bundles and README; the remaining `PUBLISHED_ONLY`/`LOCAL_ONLY`
  declaration chunks are content-hash renames from rebuilding, not missing APIs.

All three: `declarationTargetsPresent=true`, `readmePresent=true`,
`workspaceProtocols=false`, registry integrity true. **M15 functionality is
explicitly LOCAL_ONLY until published.** A fresh network reconciliation at the
end of M15.12 hit a registry `ETIMEDOUT`/`ENETUNREACH`; the offline refresh
against the already-downloaded, integrity-verified snapshot produced the same
classification (`registry-reconciliation-offline.json`). The refresh is labelled
`cached npm-registry snapshot vs current local-packed (offline refresh)`, never
"fresh registry evidence".

## 8. GitHub Actions recovery — BLOCKED

Latest runs on PR #4 head `0dbb366d`:

- `CI` (run `45549032480`) → `failure`, and `Browser validation`
  (run `45549032508`) → `failure`. Both completed in 2-3 seconds with **zero
  steps executed**.
- Annotation: `The job was not started because your account is locked due to a
  billing issue.`

Prior scheduled/push runs on `main` also fail (e.g. `45169437011`,
`45021856259`), so the lock predates this work. The `Vercel` failure on PR #4 is
the separate pre-existing `streetjs-website` deployment issue.

**Exact owner action:** resolve the GitHub account billing lock on
`hassanmubiru` (restore Actions spend/payment), then re-run the workflows. No run
ID or success result is invented here.

Local workflow configuration is healthy: `node scripts/ci-workflow-audit.mjs` →
**WORKFLOW AUDIT OK — 252 assertions**. Local test success remains distinct from
GitHub CI success.

## 9. Final verification suite — VERIFIED (all local; one transient network retry)

| Gate | Result | Evidence |
|---|---|---|
| Shared lib unit tests | 33/33 pass | `scripts/lib/*.test.mjs` |
| Workflow audit | 252 assertions | `ci-workflow-audit.mjs` |
| Dependency audit | 0 policy defects | `dependency-audit.json` |
| API inventory | 682 values / 461 types / 23 subpaths / 0 missing | `api-inventory.json` |
| Turbo build | 34/34 | — |
| Turbo typecheck | 52/52 | — |
| ESLint | clean | — |
| Turbo test | 52/52 | — |
| Browser matrix (3 engines × dev/prod) | 6/6 `local-workspace` | chromium 153.0.8010.12, firefox 159.0, webkit 26.6 |
| SSR + hydration | 3/3 | `ssr-hydration.json` |
| HMR | 3/3 | `hmr.json` |
| Full axe audit | 0 violations / 7 routes × 3 engines | `a11y-axe.json` |
| Visual a11y | 6/6 | `visual-a11y.json` |
| Agent workflow JSON contract | PASS | — |
| Agent control-API e2e | 1/1 | `agent-e2e.json` |
| Agent visual e2e | 3/3 | `agent-visual-e2e.json` |
| Playground browser | 3/3 | `playground-browser.json` |
| Registry smoke | 2/2 `npm-registry` (final retry PASS) | `registry-smoke.json` |
| Registry compat | 18/18 `npm-registry` | `registry-compat.json` |
| Registry lifecycle e2e | 2/2 `npm-registry` | `registry-e2e.json` |
| External developer acceptance | 3/3 `local-packed` | `external-developer-e2e.json` |
| Template audit | 10/10 | — |
| Node 18/20/22/24 (packed) | 4/4 `local-packed` | `node-matrix.json` |
| Toolchain perf | 20 samples / scenario, cold/warm split | `perf.json` |
| Browser perf (chromium/dev) | OK | `streetui-browser.json` |
| External install (templates) | PASS | — |
| Consumer smoke (ESM/CJS/CLI/strict TS + diagnostics) | PASS | `consumer-smoke` |
| Publish dry-run `--tag latest` | 19 packages, no publish | — |

**Transient network retry (recorded, not hidden):** the first `registry-smoke`
run during M15.12 failed the basic template with `npm error ETIMEDOUT` while
installing `typescript`. The harness originally classified that infrastructure
outage as a product FAIL; I fixed the classification (`isNetworkError` +
preserved npm stderr) so network outages are reported BLOCKED with the real
diagnostic. A rerun against the registry completed **2/2 PASS**. This is the only
failure in the suite, it is network-caused, and it is now classified correctly.

## 10. Documentation consistency — VERIFIED (after updates)

- Root `README.md`: `streetui/diagnostics` marked unreleased; 19-package build;
  verification commands; evidence labels.
- `CHANGELOG.md`: M13/M15/M15.12 under **Unreleased**; no claim that npm 3.2.2
  contains M15 features.
- `docs/README.md`: global "3.2.2 published; Unreleased features are local-only"
  note; M15.12 report indexed.
- `docs/api-v1.0.md`: public API = declared `exports` entries (`.` + documented
  subpaths), not only `exports["."]`.
- `docs/deployment.md`, `docs/toolchain/*`: diagnostics marked unreleased;
  `@types/node` note for CLI consumers; `http-integration.md` separates framework
  primitives from unreleased example helpers.
- `packages/streetui/README.md`, `packages/cli/README.md`,
  `examples/streetui-dashboard/README.md`: unreleased diagnostics + example,
  CLI `@types/node` note, dashboard helpers marked unreleased.
- `AGENTS.md`: `streetui/diagnostics` unreleased; M15.12 report linked.
- Every newly documented API (diagnostics; mutation run context) has a verified
  example in source tests and the external consumer.

## 11. Release candidate — proposed **3.3.0** (not applied)

The repository's policy (`docs/api-v1.0.md`) is semver with a single coordinated
version: **minor** for backward-compatible additions, **patch** for fixes.
The M13-M15 set adds a new public subpath (`streetui/diagnostics`) and an
additive second mutator argument / `MutationRunContext` — both backward
compatible and additive, with no removal or breaking rename. A patch-only bump
would understate new public API; a major is unnecessary. Therefore the proposed
next coordinated version is **3.3.0** across all 19 packages (18 coordinated +
`create-streetui`), with `@streetui/playground` remaining private/unpublished.
This is a proposal for the approval gate; **no version was changed** and the
workspace still reads 3.2.2.

The candidate includes: all 19 packages; coordinated versions; TypeScript
declarations; public subpaths (incl. `streetui/diagnostics`);
`@streetui/playground` excluded; updated package docs/root README/CHANGELOG;
strict external consumer tests; Node 18/20/22/24 verification (packed). Publishing
requires explicit approval and is not performed.

## 12. Remaining approval gates — BLOCKED

1. **Integrate M15.12 source** into PR #4 (commit + push) — owner approval.
2. **Review** PRs #2/#3/#4 (human); no approvals yet; Copilot reviewer is blocked
   by quota.
3. **Merge** PR #3 then PR #4 (owner), and decide PR #2 closure (its content is
   in PR #3).
4. **Clear the GitHub billing lock** so CI can actually run.
5. **Bump to 3.3.0** and date the CHANGELOG (separate authorization; release
   tooling already enforces coordination).
6. **Publish** to npm `latest` (separate approval; dry-run passes).
7. **Cleanup of tracked generated files** (`dist/`, `.turbo/`, `node_modules`
   churn) — separate authorization.

## 13. Recommended release plan

1. Owner: approve step 1 of section 12 → add the M15.12 allowlist to PR #4.
2. Clear the billing lock; re-run CI on PR #3 and PR #4 to get real
   `github-actions` evidence (local evidence already labelled correctly).
3. Merge PR #3 (M12) into `main`, then PR #4 (M13-M15) — this restores full
   history to `main` and closes the loop on PR #2 (content included).
4. In a clean worktree at the merged source, set the coordinated version to
   **3.3.0**, run the full release sequence (`release-build` → `release-check` →
   `metadata --check` → `pack` → `verify` → `consumer-smoke` → `node-matrix
   --target packed` → `publish --dry-run --tag latest`), update the CHANGELOG,
   and re-verify the backup.
5. Owner approves and executes `publish-packages.mjs` (real), then re-runs
   `reconcile-registry` to record 19×`MATCH` at 3.3.0.
6. Optionally, in a separate authorized change, untrack generated files so the
   repository is clean going forward.

**Definition of success — achieved to the extent this environment allows:** all
M15 source changes are preserved (backup verified, committed/pushed in PR #4,
follow-up changes isolated and documented), independently verifiable (full local
suite green), and ready for controlled GitHub integration. The next npm release
is reproducible from verified source and actual tarballs. Git history, GitHub
state, and npm releases were not changed without approval — the remaining
integration, CI, and publication steps are exactly the approval gates listed in
section 12.
