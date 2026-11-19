#!/usr/bin/env node
/**
 * M8.4 — Real AI-agent workflow exercised through the actual CLI.
 *
 * Drives `streetui dev --json` and `streetui build --json` as a subprocess (the
 * real binary, not a simulated harness) and verifies the documented event
 * contract: project_detected → preview_ready (with url/port/status/version) →
 * file_changed / module_updated → build_completed. It does not claim any host
 * platform can display the preview; it only proves the CLI exposes a real URL.
 *
 * Usage:  node scripts/toolchain-agent-workflow.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
process.chdir(path.join(repo, 'packages', 'cli'));
const cli = await import(path.join(repo, 'packages', 'cli', 'dist', 'index.js'));
const BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-agent-'));
const app = path.join(base, 'agent-app');

async function wireDependencies(projectRoot) {
  const { mkdir, symlink } = await import('node:fs/promises');
  const mods = path.join(projectRoot, 'node_modules');
  const scoped = path.join(mods, '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler', 'cli']) {
    await symlink(path.join(repo, 'packages', pkg), path.join(scoped, pkg), 'dir');
  }
}

function waitForEvent(child, predicate, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    let acc = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`event timeout\n${acc}`));
    }, timeoutMs);
    const onData = (chunk) => {
      acc += chunk.toString();
      const lines = acc.split('\n');
      acc = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (predicate(ev)) {
          clearTimeout(timer);
          child.stdout.off('data', onData);
          resolve(ev);
          return;
        }
      }
    };
    child.stdout.on('data', onData);
    child.on('error', reject);
  });
}

function spawnCli(args) {
  const child = spawn(process.execPath, [BIN, ...args], {
    cwd: app,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (c) => process.stderr.write(`[cli-stderr] ${c}`));
  return child;
}

try {
  await cli.createProject({ targetDir: app, template: 'ssr', frameworkVersion: '3.1.0', logger });
  await wireDependencies(app);

  const report = { schema: 'streetui-toolchain-agent/v1', created: new Date().toISOString(), steps: {} };

  // 1. Start dev server on an explicit port and confirm the event contract.
  const dev = spawnCli(['dev', '--json', '--port', '3417']);
  const devEvents = [];
  let devAcc = '';
  dev.stdout.on('data', (c) => {
    devAcc += c.toString();
    const lines = devAcc.split('\n');
    devAcc = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        devEvents.push(JSON.parse(line));
      } catch {
        /* ignore */
      }
    }
  });
  const ready = await waitForEvent(dev, (e) => e.event === 'preview_ready');
  if (!ready.url || !ready.port || ready.status !== 'ready' || !ready.version) {
    throw new Error(`malformed preview_ready: ${JSON.stringify(ready)}`);
  }
  report.steps.devReady = ready;
  report.steps.devUrl = ready.url;

  // 2. Detect project detection events.
  const hasDetected = devEvents.some((e) => e.event === 'project_detected' && e.version);
  const hasEnv = devEvents.some((e) => e.event === 'environment_checked');
  report.steps.detected = hasDetected;
  report.steps.environmentChecked = hasEnv;
  if (!hasDetected) throw new Error('missing project_detected event');

  // 3. Modify the app; a module_updated or file_changed event should surface.
  const changed = waitForEvent(dev, (e) => e.event === 'file_changed' || e.event === 'module_updated', 20000);
  const appTs = path.join(app, 'src', 'app.ts');
  const original = fs.readFileSync(appTs, 'utf8');
  fs.writeFileSync(appTs, `${original}\n// agent-edit ${Date.now()}\n`);
  const changeEv = await changed;
  report.steps.changeEvent = changeEv;

  dev.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 400));

  // 4. Production build reports build_completed.
  const out = execFileSync(process.execPath, [BIN, 'build', '--json'], { cwd: app, encoding: 'utf8' });
  const buildEvents = out.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter((e) => e && e.event);
  const completed = buildEvents.find((e) => e.event === 'build_completed');
  if (!completed) throw new Error('build output missing build_completed');
  report.steps.buildCompleted = completed;

  const resultsDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, 'agent-workflow.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`AGENT WORKFLOW PASSED — dev URL ${ready.url}, build_completed files=${completed.files}\n`);
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}
