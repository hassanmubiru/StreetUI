#!/usr/bin/env node
/**
 * M11.10 — Visual browser verification and agent automation acceptance test.
 *
 * Drives the real `streetui playground --json` and the M11 automation provider
 * against a real StreetUI counter application in Chromium and Firefox:
 * connection, inspection, real PNG screenshots (signature + IHDR dimensions),
 * interactions, successful and failed HMR, SSR reload semantics, runtime error
 * capture and recovery, multi-client targeting, production build, shutdown,
 * token revocation, and screenshot/process cleanup.
 *
 * Engines that cannot launch are recorded as BLOCKED, never as passed.
 *
 * Usage:  node scripts/toolchain-agent-visual-e2e.mjs [--engines chromium,firefox,webkit]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertNoUnknownSelectionFlags, enginesFromArgv } from './lib/browser-engines.mjs';
import { applyExitCode, summarizeReports, summaryForArtifact } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const WORKSPACE_VERSION = JSON.parse(
  fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8'),
).version;
const cli = await import(path.join(repo, 'packages', 'cli', 'dist', 'index.js'));
const BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };

assertNoUnknownSelectionFlags();
const enginesArg = enginesFromArgv();

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-visual-e2e-'));
const report = { schema: 'streetui-agent-visual-e2e/v1', created: new Date().toISOString(), target: 'local-workspace', engines: {}, ok: false };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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

async function until(fn, timeoutMs = 25000, intervalMs = 250) {
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

async function runEngine(engine) {
  const app = path.join(base, `app-${engine}`);
  const steps = {};
  await cli.createProject({ targetDir: app, template: 'counter', frameworkVersion: WORKSPACE_VERSION, logger });
  await wireDependencies(app);
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const child = spawn(process.execPath, [BIN, 'playground', '--json', '--port', String(port)], {
    cwd: app,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (c) => process.stderr.write(`[pg-${engine}] ${c}`));
  let sessionId = '';

  try {
    const attached = await waitForEvent(child, (e) => e.event === 'session_attached');
    sessionId = attached.sessionId;
    const token = attached.token;
    const api = async (method, route, body, auth = token) => {
      const res = await fetch(`${origin}/__playground${route}`, {
        method,
        headers: {
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
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
    const interact = (operation, extra = {}) => api('POST', '/api/browser/interact', { operation, ...extra });
    const inspectText = async (selector) => {
      const r = await api('GET', `/api/browser/inspect?selector=${encodeURIComponent(selector)}`);
      return r.json.inspection?.elements?.[0]?.text ?? '';
    };
    const events = async () => (await api('GET', '/api/diagnostics')).json.events ?? [];
    const countEvents = (predicate, list) => list.filter(predicate).length;

    // Automation is optional but must fail precisely when not connected.
    const noAuto = await api('POST', '/api/browser/screenshot', {});
    assert(noAuto.status === 503 && noAuto.json.error.code === 'E_AUTOMATION_UNAVAILABLE', 'expected E_AUTOMATION_UNAVAILABLE before connect');

    const conn = await api('POST', '/api/browser/automation/connect', { engine, viewport: { width: 900, height: 600 } });
    assert(conn.json.ok === true && conn.json.connected === true, `automation connect failed: ${JSON.stringify(conn.json)}`);
    assert(conn.json.engine === engine, `requested ${engine} but automation connected ${conn.json.engine}`);
    const userAgent = await interact('evaluate', { expression: 'navigator.userAgent' });
    steps.connect = { engine: conn.json.engine, url: conn.json.url, userAgent: userAgent.json.value };

    await until(async () => {
      const ev = await events();
      return ev.some((e) => e.event === 'browser_connected' && e.clientId === 'automation') && ev.some((e) => e.event === 'session_ready') ? ev : false;
    });
    const lifecycleEvents = await events();
    assert(countEvents((e) => e.event === 'session_ready', lifecycleEvents) === 1, 'session_ready must be emitted exactly once');
    assert(lifecycleEvents.every((e) => typeof e.sessionId === 'string' && e.sessionId.length > 0), 'empty sessionId detected');
    steps.lifecycle = ['session_ready', 'browser_connected'];

    await interact('waitForSelector', { selector: '#increment', timeoutMs: 20000 });
    await interact('waitForStable', { timeoutMs: 15000 });

    // Real interactions.
    await interact('click', { selector: '#increment' });
    await interact('click', { selector: '#increment' });
    assert((await inspectText('#count-display')).includes('Count: 2'), 'count should be 2 after two clicks');
    await interact('fill', { selector: '#step-input', value: '3' });
    await interact('click', { selector: '#increment' });
    assert((await inspectText('#count-display')).includes('Count: 5'), 'count should be 5 after step=3');
    await interact('scroll', { y: 0 });
    await interact('press', { key: 'Tab' });
    const bad = await interact('click', { selector: '#does-not-exist', timeoutMs: 1500 });
    assert(bad.json.ok === false && bad.json.error.code === 'E_ELEMENT_NOT_FOUND', `missing element: ${JSON.stringify(bad.json)}`);
    steps.interactions = ['click', 'fill', 'scroll', 'press', 'waitForSelector', 'waitForStable'];
    steps.interactionError = bad.json.error.code;

    // Real screenshots: metadata + binary signature + IHDR dimensions.
    const shot = await api('POST', '/api/browser/screenshot', { fullPage: false });
    const meta = shot.json.screenshot;
    assert(shot.json.ok === true && meta.format === 'png', 'screenshot did not succeed');
    assert(meta.width === 900 && meta.height === 600, `unexpected viewport dimensions: ${meta.width}x${meta.height}`);
    const image = await fetch(`${origin}${meta.url}`, { headers: { Authorization: `Bearer ${token}` } });
    assert(image.status === 200 && image.headers.get('content-type') === 'image/png', 'screenshot retrieval failed');
    const bytes = Buffer.from(await image.arrayBuffer());
    assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'invalid PNG signature');
    assert(bytes.readUInt32BE(16) === meta.width && bytes.readUInt32BE(20) === meta.height, 'IHDR dimensions do not match metadata');
    assert(bytes.length === meta.bytes, 'PNG byte count mismatch');
    const full = await api('POST', '/api/browser/screenshot', { fullPage: true, viewport: { width: 800, height: 500 } });
    assert(full.json.screenshot.width === 800 && full.json.screenshot.height >= 500, 'full-page screenshot dimensions wrong');
    const badId = await api('GET', '/api/browser/screenshot/not-a-real-id');
    assert(badId.status === 404, 'invalid screenshot id must be 404');
    steps.screenshots = [
      { width: meta.width, height: meta.height, bytes: meta.bytes, fullPage: false },
      { width: full.json.screenshot.width, height: full.json.screenshot.height, fullPage: true },
    ];

    // Structured visual inspection.
    const insp = await api('GET', '/api/browser/inspect?limit=25&maxText=1500');
    const i = insp.json.inspection;
    assert(i && i.url.startsWith('http'), 'inspection missing url');
    assert(typeof i.title === 'string' && i.route === '/', 'inspection missing title/route');
    assert(i.viewport.width === 800, 'inspection viewport mismatch');
    assert(i.document.width > 0 && i.document.height > 0, 'inspection document dimensions missing');
    assert(i.elements.length <= 25 && i.visibleText.length <= 1500, 'inspection limits not respected');
    assert(i.appRootEmpty === false, 'app root unexpectedly empty');
    assert(i.screenshotId === full.json.screenshot.id, 'inspection screenshot reference mismatch');
    assert(Array.isArray(i.diagnostics), 'inspection diagnostics missing');
    await until(async () => (await events()).some((e) => e.event === 'preview_inspected'));
    steps.inspection = { elements: i.elementCount, route: i.route, screenshotRef: true };

    // Successful HMR on a CSS module (accepted by design).
    const cssPath = path.join(app, 'src', 'agent-visual.css');
    const mainTs = path.join(app, 'src', 'main.ts');
    fs.writeFileSync(cssPath, 'body { background-color: rgb(255, 255, 255); }\n');
    await interact('evaluate', { expression: '(window.__preHmr = true)' });
    fs.appendFileSync(mainTs, "\nimport './agent-visual.css';\n");
    await until(async () => (await events()).some((e) => e.event === 'hmr_failed'), 30000);
    // The no-accept edit forces a full reload; wait for the *new* document.
    await until(async () => (await interact('evaluate', { expression: 'typeof window.__preHmr' })).json.value === 'undefined', 30000);
    await interact('waitForSelector', { selector: '#increment', timeoutMs: 20000 });
    await until(async () => (await interact('evaluate', { expression: "document.querySelector('style[data-streetui-css]') !== null" })).json.value === true, 15000);
    // The setup edit reloaded the page; establish fresh state to preserve.
    await interact('click', { selector: '#increment' });
    await interact('click', { selector: '#increment' });
    assert((await inspectText('#count-display')).includes('Count: 2'), 'could not establish counter state after reload');
    // Creating the CSS file already produced an hmr_applied; require a NEW one.
    const cssAppliedBefore = countEvents((e) => e.event === 'hmr_applied' && String(e.file).endsWith('agent-visual.css'), await events());
    fs.writeFileSync(cssPath, 'body { background-color: rgb(1, 2, 3); }\n');
    await until(async () => countEvents((e) => e.event === 'hmr_applied' && String(e.file).endsWith('agent-visual.css'), await events()) > cssAppliedBefore, 30000);
    const color = await interact('evaluate', { expression: 'getComputedStyle(document.body).backgroundColor' });
    assert(color.json.value === 'rgb(1, 2, 3)', `CSS HMR not visible: ${JSON.stringify(color.json)}`);
    assert((await inspectText('#count-display')).includes('Count: 2'), 'state was not preserved across CSS HMR');
    steps.hmrApplied = { background: color.json.value, statePreserved: true };

    // Failed HMR on a module without an accept handler → full reload.
    const failedBefore = countEvents((e) => e.event === 'hmr_failed', await events());
    await interact('evaluate', { expression: '(window.__preHmrFail = true)' });
    fs.appendFileSync(mainTs, '// agent-visual-fail\n');
    await until(async () => countEvents((e) => e.event === 'hmr_failed', await events()) > failedBefore, 30000);
    await until(async () => (await interact('evaluate', { expression: 'typeof window.__preHmrFail' })).json.value === 'undefined', 30000);
    await interact('waitForSelector', { selector: '#increment', timeoutMs: 20000 });
    assert((await inspectText('#count-display')).includes('Count: 0'), 'full reload should reset counter state');
    steps.hmrFailed = { fullReload: true, stateReset: true };

    // SSR graph change: documented reload, never a client hmr_applied.
    await interact('evaluate', { expression: '(window.__ssrMarker = "set")' });
    fs.appendFileSync(path.join(app, 'src', 'app.ts'), '// agent-visual-ssr\n');
    await until(async () => {
      const r = await interact('evaluate', { expression: 'typeof window.__ssrMarker' });
      return r.json.value === 'undefined';
    }, 30000);
    const ssrHmr = (await events()).filter((e) => e.event === 'hmr_applied' && String(e.file).endsWith('/app.ts'));
    assert(ssrHmr.length === 0, 'SSR reload must not be reported as client hmr_applied');
    steps.ssrReload = { markerCleared: true, noClientHmr: true };

    // Real uncaught exception → captured diagnostics; then recover via HMR.
    await interact('evaluate', { expression: 'setTimeout(() => { throw new Error("agent-visual-boom"); }, 0)' });
    await until(async () => {
      const errs = await api('GET', '/api/browser/errors?clientId=automation');
      return (errs.json.errors ?? []).some((e) => String(e.message).includes('agent-visual-boom'));
    }, 20000);
    const errInsp = await api('GET', '/api/browser/inspect');
    assert(errInsp.json.inspection.runtimeErrorCount >= 1, 'runtime error count not reported');
    assert(errInsp.json.inspection.diagnostics.some((d) => d.code === 'E_PAGE_ERROR'), 'E_PAGE_ERROR diagnostic missing');
    const appliedBefore = countEvents((e) => e.event === 'hmr_applied', await events());
    fs.writeFileSync(cssPath, 'body { background-color: rgb(4, 5, 6); }\n');
    await until(async () => countEvents((e) => e.event === 'hmr_applied', await events()) > appliedBefore, 30000);
    const recovered = await interact('evaluate', { expression: 'getComputedStyle(document.body).backgroundColor' });
    assert(recovered.json.value === 'rgb(4, 5, 6)', 'recovery CSS not applied');
    steps.runtimeError = { captured: true, recovered: true };

    // Multi-client targeting.
    await interact('evaluate', { expression: '(window.open(location.href, "_blank"), true)' });
    const clients = await until(async () => {
      const c = await api('GET', '/api/browser/clients');
      return (c.json.clients ?? []).filter((x) => x.kind === 'hmr').length >= 2 ? c.json.clients : false;
    }, 20000);
    const hmrIds = clients.filter((c) => c.kind === 'hmr').map((c) => c.id);
    const needTarget = await api('GET', '/api/browser/dom');
    assert(needTarget.status === 400 && needTarget.json.error.code === 'E_CLIENT_REQUIRED', `expected E_CLIENT_REQUIRED: ${JSON.stringify(needTarget.json)}`);
    const unknown = await api('GET', '/api/browser/dom?clientId=c999');
    assert(unknown.status === 404 && unknown.json.error.code === 'E_CLIENT_NOT_FOUND', 'unknown client must be E_CLIENT_NOT_FOUND');
    const targeted = await api('GET', `/api/browser/dom?clientId=${encodeURIComponent(hmrIds[0])}`);
    assert(targeted.json.ok === true && targeted.json.clientId === hmrIds[0], 'targeted DOM inspection failed');
    const perClient = await api('GET', `/api/browser/console?clientId=${encodeURIComponent(hmrIds[0])}`);
    assert(Array.isArray(perClient.json.messages), 'per-client console retrieval failed');
    const second = hmrIds[1];
    const disc = await api('POST', '/api/browser/disconnect', { clientId: second });
    assert(disc.json.ok === true, `disconnect failed: ${JSON.stringify(disc.json)}`);
    await until(async () => (await events()).some((e) => e.event === 'browser_disconnected' && e.clientId === second), 15000);
    steps.multiClient = { clients: clients.length, targetRequired: true, unknownClient: true, disconnected: second };

    // Production build and output verification.
    const build = await api('POST', '/api/build');
    assert(build.json.ok === true, `build failed: ${JSON.stringify(build.json)}`);
    assert(fs.existsSync(build.json.outDir) && fs.existsSync(path.join(build.json.outDir, 'manifest.json')), 'production output missing');
    steps.build = { outDir: build.json.outDir, files: build.json.files };

    // Shutdown: session stop, token revocation, screenshot cleanup.
    const stoppedPromise = waitForEvent(child, (e) => e.event === 'session_stopped', 20000).catch(() => null);
    const shutdown = await api('POST', '/api/session/shutdown');
    assert(shutdown.json.ok === true, 'shutdown failed');
    assert((await stoppedPromise) !== null, 'session_stopped was not observed');
    await until(async () => {
      const r = await api('GET', '/api/files').catch(() => ({ status: 0 }));
      return r.status === 401 || r.status === 0;
    }, 15000);
    const shotsDir = path.join(app, '.streetui-cache', 'screenshots', sessionId);
    await until(() => !fs.existsSync(shotsDir), 15000);
    steps.shutdown = { sessionStopped: true, revoked: true, screenshotsCleaned: true };

    return {
      engine,
      status: 'VERIFIED',
      ok: true,
      requestedEngine: engine,
      actualEngine: steps.connect.engine,
      // The Playground automation provider reports the launched engine but not
      // its version; the real user agent is recorded instead of guessing one.
      browserVersion: null,
      browserUserAgent: steps.connect.userAgent,
      requestedMode: 'dev',
      actualMode: 'dev',
      steps,
    };
  } finally {
    if (!child.killed) child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
  }
}

for (const engine of enginesArg) {
  try {
    report.engines[engine] = await runEngine(engine);
    console.log(`${engine}: VERIFIED`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocked = /E_AUTOMATION_UNAVAILABLE|Failed to launch|browserType\.launch|Executable doesn't exist/i.test(message);
    report.engines[engine] = {
      engine,
      status: blocked ? 'BLOCKED' : 'FAIL',
      ok: false,
      requestedEngine: engine,
      actualEngine: null,
      browserVersion: null,
      requestedMode: 'dev',
      actualMode: null,
      error: message,
      reason: message.split('\n')[0],
    };
    console.log(`${engine}: ${blocked ? 'BLOCKED' : 'FAIL'} — ${message.split('\n')[0]}`);
  }
}

const summary = summarizeReports(Object.values(report.engines), {
  requestedEngines: enginesArg,
  requestedModes: ['dev'],
});
report.ok = summary.exitCode === 0;
report.summary = summaryForArtifact(summary);

const outDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'agent-visual-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exitCode = applyExitCode(summary, process.stdout);
if (report.ok) fs.rmSync(base, { recursive: true, force: true });
else console.error(`artifacts kept at ${base}`);
