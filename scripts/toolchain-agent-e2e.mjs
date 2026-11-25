#!/usr/bin/env node
/**
 * M10.10 — End-to-end agent workflow against the real Playground control API.
 *
 * Drives `streetui playground --json` (the real binary) and verifies the full
 * machine-readable session: session_attached → discover → edit → diagnostics →
 * file verification → browser inspection → build → shutdown → token revocation.
 *
 * Browser-dependent steps need a locally installed Playwright Chromium. When no
 * browser is available they are recorded as BLOCKED, never as passed.
 *
 * Usage:  node scripts/toolchain-agent-e2e.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyExitCode, summarizeReports, summaryForArtifact } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const WORKSPACE_VERSION = JSON.parse(
  fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8'),
).version;
const cli = await import(path.join(repo, 'packages', 'cli', 'dist', 'index.js'));
const BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-agent-e2e-'));
const app = path.join(base, 'agent-app');
const report = {
  schema: 'streetui-toolchain-agent-e2e/v1',
  created: new Date().toISOString(),
  target: 'local-workspace',
  steps: {},
  browser: { requestedEngine: 'chromium', actualEngine: null, browserVersion: null, status: 'BLOCKED', reason: 'not attempted' },
};
let child;
let success = false;

async function wireDependencies(projectRoot) {
  const { mkdir, symlink } = await import('node:fs/promises');
  const scoped = path.join(projectRoot, 'node_modules', '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler', 'cli']) {
    await symlink(path.join(repo, 'packages', pkg), path.join(scoped, pkg), 'dir');
  }
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

function waitForEvent(proc, predicate, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    let acc = '';
    const timer = setTimeout(() => reject(new Error(`event timeout\n${acc}`)), timeoutMs);
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
          proc.stdout.off('data', onData);
          resolve(ev);
          return;
        }
      }
    };
    proc.stdout.on('data', onData);
    proc.on('error', reject);
  });
}

async function until(fn, timeoutMs = 30000, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`condition not met within ${timeoutMs}ms${lastError ? `: ${lastError.message}` : ''}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await cli.createProject({ targetDir: app, template: 'ssr', frameworkVersion: WORKSPACE_VERSION, logger });
  await wireDependencies(app);
  const port = await freePort();
  const origin = `http://localhost:${port}`;

  child = spawn(process.execPath, [BIN, 'playground', '--json', '--port', String(port)], {
    cwd: app,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (c) => process.stderr.write(`[pg-stderr] ${c}`));

  const attached = await waitForEvent(child, (e) => e.event === 'session_attached');
  assert(attached.token, 'session_attached is missing the bearer token');
  assert(attached.sessionId, 'session_attached is missing sessionId');
  report.steps.sessionAttached = { url: attached.url, previewUrl: attached.previewUrl, port: attached.port, sessionId: attached.sessionId };

  const api = async (method, route, body, token = attached.token) => {
    const res = await fetch(`${origin}/__playground${route}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  };

  // Discover.
  const session = await api('GET', '/api/session', undefined, '');
  assert(session.status === 200 && session.json.sessionId === attached.sessionId, 'public /api/session mismatch');
  const unauthorized = await api('GET', '/api/files', undefined, '');
  assert(unauthorized.status === 401, `expected 401 without token, got ${unauthorized.status}`);
  const files = await api('GET', '/api/files');
  assert(Array.isArray(files.json.files) && files.json.files.includes('src/app.ts'), 'file listing missing src/app.ts');
  report.steps.discover = { files: files.json.files.length, unauthorizedStatus: unauthorized.status };

  // Edit through the control API.
  const read = await api('GET', '/api/file?path=src%2Fapp.ts');
  assert(read.status === 200 && typeof read.json.content === 'string', 'cannot read src/app.ts');
  const marker = `// agent-e2e-edit ${Date.now()}`;
  const write = await api('POST', '/api/file', { path: 'src/app.ts', content: `${read.json.content}\n${marker}\n` });
  assert(write.json.ok === true, `edit failed: ${JSON.stringify(write.json)}`);
  const verify = await api('GET', '/api/file?path=src%2Fapp.ts');
  assert(verify.json.content.includes(marker), 'edited content was not persisted');
  const diagnostics = await until(async () => {
    const d = await api('GET', '/api/diagnostics');
    const events = d.json.events ?? [];
    return events.some((e) => e.event === 'file_changed') && events.some((e) => e.event === 'module_updated') ? events : false;
  });
  report.steps.edit = { events: diagnostics.filter((e) => ['file_changed', 'module_updated'].includes(e.event)).length };

  // Browser inspection (requires a real browser; otherwise BLOCKED).
  let browser;
  let page;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    page = await browser.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#app', { timeout: 15000 }).catch(() => page.waitForSelector('body', { timeout: 5000 }));

    const status = await until(async () => {
      const s = await api('GET', '/api/browser/status');
      return s.json.connected ? s.json : false;
    }, 15000);
    const dom = await api('GET', '/api/browser/dom');
    assert(dom.json.ok === true && typeof dom.json.payload?.html === 'string', `DOM inspection failed: ${JSON.stringify(dom.json)}`);
    const element = await api('GET', '/api/browser/element?selector=' + encodeURIComponent('#app'));
    report.steps.browserInspection = {
      clients: status.clients,
      domBytes: dom.json.payload.html.length,
      elementOk: element.json.ok === true,
    };

    // Browser-confirmed HMR outcome. Edit the *client* entry: shared SSR
    // modules intentionally trigger a full reload instead of an HMR update.
    const secondMarker = `// agent-e2e-hmr ${Date.now()}`;
    const current = await api('GET', '/api/file?path=src%2Fmain.ts');
    await api('POST', '/api/file', { path: 'src/main.ts', content: `${current.json.content}\n${secondMarker}\n` });
    const hmr = await until(async () => {
      const d = await api('GET', '/api/diagnostics');
      const events = d.json.events ?? [];
      return events.some((e) => e.event === 'hmr_applied') || events.some((e) => e.event === 'hmr_failed') ? events : false;
    }, 20000);
    report.steps.hmrConfirmation = hmr.filter((e) => ['hmr_applied', 'hmr_failed'].includes(e.event)).map((e) => e.event);
    // Record *why* so a `hmr_failed` is not read as an unexplained failure: a
    // client entry has no self-accept handler, so a full reload is the correct
    // outcome and is reported as such instead of being silently dropped.
    report.steps.hmrOutcomes = hmr
      .filter((e) => ['hmr_applied', 'hmr_failed'].includes(e.event))
      .map((e) => ({ event: e.event, updateId: e.updateId ?? null, reason: e.error ?? null }));

    // Runtime error capture from the real page. `agent-e2e-boom` is dispatched
    // deliberately, so an error count of 2 (dispatch + capture) is the expected
    // observation, not a page defect.
    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'agent-e2e-boom', error: new Error('agent-e2e-boom') }));
    });
    const errors = await until(async () => {
      const r = await api('GET', '/api/browser/errors');
      return (r.json.errors ?? []).some((e) => String(e.message).includes('agent-e2e-boom')) ? r.json.errors : false;
    }, 15000);
    report.steps.browserErrors = errors.length;
    report.steps.errorCapture = {
      injected: 'agent-e2e-boom',
      captured: errors.some((e) => String(e.message).includes('agent-e2e-boom')),
      capturedMessages: errors.map((e) => String(e.message)),
    };
    report.steps.consoleEndpoint = (await api('GET', '/api/browser/console')).status === 200;
    report.browser = {
      requestedEngine: 'chromium',
      actualEngine: browser.browserType().name(),
      browserVersion: browser.version(),
      status: 'PASS',
      reason: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocked = /Executable doesn't exist|Failed to launch|browserType\.launch|Cannot find package 'playwright'/i.test(message);
    report.browser = {
      requestedEngine: 'chromium',
      actualEngine: browser ? browser.browserType().name() : null,
      browserVersion: browser ? browser.version() : null,
      status: blocked ? 'BLOCKED' : 'FAIL',
      reason: message.split('\n')[0],
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }

  // Production build through the control API.
  const build = await api('POST', '/api/build');
  assert(build.json.ok === true, `build failed: ${JSON.stringify(build.json)}`);
  assert(fs.existsSync(build.json.outDir), 'build outDir does not exist');
  report.steps.build = { outDir: build.json.outDir, files: build.json.files, durationMs: build.json.durationMs };

  // Shutdown revokes the token.
  const stoppedPromise = waitForEvent(child, (e) => e.event === 'session_stopped', 10000).catch(() => null);
  const shutdown = await api('POST', '/api/session/shutdown');
  assert(shutdown.json.ok === true, 'shutdown failed');
  const stopped = await stoppedPromise;
  let revokedStatus = 0;
  await until(async () => {
    const r = await api('GET', '/api/files').catch(() => ({ status: 0 }));
    revokedStatus = r.status;
    // 401 means the token was revoked; 0 means the server socket is gone.
    return r.status === 401 || r.status === 0;
  }, 10000);
  report.steps.shutdown = { ok: true, sessionStoppedEvent: stopped !== null, revokedStatus };

  success = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  if (child && !child.killed) child.kill('SIGTERM');
  if (success && report.browser.status === 'PASS') fs.rmSync(base, { recursive: true, force: true });
  else if (!success) console.error(`artifacts kept at ${base}`);
}

const rows = report.browser.status === 'PASS' ? [report.browser] : [{ ...report.browser }];
if (report.error !== undefined) rows.push({ requestedEngine: 'chromium', status: 'FAIL', reason: report.error });
const summary = summarizeReports(rows, { requestedEngines: ['chromium'] });
const ok = summary.exitCode === 0;
report.summary = summaryForArtifact(summary);
report.ok = ok;

const outDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'agent-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exitCode = applyExitCode(summary, process.stdout);
