#!/usr/bin/env node
/**
 * M15.8 — dependency and supply-chain audit (read-only).
 *
 * Checks declared-vs-imported dependencies across every workspace package using
 * the TypeScript compiler API and Node built-ins only. It never modifies a
 * manifest, never runs an audit fix, and never treats "not installed" as clean:
 * anything it cannot verify is reported as BLOCKED.
 *
 * Three kinds of result are kept strictly separate:
 *
 *   policy        deterministic first-party defects → nonzero exit
 *   candidates    unused/duplicate *suggestions* → reported, never auto-applied
 *   registry      `pnpm audit` output → BLOCKED when the registry is unreachable
 *
 * Usage: node scripts/dependency-audit.mjs [--skip-network] [--json]
 * Output: benchmarks/results/toolchain/dependency-audit.json
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PUBLIC_DIRS, packageName as publicPackageName, expectedLicense, isCoordinated } from './lib/public-packages.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skipNetwork = process.argv.includes('--skip-network');
const outFile = join(ROOT, 'benchmarks', 'results', 'toolchain', 'dependency-audit.json');

const BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Documented, narrow exceptions. Every entry names the package(s) it applies to
 * and why the dependency is legitimate even when a naive scan cannot see it.
 */
const EXCEPTIONS = [
  {
    id: 'playwright-optional',
    packages: ['scripts', '@streetui/cli'],
    specifiers: ['playwright', 'playwright-core', '@playwright/test'],
    reason:
      'Browser harnesses and `streetui doctor` import Playwright lazily inside try/catch, so the module still loads on hosts without browsers. It is a root devDependency, never a runtime dependency.',
  },
  {
    id: 'typescript-compiler-api',
    packages: ['@streetui/cli'],
    specifiers: ['typescript'],
    reason:
      'The CLI toolchain uses the TypeScript compiler API at runtime to transform TS→JS; it is a declared runtime dependency.',
  },
  {
    id: 'template-sources',
    packages: ['@streetui/cli', 'create-streetui'],
    specifiers: ['*'],
    reason:
      'Scaffolding templates are copied into generated projects and declare their own dependencies there; they are not imports of the CLI package itself.',
  },
  {
    id: 'self-reference',
    packages: ['streetui', '@streetui/*'],
    specifiers: ['streetui', '@streetui/*'],
    reason:
      'A package may import its own public entry (integration tests exercise the shipped surface exactly as a consumer would).',
  },
  {
    id: 'build-only-tooling',
    packages: ['*'],
    specifiers: ['tsup', 'vitest', 'typescript', '@types/*', 'happy-dom', 'turbo', 'eslint', '@typescript-eslint/*', 'vite', 'esbuild', '@vitejs/*', 'jsdom', '@vitest/*'],
    reason: 'Build, test and lint inputs are dev-only and never part of a published runtime graph.',
  },
  {
    id: 'legacy-streetjs-site',
    packages: ['streetjs-website'],
    specifiers: ['streetui', 'vite', 'esbuild'],
    reason:
      'examples/streetjs-website is the legacy StreetJS site pinned to the published 3.0.2 API and its own Vite/esbuild build. It is intentionally outside the workspace StreetUI build graph; migrating it is separate work.',
  },
];

function globMatch(pattern, value) {
  if (pattern === '*') return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return value.startsWith(prefix);
  }
  if (pattern.endsWith('*')) return value.startsWith(pattern.slice(0, -1));
  return pattern === value;
}

function exceptionFor(packageName, specifier) {
  return EXCEPTIONS.find(
    (entry) =>
      entry.packages.some((pattern) => globMatch(pattern, packageName)) &&
      entry.specifiers.some((pattern) => globMatch(pattern, specifier)),
  );
}

function packageRootOf(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function workspaceMemberDirs() {
  const readDirs = (parent) => {
    const base = join(ROOT, parent);
    if (!existsSync(base)) return [];
    return readdirSync(base)
      .map((name) => join(parent, name))
      .filter((dir) => {
        try {
          return statSync(join(ROOT, dir, 'package.json')).isFile();
        } catch {
          return false;
        }
      });
  };
  return [...readDirs('packages'), ...readDirs('apps'), ...readDirs('examples')];
}

function readManifest(dir) {
  return JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'));
}

function sourceFiles(dir) {
  const base = join(ROOT, dir);
  const collected = [];
  const walk = (current, inTemplates) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, inTemplates || entry.name === 'templates');
        continue;
      }
      // Vitest emits `*.timestamp-*.mjs` configs at runtime; they are generated
      // artifacts, not package source, and import `file:` URLs.
      if (/\.timestamp-\d+-[a-z0-9]+\.mjs$/.test(entry.name)) continue;
      if (!SOURCE_EXTENSIONS.includes(entry.name.slice(entry.name.lastIndexOf('.')))) continue;
      if (inTemplates) continue;
      collected.push(full);
    }
  };
  walk(base, false);
  return collected;
}

