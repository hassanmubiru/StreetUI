#!/usr/bin/env node
/**
 * Node.js compatibility matrix for the StreetUI CLI.
 *
 * Runs the real CLI on each available Node version via `npx node@<version>`:
 * install, `--version`, scaffold, production build, doctor, dev-server SSR, and
 * production `start`. A version that cannot run is BLOCKED, never marked passed.
 *
 * The version under test is never hardcoded: it is read from
 * `packages/streetui/package.json` unless `--version` is given.
 *
 * Targets:
 *   --target npm     install `streetui@<v>` + `@streetui/cli@<v>` from the registry
 *   --target packed  pack the worktree (all 19 artifacts) and install the tarballs
 *                    (no workspace symlinks — the only honest pre-publish proof)
 *
 * Usage:
 *   node scripts/toolchain-node-matrix.mjs [--versions 18,20,22,24]
 *                                          [--target npm|packed] [--version <v>]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const versions = (arg('--versions') ?? '18,20,22,24').split(',').map((v) => v.trim()).filter(Boolean);
const target = arg('--target') ?? 'npm';
if (target !== 'npm' && target !== 'packed') throw new Error(`--target must be "npm" or "packed" (got ${target})`);

const artifactVersion =
  arg('--version') ??
  JSON.parse(fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8')).version;

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-node-matrix-'));

/** Pack every release artifact once; reused for every Node version. */
function packArtifacts() {
  const out = path.join(base, 'tarballs');
  execFileSync('node', [path.join(repo, 'scripts', 'pack-tarballs.mjs'), out], {
    cwd: repo,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600000,
  });
  return fs.readdirSync(out).filter((f) => f.endsWith('.tgz')).map((f) => path.join(out, f));
}

const packedTarballs = target === 'packed' ? packArtifacts() : [];

const report = {
  schema: 'streetui-node-matrix/v2',
  created: new Date().toISOString(),
  target,
  // `target` is the install source; this is the evidence label. A registry
  // install and a tarball install are never the same evidence.
  evidenceTarget: target === 'packed' ? 'local-packed' : 'npm-registry',
  artifactVersion,
  requestedVersions: versions,
  versions: {},
  ok: false,
};

