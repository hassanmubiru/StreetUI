#!/usr/bin/env node
/**
 * M13.2 — Full axe-core accessibility audit of the dashboard example.
 *
 * Uses a real production build served by the StreetUI CLI, and axe-core via an
 * isolated dev-only install (never a framework runtime dependency). Reports
 * violations per route and engine, including forms with validation errors,
 * theme toggling, and the 404 fallback. Missing axe-core is BLOCKED, not PASS.
 *
 * Usage: node scripts/toolchain-a11y-axe.mjs [--engines chromium,firefox,webkit]
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  assertNoUnknownSelectionFlags,
  enginesFromArgv,
  launchBrowser,
} from './lib/browser-engines.mjs';
import { applyExitCode, summarizeReports } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const dashboard = path.join(repo, 'examples', 'streetui-dashboard');
const bin = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const outFile = path.join(repo, 'benchmarks', 'results', 'toolchain', 'a11y-axe.json');

/**
 * axe-core is an isolated, dev-only install so it can never become a framework
 * runtime dependency. Its absence is BLOCKED evidence, never a PASS.
 */
function resolveAxeBuilder() {
  for (const root of ['/tmp/streetui-a11y/package.json', path.join(repo, 'package.json')]) {
    try {
      return createRequire(root)('@axe-core/playwright').default;
    } catch {
      /* try the next root */
    }
  }
  return null;
}
const AxeBuilder = resolveAxeBuilder();

assertNoUnknownSelectionFlags();
const enginesArg = enginesFromArgv();

let playwright;
try {
  playwright = await import('playwright');
} catch {
  playwright = undefined;
}

const report = {
  schema: 'streetui-a11y-axe/v1',
  created: new Date().toISOString(),
  target: 'local-workspace',
  requestedEngines: enginesArg,
  requestedMode: 'prod',
  engines: {},
  ok: false,
};

function writeReport() {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
}

function blockedReason() {
  const reasons = [];
  if (AxeBuilder === null) reasons.push('@axe-core/playwright is not installed in an isolated dev-only location.');
  if (playwright === undefined) reasons.push('Playwright is not installed.');
  return reasons.join(' ');
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
async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not respond at ${url}`);
}

async function verifyEngine(engine, origin) {
  const browser = await launchBrowser(playwright, engine, { timeout: 45000 });
  const actualEngine = browser.browserType().name();
  const browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1100, height: 750 } });
  const page = await context.newPage();
  const results = {};
  const audit = async (name, url, prepare) => {
    await page.goto(url, { waitUntil: 'networkidle' });
    if (prepare) await prepare();
    const result = await new AxeBuilder({ page }).analyze();
    results[name] = {
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
      passes: result.passes.length,
      incomplete: result.incomplete.length,
    };
  };
  try {
    await audit('overview', `${origin}/`);
    await audit('users', `${origin}/users`);
    await audit('projects', `${origin}/projects`);
    await audit('settings', `${origin}/settings`);
    await audit('settings-validation-errors', `${origin}/settings`, async () => {
      await page.click('#profile-submit');
      await page.waitForTimeout(300);
    });
    await audit('dark-theme', `${origin}/`, async () => {
      await page.click('#theme-toggle');
    });
    await audit('not-found', `${origin}/does-not-exist`);
    return {
      ok: true,
      status: 'PASS',
      requestedEngine: engine,
      actualEngine,
      browserVersion,
      requestedMode: 'prod',
      actualMode: 'prod',
      results,
    };
  } finally {
    await browser.close();
  }
}

const unavailable = blockedReason();
if (unavailable.length > 0) {
  for (const engine of enginesArg) {
    report.engines[engine] = {
      ok: false,
      status: 'BLOCKED',
      requestedEngine: engine,
      actualEngine: null,
      requestedMode: 'prod',
      actualMode: null,
      reason: unavailable,
    };
  }
  report.blockedReason = unavailable;
  console.log(`a11y-axe: BLOCKED — ${unavailable}`);
} else {
  try {
    execFileSync(bin, ['build'], { cwd: dashboard, stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000 });
    const port = await freePort();
    const origin = `http://localhost:${port}`;
    const server = spawn(bin, ['start', '--port', String(port)], { cwd: dashboard, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await waitForServer(origin);
      for (const engine of enginesArg) {
        try {
          report.engines[engine] = await verifyEngine(engine, origin);
          const total = Object.values(report.engines[engine].results).reduce((sum, r) => sum + r.violations.length, 0);
          console.log(`${engine}: ${total} violations across ${Object.keys(report.engines[engine].results).length} routes`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const blocked = /Executable doesn't exist|Failed to launch|browserType\.launch|Host system is missing|error while loading shared libraries/i.test(message);
          report.engines[engine] = {
            ok: false,
            status: blocked ? 'BLOCKED' : 'FAIL',
            requestedEngine: engine,
            actualEngine: null,
            requestedMode: 'prod',
            actualMode: null,
            error: message,
          };
          console.log(`${engine}: ${blocked ? 'BLOCKED' : 'FAIL'} — ${message.split('\n')[0]}`);
        }
      }
    } finally {
      server.kill('SIGTERM');
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    console.error(report.error);
    for (const engine of enginesArg) {
      if (report.engines[engine] === undefined) {
        report.engines[engine] = { ok: false, status: 'ERROR', requestedEngine: engine, actualEngine: null, error: report.error };
      }
    }
  }
}

report.ok = Object.values(report.engines).some((entry) => entry.ok === true);
writeReport();
console.log(`report written to ${outFile}`);
process.exitCode = applyExitCode(
  summarizeReports(Object.values(report.engines), { requestedEngines: enginesArg, requestedModes: ['prod'] }),
  process.stdout,
);
