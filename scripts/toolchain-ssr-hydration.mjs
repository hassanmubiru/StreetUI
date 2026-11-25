#!/usr/bin/env node
/**
 * M13.8 — SSR + hydration verification against a real browser.
 *
 * Verifies, with Chromium and Firefox against the built dashboard example:
 *   1. SSR content is real markup — with the client bundle never loaded, the
 *      page still contains the route's data (no JS required to see content).
 *   2. Hydration adopts the server DOM — elements tagged before the client
 *      entry executes keep the same nodes afterwards (no duplicate trees).
 *   3. The app is interactive after hydration (theme toggle updates the root).
 *   4. The serialized state island matches the rendered route.
 *   5. In dev, an SSR source edit is reflected by the next server response
 *      (SSR cache regeneration), and reverting restores the original output.
 *
 * A missing engine is BLOCKED, never recorded as passed.
 *
 * Usage: node scripts/toolchain-ssr-hydration.mjs [--engines chromium,firefox,webkit]
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
const outFile = path.join(repo, 'benchmarks', 'results', 'toolchain', 'ssr-hydration.json');

assertNoUnknownSelectionFlags();
const engines = enginesFromArgv();

let playwright;
try {
  playwright = await import('playwright');
} catch {
  playwright = undefined;
}

const report = {
  schema: 'streetui-ssr-hydration/v1',
  created: new Date().toISOString(),
  target: 'local-workspace',
  requestedEngines: engines,
  requestedMode: 'prod',
  engines: {},
  ok: false,
};

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

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not respond at ${url}`);
}

/** Pure SSR: abort the client entry so no hydration ever runs. */
async function checkServerRendered(browser, origin) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const res = await page.goto(`${origin}/users`, { waitUntil: 'load' });
    const text = await page.textContent('#app');
    const html = await page.content();
    const rows = await page.$$eval('[data-streetui-key]', (nodes) => nodes.length);
    return {
      status: res?.status() ?? 0,
      headingPresent: /Users/.test(text ?? ''),
      searchInputPresent: /id="user-search"/.test(html),
      dataPresent: /of 24 users/.test(text ?? ''),
      firstUserName: /Ava Chen/.test(text ?? ''),
      pagerPresent: /Page 1 of 3/.test(text ?? ''),
      keyedRows: rows,
    };
  } finally {
    await context.close();
  }
}

/** Hydration: delay the client entry, tag the server DOM, then verify adoption. */
async function checkHydration(browser, origin) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    let entryDelayed = false;
    await page.route('**/assets/*.js', async (route) => {
      if (entryDelayed) return route.continue();
      entryDelayed = true;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return route.continue();
    });

    await page.goto(`${origin}/users`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#users-next', { timeout: 20000 });

    // Hydration cannot have run yet (entry is still delayed): tag the SSR nodes.
    const tagged = await page.evaluate(() => {
      const ids = ['brand', 'nav-users', 'user-search', 'users-next'];
      const found = {};
      let n = 0;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el === null) {
          found[id] = false;
          continue;
        }
        el.dataset.ssrProbe = String(n++);
        found[id] = true;
      }
      const state = document.querySelector('script[data-streetui-state]');
      return {
        found,
        probes: n,
        stateJson: state === null ? null : state.textContent,
        elementsBefore: document.querySelectorAll('*').length,
      };
    });

    // Wait for hydration to attach behavior (theme toggle becomes live).
    await page.waitForFunction(() => window.__ssrHydratedProbe === undefined, null, { timeout: 5000 }).catch(() => {});
    await page.waitForSelector('#theme-toggle', { state: 'attached', timeout: 20000 });

    let interactive = false;
    let adoption;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await page.click('#theme-toggle').catch(() => {});
      await page.waitForTimeout(150);
      interactive = await page.evaluate(() => document.documentElement.dataset.theme === 'dark');
      adoption = await page.evaluate(() => {
        const ids = ['brand', 'nav-users', 'user-search', 'users-next'];
        const probes = {};
        for (const id of ids) {
          const el = document.getElementById(id);
          probes[id] = el === null ? null : (el.dataset.ssrProbe ?? 'missing');
        }
        return { probes, elementsAfter: document.querySelectorAll('*').length };
      });
      if (interactive) break;
      await page.waitForTimeout(200);
    }

    const stateIsland = (() => {
      if (tagged.stateJson === null) return null;
      try {
        return JSON.parse(tagged.stateJson);
      } catch {
        return null;
      }
    })();

    return {
      taggedElements: tagged.found,
      probes: tagged.probes,
      adopted: adoption?.probes ?? {},
      elementsBefore: tagged.elementsBefore,
      elementsAfter: adoption?.elementsAfter ?? 0,
      interactive,
      stateIslandView: stateIsland?.['streetui-dashboard']?.view ?? null,
      consoleErrors,
    };
  } finally {
    await context.close();
  }
}

function judge(hydration) {
  const adoptedIds = Object.values(hydration.adopted);
  const allAdopted = adoptedIds.length > 0 && adoptedIds.every((v) => v !== 'missing' && v !== null);
  const noDuplication = hydration.elementsAfter === hydration.elementsBefore;
  return {
    serverDomAdopted: allAdopted,
    noDuplicateTree: noDuplication,
    interactive: hydration.interactive === true,
    stateIslandCorrect: hydration.stateIslandView === 'users',
    consoleClean: hydration.consoleErrors.length === 0,
    ok: allAdopted && noDuplication && hydration.interactive === true && hydration.stateIslandView === 'users' && hydration.consoleErrors.length === 0,
  };
}

