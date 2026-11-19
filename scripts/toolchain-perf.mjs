/**
 * StreetUI toolchain performance measurements.
 *
 *   node scripts/toolchain-perf.mjs
 *
 * Writes real numbers — startup time, transformed module counts, build time —
 * for a freshly scaffolded app. No claims are made without a measurement.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
// The built CLI finds its templates relative to the working directory.
process.chdir(path.join(repo, 'packages', 'cli'));
const cliEntry = path.join(repo, 'packages', 'cli', 'dist', 'index.js');
const { createProject, resolveProject, buildProject, createDevServer } = await import(cliEntry);

const noopLogger = () => ({ info() {}, success() {}, warn() {}, error() {}, plain() {} });

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-perf-'));
const projectRoot = path.join(base, 'app');
const logger = noopLogger();

const report = { schema: 'streetui-toolchain-perf/v1', created: new Date().toISOString() };

try {
  const { mkdir, symlink } = await import('node:fs/promises');
  const t0 = performance.now();
  await createProject({ targetDir: projectRoot, template: 'ssr', frameworkVersion: '3.1.0', logger });
  report.createMs = Math.round(performance.now() - t0);

  const modules = path.join(projectRoot, 'node_modules');
  const scoped = path.join(modules, '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler', 'cli']) {
    await symlink(path.join(repo, 'packages', pkg), path.join(scoped, pkg), 'dir');
  }

  const project = await resolveProject(projectRoot, { requireEntry: true });

  const t1 = performance.now();
  const dev = await createDevServer({ project, logger });
  report.devStartupMs = Math.round(performance.now() - t1);
  await dev.stop();

  const t2 = performance.now();
  const out = await buildProject(project, 'production', { logger });
  report.buildMs = Math.round(performance.now() - t2);
  report.buildFiles = out.fileCount;
  report.buildDurationMs = out.durationMs;
} catch (error) {
  report.status = 'ERROR';
  report.reason = String(error && error.message || error);
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

const outFile = path.join(repo, 'benchmarks', 'results', 'toolchain', 'perf.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`toolchain-perf: wrote ${outFile}\n`);