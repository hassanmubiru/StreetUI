#!/usr/bin/env node
/**
 * M15.3 — workflow and harness configuration regression gate.
 *
 * Uses text/structural assertions instead of adding a YAML runtime dependency.
 * It protects required CI gates and rejects known silent-substitution patterns.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(repo, relative), 'utf8');
const ci = read('.github/workflows/ci.yml');
const browser = read('.github/workflows/browser-validation.yml');
const problems = [];
const checks = [];

function requireText(source, needle, label) {
  const ok = source.includes(needle);
  checks.push({ label, ok });
  if (!ok) problems.push(label);
}
function forbidText(source, needle, label) {
  const ok = !source.includes(needle);
  checks.push({ label, ok });
  if (!ok) problems.push(label);
}

for (const needle of [
  'pull_request:',
  'workflow_dispatch:',
  'permissions:\n  contents: read',
  'pnpm install --frozen-lockfile',
  'pnpm run typecheck',
  'pnpm run lint',
  'pnpm run test:ci',
  'pnpm build',
  'pnpm run release:meta:check',
  'scripts/release-check.mjs',
  'pnpm run release:pack',
  'pnpm run release:verify',
  'pnpm run release:smoke',
  'node: [18, 20, 22, 24]',
  'toolchain-node-matrix.mjs --target packed',
  'timeout-minutes:',
  'actions/upload-artifact@v4',
  'if: always()',
]) requireText(ci, needle, `ci.yml must retain: ${needle}`);

for (const needle of [
  'pull_request:',
  'workflow_dispatch:',
  'playwright install --with-deps chromium',
  'playwright install --with-deps firefox',
  'playwright install --with-deps webkit',
  '--engine chromium --mode both',
  '--engine firefox --mode both',
  '--engine webkit --mode both',
  'toolchain-a11y-axe.mjs --engines',
  'toolchain-ssr-hydration.mjs --engines',
  'toolchain-agent-e2e.mjs',
  'toolchain-agent-visual-e2e.mjs --engines',
  'toolchain-external-developer-e2e.mjs --engines',
  'timeout-minutes:',
  'actions/upload-artifact@v4',
]) requireText(browser, needle, `browser-validation.yml must retain: ${needle}`);

for (const [name, source] of [['ci.yml', ci], ['browser-validation.yml', browser]]) {
  forbidText(source, 'continue-on-error: true', `${name} must not hide failures with continue-on-error`);
  forbidText(source, '|| true', `${name} must not hide failures with || true`);
}

// The visual harness writes benchmarks/results/v2.5/visual-a11y.json; upload must
// reference that exact path or CI silently loses the evidence.
requireText(browser, 'node scripts/visual-a11y-axe.mjs --engine chromium --mode dev', 'visual harness must select an engine and mode explicitly');
requireText(browser, 'benchmarks/results/v2.5/visual-a11y.json', 'visual harness artifact must be uploaded from its real path');
forbidText(browser, 'benchmarks/results/visual-a11y-axe.json', 'visual harness artifact path must not be a stale location');

const browserHarness = read('scripts/toolchain-browser-tests.mjs');
requireText(browserHarness, 'modesFromArgv', 'browser harness must normalize --mode both via the shared parser');
requireText(browserHarness, 'launchBrowser(playwright, engine', 'browser harness must use verified engine launch');
requireText(browserHarness, 'harness-status', 'browser harness must use shared exit semantics');
requireText(browserHarness, 'actualMode', 'browser harness must record the mode the server actually ran');

// Engine selection was silently dropped when a harness understood only one of
// --engine / --engines, producing a green run with no record for an engine the
// caller asked for. Every browser harness must go through the shared parser, and
// none may re-implement the argv scan inline.
for (const file of [
  'scripts/toolchain-browser-tests.mjs',
  'scripts/toolchain-hmr.mjs',
  'scripts/toolchain-ssr-hydration.mjs',
  'scripts/toolchain-a11y-axe.mjs',
  'scripts/toolchain-registry-e2e.mjs',
  'scripts/toolchain-registry-smoke.mjs',
  'scripts/toolchain-registry-compat.mjs',
  'scripts/visual-a11y-axe.mjs',
  'scripts/browser-harness.mjs',
  'scripts/toolchain-agent-visual-e2e.mjs',
  'scripts/toolchain-playground-browser-tests.mjs',
  'scripts/toolchain-external-developer-e2e.mjs',
]) {
  const source = read(file);
  requireText(source, 'enginesFromArgv', `${file} must select engines through the shared parser`);
  forbidText(source, "process.argv.includes('--engine", `${file} must not parse --engine/--engines inline`);
  forbidText(source, "process.argv.at(-1)", `${file} must not guess the engine from the last argument`);
}
requireText(read('scripts/lib/browser-engines.mjs'), 'assertNoUnknownSelectionFlags', 'shared engine parser must reject unknown selection flags');

for (const file of [
  'scripts/toolchain-browser-tests.mjs',
  'scripts/toolchain-registry-e2e.mjs',
  'scripts/toolchain-registry-smoke.mjs',
  'scripts/toolchain-registry-compat.mjs',
  'scripts/visual-a11y-axe.mjs',
  'scripts/toolchain-agent-e2e.mjs',
  'scripts/toolchain-agent-visual-e2e.mjs',
  'scripts/toolchain-playground-browser-tests.mjs',
  'scripts/toolchain-external-developer-e2e.mjs',
]) {
  const source = read(file);
  requireText(source, 'harness-status', `${file} must use shared exit semantics`);
  requireText(source, 'requestedEngine', `${file} must record the requested engine`);
  requireText(source, 'actualEngine', `${file} must record the launched engine`);
}

// Release/registry harnesses must derive versions, never pin a stale one.
for (const file of ['scripts/toolchain-registry-e2e.mjs', 'scripts/toolchain-registry-smoke.mjs']) {
  const source = read(file);
  forbidText(source, "'3.1.0'", `${file} must not hardcode a stale expected version`);
  forbidText(source, "'3.1.6'", `${file} must not hardcode a stale CLI spec`);
  requireText(source, 'WORKSPACE_VERSION', `${file} must derive the expected version from the workspace`);
}

// Reject the historical silent-substitution and undeclared-build-tool patterns.
const scriptDir = path.join(repo, 'scripts');
for (const file of fs.readdirSync(scriptDir).filter((name) => name.endsWith('.mjs') && name !== 'ci-workflow-audit.mjs')) {
  const source = read(`scripts/${file}`);
  forbidText(source, "engine === 'firefox' ? firefox : chromium", `${file} must not map every non-Firefox engine to Chromium`);
  forbidText(source, "engine === 'firefox' ? 'firefox-' : 'chromium-'", `${file} must not use a Chromium fallback for unknown engines`);
  forbidText(source, "packages', 'cli', 'node_modules', 'esbuild'", `${file} must not import undeclared CLI-local esbuild`);
}

const report = {
  schema: 'streetui-workflow-audit/v1',
  created: new Date().toISOString(),
  checks: checks.length,
  problems,
  ok: problems.length === 0,
};
fs.mkdirSync(path.join(repo, 'ci-artifacts'), { recursive: true });
fs.writeFileSync(path.join(repo, 'ci-artifacts', 'workflow-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
if (problems.length > 0) {
  for (const problem of problems) console.error(`  [error] ${problem}`);
  console.error(`WORKFLOW AUDIT FAILED — ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`WORKFLOW AUDIT OK — ${checks.length} assertions`);