/** Dev SSR regeneration: an edit must show up in the next server response. */
async function checkSsrRegeneration() {
  const appFile = path.join(dashboard, 'src', 'app.ts');
  const original = fs.readFileSync(appFile, 'utf8');
  const port = await freePort();
  const log = [];
  const server = spawn(bin, ['dev', '--port', String(port)], {
    cwd: dashboard,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });
  server.stdout.on('data', (chunk) => log.push(`out: ${String(chunk).trim()}`));
  server.stderr.on('data', (chunk) => log.push(`err: ${String(chunk).trim()}`));
  const origin = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(origin);
    const before = await (await fetch(`${origin}/users`)).text();
    const marker = 'SSR regeneration marker';
    const patched = original.replace("bar.heading('Acme Admin'", `bar.heading('${marker}'`);
    if (patched === original) throw new Error('could not locate the brand heading in src/app.ts');
    fs.writeFileSync(appFile, patched, 'utf8');
    const changed = true;

    let seen = false;
    let sample = '';
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const html = await (await fetch(`${origin}/users`)).text();
      if (html.includes(marker)) {
        seen = true;
        break;
      }
      sample = html.includes('Acme Admin') ? 'served previous heading' : `unexpected body (${html.length} bytes)`;
      await new Promise((r) => setTimeout(r, 250));
    }

    fs.writeFileSync(appFile, original, 'utf8');
    let restored = false;
    const restoreDeadline = Date.now() + 30000;
    while (Date.now() < restoreDeadline) {
      const html = await (await fetch(`${origin}/users`)).text();
      if (html.includes('Acme Admin') && !html.includes(marker)) {
        restored = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return { changed, regenerated: seen, restored, beforeLength: before.length, sample, log, ok: changed && seen && restored };
  } finally {
    fs.writeFileSync(appFile, original, 'utf8');
    server.kill('SIGTERM');
    await new Promise((resolve) => {
      server.once('exit', resolve);
      setTimeout(resolve, 5000);
    });
  }
}

async function runEngine(engine, origin) {
  let browser;
  try {
    browser = await launchBrowser(playwright, engine);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocked = /Executable doesn't exist|Failed to launch|browserType\.launch|Host system is missing|libevent|libavif|Missing X server/i.test(message);
    return { ok: false, requestedEngine: engine, actualEngine: null, status: blocked ? 'BLOCKED' : 'FAIL', error: message.split('\n')[0] };
  }
  try {
    const ssr = await checkServerRendered(browser, origin);
    const hydration = await checkHydration(browser, origin);
    const verdict = judge(hydration);
    const ssrOk =
      ssr.status === 200 &&
      ssr.headingPresent &&
      ssr.searchInputPresent &&
      ssr.dataPresent &&
      ssr.firstUserName &&
      ssr.pagerPresent;
    return {
      ok: ssrOk && verdict.ok,
      status: ssrOk && verdict.ok ? 'PASS' : 'FAIL',
      requestedEngine: engine,
      actualEngine: browser.browserType().name(),
      browserVersion: browser.version(),
      requestedMode: 'prod',
      actualMode: 'prod',
      serverRendered: { ...ssr, ok: ssrOk },
      hydration: { ...hydration, verdict },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 'FAIL',
      requestedEngine: engine,
      actualEngine: browser.browserType().name(),
      browserVersion: browser.version(),
      error: message,
    };
  } finally {
    await browser.close();
  }
}

try {
  if (playwright === undefined) {
    for (const engine of engines) {
      report.engines[engine] = {
        ok: false,
        status: 'BLOCKED',
        requestedEngine: engine,
        actualEngine: null,
        error: 'Playwright is not installed.',
      };
    }
    report.ok = false;
  } else {
    execFileSync(bin, ['build'], { cwd: dashboard, stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000 });
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    const server = spawn(bin, ['start', '--port', String(port)], { cwd: dashboard, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await waitForServer(origin);
      for (const engine of engines) {
        report.engines[engine] = await runEngine(engine, origin);
        console.log(`${engine}: ${report.engines[engine].status}`);
      }
    } finally {
      server.kill('SIGTERM');
      await new Promise((resolve) => {
        server.once('exit', resolve);
        setTimeout(resolve, 5000);
      });
    }

    report.devSsrRegeneration = await checkSsrRegeneration().catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
    console.log(`dev SSR regeneration: ${report.devSsrRegeneration.ok ? 'PASS' : 'FAIL'}`);

    const engineResults = Object.values(report.engines);
    report.ok = report.devSsrRegeneration.ok === true && engineResults.every((r) => r.ok === true);
  }
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  report.ok = false;
  console.error(report.error);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(`ssr-hydration report: ${outFile}`);
for (const engine of engines) console.log(`ssr-hydration: ${engine} → ${report.engines[engine]?.status ?? 'MISSING'}`);
process.exitCode = applyExitCode(
  summarizeReports(Object.values(report.engines), { requestedEngines: engines, requestedModes: ['prod'] }),
  process.stdout,
);
