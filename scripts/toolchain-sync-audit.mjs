#!/usr/bin/env node
/**
 * M15.1 — repository and registry synchronization audit (read-only).
 *
 * Compares local source, origin/main, open pull requests and the npm artifacts.
 * It never infers a Git commit from an npm version: tarball integrity and source
 * diffs are reported separately. No git refs or package contents are mutated.
 *
 * Usage: node scripts/toolchain-sync-audit.mjs [--skip-network]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_DIRS, packageName } from './lib/public-packages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const skipNetwork = process.argv.includes('--skip-network');

function run(command, args, { allowFailure = false, timeout = 30000 } = {}) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd();
  } catch (error) {
    if (allowFailure) return undefined;
    throw new Error(`${command} ${args.join(' ')} failed: ${error.stderr ?? error.message}`);
  }
}

function json(command, args, options = {}) {
  const raw = run(command, args, options);
  if (raw === undefined || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function classify(path) {
  if (path.includes('node_modules/') || path.includes('/.turbo/') || path.startsWith('.turbo/')) return 'generated-install-or-turbo';
  if (path.includes('/dist/') || path.startsWith('dist-tarballs/') || path.startsWith('ci-artifacts/')) return 'generated-build';
  if (/\.(log|tsbuildinfo)$/.test(path)) return 'generated-log';
  return 'source-doc-test-evidence';
}

const status = run('git', ['status', '--porcelain=v1'], { allowFailure: true }) ?? '';
const changedPaths = status.split('\n').filter(Boolean).map((line) => ({
  status: line.slice(0, 2),
  path: line.slice(3),
  category: classify(line.slice(3)),
}));
const categoryCounts = {};
for (const item of changedPaths) categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;

let tarballIndex = [];
const tarballIndexPath = join(ROOT, 'dist-tarballs', 'tarballs.json');
if (existsSync(tarballIndexPath)) tarballIndex = JSON.parse(readFileSync(tarballIndexPath, 'utf8'));

const packages = [];
for (const dir of PUBLIC_DIRS) {
  const name = packageName(dir);
  const relativeManifest = `packages/${dir}/package.json`;
  const local = JSON.parse(readFileSync(join(ROOT, relativeManifest), 'utf8'));
  const mainRaw = run('git', ['show', `origin/main:${relativeManifest}`], { allowFailure: true });
  const main = mainRaw === undefined ? undefined : JSON.parse(mainRaw);
  const diffFromMain = run('git', ['diff', '--name-only', 'origin/main', '--', `packages/${dir}`], { allowFailure: true }) ?? '';
  const untracked = run('git', ['ls-files', '--others', '--exclude-standard', '--', `packages/${dir}`], { allowFailure: true }) ?? '';
  const indexEntry = tarballIndex.find((entry) => entry.name === name);
  let localIntegrity;
  if (indexEntry !== undefined) {
    const tarballPath = join(ROOT, 'dist-tarballs', indexEntry.tarball);
    if (existsSync(tarballPath)) {
      const digest = createHash('sha512').update(readFileSync(tarballPath)).digest('base64');
      localIntegrity = `sha512-${digest}`;
    }
  }
  let registry;
  if (!skipNetwork) {
    registry = json('npm', ['view', `${name}@${local.version}`, 'version', 'dist', '--json'], {
      allowFailure: true,
      timeout: 45000,
    });
  }
  packages.push({
    name,
    localVersion: local.version,
    mainVersion: main?.version ?? null,
    changedFilesFromMain: diffFromMain === '' ? 0 : diffFromMain.split('\n').filter(Boolean).length,
    untrackedFiles: untracked === '' ? 0 : untracked.split('\n').filter(Boolean).length,
    localTarballIntegrity: localIntegrity ?? null,
    registryVersion: registry?.version ?? null,
    registryIntegrity: registry?.dist?.integrity ?? null,
    registryTarball: registry?.dist?.tarball ?? null,
    integrityMatches:
      localIntegrity !== undefined && registry?.dist?.integrity !== undefined
        ? localIntegrity === registry.dist.integrity
        : null,
  });
}

const report = {
  schema: 'streetui-repository-sync/v1',
  created: new Date().toISOString(),
  networkChecked: !skipNetwork,
  local: {
    branch: run('git', ['branch', '--show-current']),
    head: run('git', ['rev-parse', 'HEAD']),
    upstream: run('git', ['rev-parse', '--abbrev-ref', '@{upstream}'], { allowFailure: true }) ?? null,
    dirty: changedPaths.length > 0,
    categoryCounts,
    changedPaths,
  },
  remote: {
    originMain: run('git', ['rev-parse', 'origin/main']),
    lsRemoteMain: skipNetwork ? null : (run('git', ['ls-remote', 'origin', 'refs/heads/main'], { allowFailure: true }) ?? '').split('\t')[0] || null,
    branches: skipNetwork ? [] : (run('git', ['ls-remote', '--heads', 'origin'], { allowFailure: true }) ?? '').split('\n').filter(Boolean),
  },
  pullRequests: skipNetwork ? [] : (json('gh', ['pr', 'list', '--state', 'all', '--limit', '20', '--json', 'number,title,state,headRefName,headRefOid,baseRefName,mergedAt,url'], { allowFailure: true }) ?? []),
  actions: skipNetwork ? { enabled: null, recentRuns: [] } : {
    enabled: json('gh', ['api', 'repos/hassanmubiru/StreetUI/actions/permissions'], { allowFailure: true }) ?? null,
    recentRuns: json('gh', ['run', 'list', '--limit', '8', '--json', 'databaseId,name,status,conclusion,event,headBranch,headSha,createdAt,url'], { allowFailure: true }) ?? [],
  },
  releases: skipNetwork ? null : (run('gh', ['release', 'list', '--limit', '20'], { allowFailure: true }) ?? null),
  packages,
  interpretation: {
    publicationProvesGitSync: false,
    sourceSynchronizedToMain: packages.every((pkg) => pkg.changedFilesFromMain === 0 && pkg.untrackedFiles === 0),
    allLocalTarballsMatchRegistry: packages.every((pkg) => pkg.integrityMatches === true),
    note: 'A version match alone is not synchronization evidence. Compare source diffs and tarball integrity independently.',
  },
};

const outDir = join(ROOT, 'benchmarks', 'results', 'toolchain');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'repository-sync.json');
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Repository sync audit → ${out}`);
console.log(`Local ${report.local.branch}@${report.local.head.slice(0, 8)}; origin/main ${report.remote.originMain.slice(0, 8)}`);
console.log(`Dirty paths: ${changedPaths.length}; source/doc/test/evidence: ${categoryCounts['source-doc-test-evidence'] ?? 0}`);
console.log(`Source synchronized to main: ${report.interpretation.sourceSynchronizedToMain}`);
console.log(`All local tarballs match npm: ${report.interpretation.allLocalTarballsMatchRegistry}`);