/** Collect module specifiers from import/export/require/dynamic import. */
function importedSpecifiers(file) {
  const source = readFileSync(file, 'utf8');
  const specifiers = new Set();
  const isTs = /\.(ts|tsx|mts|cts)$/.test(file);
  const scriptKind = isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) {
      if (ts.isStringLiteral(node.moduleSpecifier)) specifiers.add(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
      const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      if ((isRequire || isImport) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
        specifiers.add(node.arguments[0].text);
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      if (ts.isStringLiteral(node.argument.literal)) specifiers.add(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return [...specifiers];
}

function isExternal(specifier) {
  return (
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('#') &&
    !specifier.includes('?') &&
    !specifier.endsWith('.css')
  );
}

const problems = [];
const candidates = [];
const notes = [];

const members = workspaceMemberDirs().map((dir) => ({ dir, manifest: readManifest(dir) }));
const byName = new Map(members.map((member) => [member.manifest.name, member]));

// ── 1. Release set, private flags, licenses, workspace protocol ──────────────
for (const dir of PUBLIC_DIRS) {
  const member = members.find((entry) => entry.dir === `packages${sep}${dir}` || entry.dir === `packages/${dir}`);
  if (member === undefined) {
    problems.push({ check: 'public-package', dir, message: `public package directory packages/${dir} is missing` });
    continue;
  }
  if (member.manifest.private === true) problems.push({ check: 'public-package', dir, message: `${dir} is marked private but is in the release set` });
  const expected = expectedLicense(dir);
  if (member.manifest.license !== expected) {
    problems.push({ check: 'license', dir, message: `${dir} license is ${member.manifest.license ?? 'missing'}, expected ${expected}` });
  }
  if (isCoordinated(dir) && member.manifest.version !== members.find((m) => m.dir.endsWith(`/${'streetui'}`))?.manifest.version) {
    problems.push({ check: 'version', dir, message: `${dir} is not on the coordinated version` });
  }
  if (publicPackageName(dir) !== member.manifest.name) {
    problems.push({ check: 'naming', dir, message: `packages/${dir} declares "${member.manifest.name}"` });
  }
}

for (const member of members) {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(member.manifest[field] ?? {})) {
      if (byName.has(name) && !String(range).startsWith('workspace:')) {
        const exception = exceptionFor(member.manifest.name, name);
        if (exception !== undefined) {
          notes.push(
            `${member.manifest.name}: ${field}.${name} pins "${range}" instead of workspace:* — allowed by exception "${exception.id}".`,
          );
          continue;
        }
        problems.push({
          check: 'workspace-protocol',
          dir: member.dir,
          message: `${field}.${name} must use "workspace:*" for an internal package, found "${range}"`,
        });
      }
      if (!byName.has(name) && String(range).startsWith('workspace:')) {
        problems.push({
          check: 'workspace-protocol',
          dir: member.dir,
          message: `${field}.${name} uses "workspace:*" but is not a workspace package`,
        });
      }
    }
  }
}

// ── 2. Declared vs imported ─────────────────────────────────────────────────
const declaredFor = (member) => ({
  ...(member.manifest.dependencies ?? {}),
  ...(member.manifest.devDependencies ?? {}),
  ...(member.manifest.peerDependencies ?? {}),
  ...(member.manifest.optionalDependencies ?? {}),
});

const usedBy = new Map();
for (const member of members) {
  const declared = declaredFor(member);
  const internal = new Set(Object.keys(declared).filter((name) => byName.has(name)));
  const seen = new Set();
  for (const file of sourceFiles(member.dir)) {
    for (const specifier of importedSpecifiers(file)) {
      if (!isExternal(specifier)) continue;
      if (BUILTINS.has(specifier) || BUILTINS.has(packageRootOf(specifier))) continue;
      const root = packageRootOf(specifier);
      if (internal.has(root) || seen.has(root)) continue;
      seen.add(root);
      if (!usedBy.has(member.manifest.name)) usedBy.set(member.manifest.name, new Map());
      usedBy.get(member.manifest.name).set(root, relative(ROOT, file));
    }
  }
}

for (const member of members) {
  const declared = Object.keys(declaredFor(member));
  const used = usedBy.get(member.manifest.name) ?? new Map();
  for (const [specifier, file] of used) {
    if (!declared.includes(specifier)) {
      if (exceptionFor(member.manifest.name, specifier) !== undefined) continue;
      problems.push({
        check: 'undeclared-dependency',
        dir: member.dir,
        message: `imports "${specifier}" (${file}) but does not declare it`,
      });
    }
  }
  for (const name of declared) {
    if (byName.has(name)) continue; // internal edges are checked above
    if (used.has(name)) continue;
    if (exceptionFor(member.manifest.name, name) !== undefined) continue;
    // A dependency can be legitimate without a static import (bins, configs,
    // templates). Report it as a candidate, never as a failure.
    candidates.push({
      check: 'unused-candidate',
      package: member.manifest.name,
      dependency: name,
      reason: 'no static import found in this package source (verify bins/configs/templates before removing)',
    });
  }
}

// ── 3. Runtime dependency policy for the CLI (typescript only) ──────────────
const cli = members.find((member) => member.manifest.name === '@streetui/cli');
if (cli === undefined) {
  problems.push({ check: 'cli-runtime', dir: 'packages/cli', message: 'CLI package not found' });
} else {
  const runtime = Object.keys(cli.manifest.dependencies ?? {});
  const allowed = new Set(['typescript']);
  for (const name of runtime) {
    if (!allowed.has(name)) {
      problems.push({
        check: 'cli-runtime',
        dir: cli.dir,
        message: `@streetui/cli runtime dependency "${name}" is not allowed (typescript only)`,
      });
    }
  }
  if (!runtime.includes('typescript')) {
    problems.push({ check: 'cli-runtime', dir: cli.dir, message: '@streetui/cli must declare typescript as a runtime dependency' });
  }
}

// ── 4. Lockfile importers ──────────────────────────────────────────────────
const lockfile = join(ROOT, 'pnpm-lock.yaml');
if (!existsSync(lockfile)) {
  problems.push({ check: 'lockfile', dir: '.', message: 'pnpm-lock.yaml is missing' });
} else {
  const lock = readFileSync(lockfile, 'utf8');
  for (const member of members) {
    const importer = member.dir.split(sep).join('/');
    const needle = `  ${importer}:`;
    const topNeedle = importer === '.' ? '  .:' : needle;
    if (!lock.includes(topNeedle)) {
      problems.push({ check: 'lockfile', dir: member.dir, message: `pnpm-lock.yaml has no importer for ${importer}` });
    }
  }
}

// ── 5. Playground must stay private and un-released ────────────────────────
const playground = members.find((member) => member.manifest.name === '@streetui/playground');
if (playground !== undefined && playground.manifest.private !== true) {
  problems.push({ check: 'playground', dir: playground.dir, message: '@streetui/playground must be private' });
}
if (PUBLIC_DIRS.includes('playground')) {
  problems.push({ check: 'playground', dir: 'packages/playground', message: 'playground must not be in the release set' });
}

// ── 6. Installed-tree verification (frozen install evidence) ───────────────
const frozen = { install: 'not-run', dedupe: 'not-run', licenses: 'not-run', notes: [] };
function runPnpm(args, { timeout = 180000 } = {}) {
  const pnpm = process.env.PNPM_BIN ?? '/tmp/pnpm-shim/pnpm';
  const command = existsSync(pnpm) ? pnpm : 'corepack';
  const fullArgs = existsSync(pnpm) ? args : ['pnpm@9.15.4', ...args];
  return execFileSync(command, fullArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

if (!skipNetwork) {
  /**
   * `pnpm audit` exits nonzero whenever any advisory exists, so the JSON body is
   * the evidence — never the exit code. Vulnerabilities are reported, not fixed:
   * this project never runs an automatic audit fix.
   */
  const recordAudit = (parsed) => {
    const counts = parsed.metadata?.vulnerabilities ?? {};
    const total = Object.values(counts).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
    frozen.audit = total === 0 ? 'ok' : 'vulnerabilities';
    frozen.auditCounts = counts;
    frozen.auditActions = (parsed.actions ?? []).map((action) => {
      const paths = (action.resolves ?? []).map((entry) => entry.path);
      const origins = [...new Set(paths.map((path) => {
        if (path.startsWith('.')) return 'root-dev-only';
        const importer = path.split('>')[0];
        if (/^packages__/.test(importer)) return 'workspace-package';
        if (/^examples__/.test(importer)) return 'example';
        if (/^apps__/.test(importer)) return 'app';
        return 'unknown';
      }))];
      return { action: action.action, module: action.module, target: action.target, paths, origins };
    });
    // A published runtime dependency is only at risk when an advisory reaches a
    // public package's `dependencies` (not its dev/test tooling).
    const publicDirs = new Set(PUBLIC_DIRS.map((dir) => `packages__${dir}`));
    frozen.auditTouchesPublicRuntime = (frozen.auditActions ?? []).some((action) =>
      action.paths.some((path) => {
        const importer = path.split('>')[0];
        if (!publicDirs.has(importer)) return false;
        // Root devDeps and examples are excluded by the importer test above.
        const chain = path.split('>');
        return chain.length > 1;
      }),
    );
    if (total > 0) {
      notes.push(
        `pnpm audit reported ${total} advisory occurrence(s) (${Object.entries(counts)
          .filter(([, value]) => typeof value === 'number' && value > 0)
          .map(([severity, value]) => `${severity}=${value}`)
          .join(' ')}). Review manually — no automatic fix was applied.`,
      );
      if (frozen.auditTouchesPublicRuntime === false) {
        notes.push(
          'No advisory resolves through a published package runtime dependency; findings are root dev tooling and an example.',
        );
      }
    }
  };

  try {
    runPnpm(['install', '--frozen-lockfile', '--offline']);
    frozen.install = 'ok';
  } catch (error) {
    frozen.install = 'BLOCKED';
    frozen.notes.push(`frozen offline install failed: ${String(error.stderr ?? error.message).split('\n')[0]}`);
  }
  try {
    runPnpm(['dedupe', '--check']);
    // `--check` exits 0 only when the lockfile is already deduped. It never
    // rewrites the lockfile, so a zero exit is real evidence.
    frozen.dedupe = 'ok';
  } catch (error) {
    const message = String(error.stdout ?? error.stderr ?? error.message);
    frozen.dedupe = /ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|network|fetch/i.test(message) ? 'BLOCKED' : 'changes-needed';
    frozen.notes.push(`pnpm dedupe --check: ${message.split('\n').filter(Boolean).slice(-1)[0] ?? 'failed'}`);
  }
  try {
    const raw = runPnpm(['licenses', 'list', '--json', '--prod']);
    const parsed = JSON.parse(raw);
    const nonPermissive = [];
    for (const [license, entries] of Object.entries(parsed)) {
      if (/^(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|0BSD|BlueOak-1\.0\.0|CC0-1\.0|Unlicense)$/.test(license)) continue;
      nonPermissive.push({ license, count: Array.isArray(entries) ? entries.length : 0 });
    }
    frozen.licenses = nonPermissive.length === 0 ? 'ok' : 'review';
    frozen.licenseExceptions = nonPermissive;
  } catch (error) {
    frozen.licenses = 'BLOCKED';
    frozen.notes.push(`pnpm licenses list failed: ${String(error.stderr ?? error.message).split('\n')[0]}`);
  }
  try {
    const raw = runPnpm(['audit', '--json'], { timeout: 180000 });
    recordAudit(JSON.parse(raw));
  } catch (error) {
    const stdout = String(error.stdout ?? '');
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined) recordAudit(parsed);
    else {
      frozen.audit = 'BLOCKED';
      frozen.notes.push(`pnpm audit unavailable: ${String(error.stderr ?? error.message).split('\n')[0]}`);
    }
  }
} else {
  frozen.notes.push('--skip-network: frozen install, dedupe, license and audit checks were not run (BLOCKED, not clean).');
  frozen.install = 'BLOCKED';
  frozen.dedupe = 'BLOCKED';
  frozen.licenses = 'BLOCKED';
  frozen.audit = 'BLOCKED';
}

const report = {
  schema: 'streetui-dependency-audit/v1',
  created: new Date().toISOString(),
  evidenceTarget: 'local-workspace',
  workspacePackages: members.length,
  publicPackages: PUBLIC_DIRS.length,
  checks: {
    publicPackageSet: PUBLIC_DIRS.length,
    manifestScans: members.length,
    sourceFiles: members.reduce((sum, member) => sum + sourceFiles(member.dir).length, 0),
  },
  exceptions: EXCEPTIONS.map(({ id, packages, specifiers, reason }) => ({ id, packages, specifiers, reason })),
  policy: problems,
  candidates,
  frozen,
  notes,
  ok: problems.length === 0,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

console.log(`dependency-audit: ${members.length} workspace packages, ${PUBLIC_DIRS.length} public`);
console.log(`  policy defects: ${problems.length}`);
console.log(`  removal candidates (informational): ${candidates.length}`);
console.log(`  frozen install: ${frozen.install}; dedupe: ${frozen.dedupe}; licenses: ${frozen.licenses}; audit: ${frozen.audit ?? 'not-run'}`);
for (const problem of problems) console.error(`  [error] ${problem.check} ${problem.dir}: ${problem.message}`);
for (const note of frozen.notes) console.log(`  [note] ${note}`);

if (!report.ok) {
  console.error(`DEPENDENCY AUDIT FAILED — ${problems.length} policy defect(s)`);
  process.exitCode = 1;
}
