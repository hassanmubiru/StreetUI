#!/usr/bin/env node
/**
 * M12.2 — Starter template audit. Scaffolds every public CLI template with the
 * real createProject implementation, wires the workspace packages, then runs
 * TypeScript checking and a production build for each. No workspace aliases in
 * the generated project beyond dependency wiring (the audit targets template
 * source correctness, not the published CLI).
 *
 * Usage: node scripts/toolchain-template-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const cli = await import(path.join(repo, 'packages', 'cli', 'dist', 'index.js'));
const logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };

const templates = ['basic', 'ssr', 'counter', 'todo', 'form', 'routing', 'signals', 'components', 'data-fetching', 'interactive'];
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-template-audit-'));
const report = { schema: 'streetui-template-audit/v1', created: new Date().toISOString(), templates: {}, ok: true };

async function wireDependencies(projectRoot) {
  const { mkdir, symlink } = await import('node:fs/promises');
  const scoped = path.join(projectRoot, 'node_modules', '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler', 'cli']) {
    await symlink(path.join(repo, 'packages', pkg), path.join(scoped, pkg), 'dir');
  }
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
}

for (const template of templates) {
  const app = path.join(base, template);
  const result = { created: false, typecheck: false, build: false, notes: [] };
  try {
    await cli.createProject({ targetDir: app, template, frameworkVersion: '3.2.1', logger });
    result.created = true;
    await wireDependencies(app);
    const tsc = path.join(repo, 'node_modules', 'typescript', 'bin', 'tsc');
    try {
      run(process.execPath, [tsc, '--noEmit', '-p', 'tsconfig.json'], app);
      result.typecheck = true;
    } catch (error) {
      result.notes.push(`typecheck: ${String(error.stdout ?? error.message).split('\n').slice(0, 3).join(' | ')}`);
    }
    try {
      run(process.execPath, [path.join(repo, 'packages', 'cli', 'dist', 'bin.js'), 'build'], app);
      result.build = true;
    } catch (error) {
      result.notes.push(`build: ${String(error.stdout ?? error.message).split('\n').slice(0, 3).join(' | ')}`);
    }
  } catch (error) {
    result.notes.push(`create: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  }
  result.ok = result.created && result.typecheck && result.build;
  report.templates[template] = result;
  if (!result.ok) report.ok = false;
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${template} ${result.notes.join(' | ')}`);
}

const outDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'template-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`audit artifacts: ${base}`);
if (!report.ok) process.exitCode = 1;
else fs.rmSync(base, { recursive: true, force: true });
