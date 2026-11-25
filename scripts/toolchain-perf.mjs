/**
 * StreetUI toolchain performance measurements.
 *
 *   node scripts/toolchain-perf.mjs [--warmup 5] [--samples 20]
 *
 * Writes real, sampled numbers — project creation, dev server cold start, HMR
 * update propagation, and production build — for a freshly scaffolded app. No
 * claim is made without a measurement.
 *
 * Methodology (kept explicit so runs stay comparable):
 *   - create:            fresh target directory + fresh process per observation;
 *   - cold dev startup:  fresh server per observation (no OS cache claims);
 *   - warm HMR:          one running server, `--warmup` discarded observations;
 *   - warm build:        one prepared project, `--warmup` discarded observations;
 *   - warm SSR response: one running server, `--warmup` discarded observations.
 *
 * Every raw observation is preserved in the artifact alongside the summary, so
 * a reader can recompute count/min/max/mean/median/variance/stddev/p95.
 * Cold and warm phases are never averaged together.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseSamplingArgs, summarizeSamples } from './lib/perf-stats.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
// The built CLI finds its templates relative to the working directory.
process.chdir(path.join(repo, 'packages', 'cli'));
const cliEntry = path.join(repo, 'packages', 'cli', 'dist', 'index.js');
const { createProject, resolveProject, buildProject, createDevServer } = await import(cliEntry);

const sampling = parseSamplingArgs();

const noopLogger = () => ({ info() {}, success() {}, warn() {}, error() {}, plain() {} });
const logger = noopLogger();

const WORKSPACE_VERSION = JSON.parse(
  fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8'),
).version;

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-perf-'));

const report = {
  schema: 'streetui-toolchain-perf/v2',
  created: new Date().toISOString(),
  evidenceTarget: 'local-workspace',
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  workload: {
    template: 'ssr',
    frameworkVersion: WORKSPACE_VERSION,
    warmup: sampling.warmup,
    samples: sampling.samples,
    note: 'No engine or mode averaging; cold and warm phases are reported separately.',
  },
};

async function scaffold(targetDir) {
  const { mkdir, symlink } = await import('node:fs/promises');
  await createProject({ targetDir, template: 'ssr', frameworkVersion: WORKSPACE_VERSION, logger });
  const modules = path.join(targetDir, 'node_modules');
  const scoped = path.join(modules, '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler', 'cli']) {
    await symlink(path.join(repo, 'packages', pkg), path.join(scoped, pkg), 'dir');
  }
  return resolveProject(targetDir, { requireEntry: true });
}

function makeEventSink(updates) {
  return {
    emit(event) {
      if (event.event === 'module_updated') updates.push({ at: performance.now(), file: event.id });
    },
    send() {},
  };
}

async function measureColdStart(project, index) {
  const updates = [];
  const started = performance.now();
  const dev = await createDevServer({ project, logger, events: makeEventSink(updates) });
  try {
    const res = await fetch(dev.url, { headers: { accept: 'text/html' } });
    const html = await res.text();
    if (!res.ok || html.length === 0) throw new Error(`dev server returned ${res.status}`);
    return { startupMs: performance.now() - started, bytes: html.length, dev };
  } catch (error) {
    await dev.stop().catch(() => undefined);
    throw error;
  }
}

async function measureHmr(project, observations) {
  const { readFile, writeFile } = await import('node:fs/promises');
  const updates = [];
  const dev = await createDevServer({ project, logger, events: makeEventSink(updates) });
  try {
    // Warm the server before timing.
    await (await fetch(dev.url, { headers: { accept: 'text/html' } })).text();
    const entry = path.join(project.root, 'src', 'main.ts');
    const original = await readFile(entry, 'utf8');
    const total = observations.warmup + observations.samples;
    const samples = [];
    try {
      for (let i = 0; i < total; i += 1) {
        const before = updates.length;
        const started = performance.now();
        await writeFile(entry, `${original}\n// perf-edit-${String(i + 1)}\n`, 'utf8');
        const deadline = started + 15000;
        while (updates.length === before && performance.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        const seen = updates.length > before ? updates[updates.length - 1] : undefined;
        if (seen === undefined) throw new Error('dev server did not report a module update within 15s');
        const elapsed = seen.at - started;
        if (i >= observations.warmup) samples.push(elapsed);
      }
    } finally {
      await writeFile(entry, original, 'utf8');
    }
    return samples;
  } finally {
    await dev.stop();
  }
}

async function measureWarmSsr(project, observations) {
  const dev = await createDevServer({ project, logger });
  try {
    // Discard warmups, then time each response.
    for (let i = 0; i < observations.warmup; i += 1) await (await fetch(dev.url, { headers: { accept: 'text/html' } })).text();
    const samples = [];
    for (let i = 0; i < observations.samples; i += 1) {
      const started = performance.now();
      const res = await fetch(dev.url, { headers: { accept: 'text/html' } });
      const html = await res.text();
      if (!res.ok || html.length === 0) throw new Error(`dev server returned ${res.status}`);
      samples.push(performance.now() - started);
    }
    return samples;
  } finally {
    await dev.stop();
  }
}

async function measureWarmBuild(project, observations) {
  // One prepared project, repeated builds; warmups discarded.
  for (let i = 0; i < observations.warmup; i += 1) await buildProject(project, 'production', { logger });
  const samples = [];
  let last;
  for (let i = 0; i < observations.samples; i += 1) {
    const started = performance.now();
    last = await buildProject(project, 'production', { logger });
    samples.push(performance.now() - started);
  }
  return { samples, files: last?.fileCount, durationMs: last?.durationMs };
}

try {
  // ── create: fresh target per observation ──────────────────────────────────
  const createSamples = [];
  for (let i = 0; i < sampling.warmup + sampling.samples; i += 1) {
    const target = path.join(base, `create-${i}`);
    const started = performance.now();
    await createProject({ targetDir: target, template: 'ssr', frameworkVersion: WORKSPACE_VERSION, logger });
    const elapsed = performance.now() - started;
    if (i >= sampling.warmup) createSamples.push(elapsed);
    fs.rmSync(target, { recursive: true, force: true });
  }
  report.create = summarizeSamples(createSamples);

  const projectRoot = path.join(base, 'app');
  const project = await scaffold(projectRoot);

  // ── cold dev startup: fresh server per observation ────────────────────────
  const coldStartSamples = [];
  let bytes = 0;
  for (let i = 0; i < sampling.warmup + sampling.samples; i += 1) {
    const { startupMs, bytes: responseBytes, dev } = await measureColdStart(project, i);
    await dev.stop();
    bytes = responseBytes;
    if (i >= sampling.warmup) coldStartSamples.push(startupMs);
  }
  report.firstResponseBytes = bytes;
  report.coldDevStartup = summarizeSamples(coldStartSamples);

  // ── warm phases on one prepared project/server ────────────────────────────
  report.warmSsrResponse = summarizeSamples(await measureWarmSsr(project, sampling));
  report.hmrUpdate = summarizeSamples(await measureHmr(project, sampling));

  const build = await measureWarmBuild(project, sampling);
  report.build = summarizeSamples(build.samples);
  report.buildFiles = build.files;
  report.buildDurationMs = build.durationMs;

  report.status = 'OK';
} catch (error) {
  report.status = 'ERROR';
  report.reason = String((error && error.message) || error);
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

const outFile = path.join(repo, 'benchmarks', 'results', 'toolchain', 'perf.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

const line = (name, summary) =>
  summary === undefined || summary.count === 0
    ? `${name}: no samples`
    : `${name}: n=${summary.count} median=${summary.median?.toFixed(1)}ms p95=${summary.p95?.toFixed(1)}ms`;
process.stdout.write(`${line('create', report.create)}\n`);
process.stdout.write(`${line('cold dev startup', report.coldDevStartup)}\n`);
process.stdout.write(`${line('warm SSR response', report.warmSsrResponse)}\n`);
process.stdout.write(`${line('HMR update', report.hmrUpdate)}\n`);
process.stdout.write(`${line('warm build', report.build)}\n`);
process.stdout.write(`toolchain-perf: wrote ${outFile}\n`);
if (report.status !== 'OK') {
  process.stderr.write(`toolchain-perf: ${report.status} — ${report.reason}\n`);
  process.exitCode = 1;
}