function run(cmd, args, cwd, timeout = 300000) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHtml(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const html = await res.text();
        if (html.includes('id="app"')) return html;
      }
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not render the app at ${url}`);
}

/**
 * Scaffolded apps pin the framework by registry version, which does not exist
 * before publishing. Rewrite those specs to the sibling install so the matrix
 * exercises the freshly packed artifacts instead of attempting a registry fetch.
 */
function linkInstalledPackages(appDir, installDir) {
  const pkgPath = path.join(appDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  for (const field of ['dependencies', 'devDependencies']) {
    const deps = pkg[field];
    if (deps === undefined) continue;
    for (const name of Object.keys(deps)) {
      if (name === 'streetui' || name.startsWith('@streetui/')) delete deps[name];
    }
  }
  pkg.dependencies = pkg.dependencies ?? {};
  const scoped = fs.existsSync(path.join(installDir, 'node_modules', '@streetui'))
    ? fs.readdirSync(path.join(installDir, 'node_modules', '@streetui'))
    : [];
  if (fs.existsSync(path.join(installDir, 'node_modules', 'streetui'))) {
    pkg.dependencies.streetui = `file:${path.join(installDir, 'node_modules', 'streetui')}`;
  }
  for (const name of scoped) {
    pkg.dependencies[`@streetui/${name}`] = `file:${path.join(installDir, 'node_modules', '@streetui', name)}`;
  }
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

async function checkVersion(requested) {
  const result = { requested, checks: {} };
  let serverOutput = '';

  let nodeCmd;
  try {
    nodeCmd = requested === String(process.versions.node.split('.')[0])
      ? process.execPath
      : execFileSync('npx', ['-p', `node@${requested}`, 'which', 'node'], {
          encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000,
        }).trim();
    result.checks.nodeAvailable = true;
  } catch (error) {
    result.ok = false;
    result.blocked = true;
    result.error = `Node ${requested} is not available in this environment: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`;
    return result;
  }

  const runNode = (args, cwd) => run(nodeCmd, args, cwd);
  const app = path.join(base, `node-${requested}`);

  try {
    result.checks.nodeVersion = runNode(['--version'], base).trim();
    fs.mkdirSync(app, { recursive: true });
    run('npm', ['init', '-y'], app);

    if (target === 'packed') {
      run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...packedTarballs], app);
    } else {
      run('npm', ['install', `streetui@${artifactVersion}`, `@streetui/cli@${artifactVersion}`, '--no-audit', '--no-fund', '--loglevel=error'], app);
    }
    result.checks.install = true;

    // Invoke @streetui/cli explicitly: the streetui package ships a same-named
    // binary and npm's .bin collision would otherwise test the wrong artifact.
    const bin = path.join(app, 'node_modules', '@streetui', 'cli', 'dist', 'bin.js');
    const versionOut = runNode([bin, '--version'], app);
    result.checks.cliVersion = versionOut.trim();
    if (!result.checks.cliVersion.includes(artifactVersion)) {
      throw new Error(`unexpected CLI version: ${versionOut.trim()} (expected ${artifactVersion})`);
    }

    runNode([bin, 'create', 'app', '--template', 'ssr'], app);
    result.checks.scaffold = true;
    const appDir = path.join(app, 'app');
    // Only the packed target needs rewriting: those versions are not on the
    // registry yet, so the scaffold's pins must point at the tarball install.
    // `--target npm` must keep the real registry specs — that is the whole point.
    if (target === 'packed') linkInstalledPackages(appDir, app);
    run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], appDir);
    runNode([bin, 'build'], appDir);
    result.checks.build = fs.existsSync(path.join(appDir, 'dist', 'client', 'manifest.json'));
    if (!result.checks.build) throw new Error('production manifest missing');

    const doctor = runNode([bin, 'doctor'], appDir);
    if (!doctor.includes('StreetUI doctor') && !doctor.includes('Environment looks good')) throw new Error('doctor failed');
    result.checks.doctor = true;

    // Dev server: SSR HTML through the real runner (this is the Node 18 defect).
    const devPort = await freePort();
    const devOrigin = `http://localhost:${devPort}`;
    const dev = spawn(nodeCmd, [bin, 'dev', '--json', '--port', String(devPort)], { cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'] });
    dev.stdout.on('data', (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8000); });
    dev.stderr.on('data', (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8000); });
    try {
      const html = await waitForHtml(devOrigin);
      result.checks.devServer = true;
      result.checks.devServerBytes = html.length;

      // Edit cycle: an SSR source change must be reflected on the next request.
      const appFile = path.join(appDir, 'src', 'app.ts');
      const original = fs.readFileSync(appFile, 'utf8');
      const marker = `matrix-marker-${requested}`;
      fs.writeFileSync(appFile, original.replace(/page\.heading\('([^']*)'/, `page.heading('${marker}'`), 'utf8');
      try {
        const deadline = Date.now() + 60000;
        let regenerated = false;
        while (Date.now() < deadline) {
          const current = await (await fetch(devOrigin)).text();
          if (current.includes(marker)) { regenerated = true; break; }
          await new Promise((r) => setTimeout(r, 250));
        }
        result.checks.ssrRegeneration = regenerated;
        if (!regenerated) throw new Error('SSR did not regenerate after a source edit');
      } finally {
        fs.writeFileSync(appFile, original, 'utf8');
      }
    } finally {
      dev.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
    }

    // Production `start` on the built output.
    const startPort = await freePort();
    const startOrigin = `http://localhost:${startPort}`;
    const start = spawn(nodeCmd, [bin, 'start', '--port', String(startPort)], { cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'] });
    start.stdout.on('data', (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8000); });
    start.stderr.on('data', (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8000); });
    try {
      const html = await waitForHtml(startOrigin);
      result.checks.start = true;
      result.checks.startBytes = html.length;
    } finally {
      start.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
    }

    result.ok = true;
  } catch (error) {
    result.ok = false;
    result.error = error instanceof Error ? error.message.split('\n')[0] : String(error);
    if (typeof error === 'object' && error !== null) {
      const output = ['stdout', 'stderr']
        .map((key) => {
          const value = /** @type {{ stdout?: unknown, stderr?: unknown }} */ (error)[key];
          return typeof value === 'string' ? value : '';
        })
        .filter(Boolean)
        .join('\n');
      if (output.length > 0) result.commandOutput = output.slice(-8000);
    }
    if (serverOutput.length > 0) result.serverOutput = serverOutput;
  }
  return result;
}

for (const version of versions) {
  const result = await checkVersion(version);
  report.versions[version] = result;
  const label = result.ok ? 'PASS' : result.blocked ? 'BLOCKED' : 'FAIL';
  console.log(`node ${version}: ${label} ${result.error ?? ''}`);
}
report.ok = versions.every((v) => report.versions[v].ok === true);
report.blocked = versions.filter((v) => report.versions[v].blocked === true);

const outDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'node-matrix.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`report written to ${path.join(outDir, 'node-matrix.json')}`);
if (!report.ok) console.error(`artifacts kept at ${base}`);
