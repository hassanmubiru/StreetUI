/**
 * `streetui doctor` — environment and project diagnostics.
 *
 * Reports what is actually true. A missing browser or optional tool is marked
 * `skipped`, never `ok`. Type checking is intentionally separate: `doctor` does
 * not run `tsc`.
 */

import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { ResolvedProject } from '../../project.js';
import type { EventLogger } from '../json/events.js';
import { makeEventId } from '../json/events.js';

export interface DoctorCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly skipped?: boolean;
}

export interface DoctorReport {
  readonly ok: boolean;
  readonly checks: readonly DoctorCheck[];
}

async function portAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    const onError = (): void => {
      server.close(() => resolve(false));
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function browserCheck(): Promise<DoctorCheck> {
  try {
    const playwright = (await import('playwright')) as {
      chromium?: { executablePath?: () => string };
      firefox?: { executablePath?: () => string };
    };
    const chromium = playwright.chromium?.executablePath?.();
    const firefox = playwright.firefox?.executablePath?.();
    const present = [chromium, firefox].filter((path): path is string => path !== undefined && existsSync(path));
    if (present.length === 0) {
      return { name: 'browsers', ok: false, skipped: true, detail: 'Playwright is installed but no browser binary was found; run "npx playwright install".' };
    }
    return {
      name: 'browsers',
      ok: true,
      detail: `Playwright browsers available: ${present.map((path) => path.split('/').pop()).join(', ')}`,
    };
  } catch {
    return { name: 'browsers', ok: false, skipped: true, detail: 'Playwright is not installed; browser tests are skipped.' };
  }
}

export async function runDoctor(project: ResolvedProject): Promise<DoctorReport> {
  const { root, packageJson, config } = project;
  const checks: DoctorCheck[] = [];

  const major = Number(process.versions.node.split('.')[0] ?? '0');
  checks.push({
    name: 'node',
    ok: major >= 18,
    detail: `Node ${process.versions.node} (toolchain requires >= 18)`,
  });

  checks.push({
    name: 'package.json',
    ok: packageJson.name !== undefined,
    detail: packageJson.name ?? 'package.json has no name',
  });

  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  const streetuiVersion = deps['streetui'] ?? Object.entries(deps).find(([name]) => name.startsWith('@streetui/'))?.[1];
  checks.push({
    name: 'streetui dependency',
    ok: streetuiVersion !== undefined,
    detail: streetuiVersion ?? 'no "streetui" or "@streetui/*" dependency found',
  });

  checks.push({
    name: 'config',
    ok: true,
    detail: `root=${root} port=${config.port} outDir=${config.outDir}`,
  });

  checks.push({
    name: 'client entry',
    ok: existsSync(config.clientEntry),
    detail: config.clientEntry,
  });
  checks.push({
    name: 'server entry',
    ok: existsSync(config.serverEntry),
    detail: existsSync(config.serverEntry) ? config.serverEntry : `${config.serverEntry} (absent: client-only build)`,
    skipped: !existsSync(config.serverEntry),
  });
  checks.push({
    name: 'public dir',
    ok: existsSync(config.publicDir),
    detail: config.publicDir,
    skipped: !existsSync(config.publicDir),
  });

  try {
    const require = createRequire(join(root, 'package.json'));
    const typescriptPath = require.resolve('typescript');
    checks.push({ name: 'typescript', ok: true, detail: typescriptPath });
  } catch {
    checks.push({ name: 'typescript', ok: false, detail: 'TypeScript is not resolvable from the project; install it as a devDependency.' });
  }

  const portOk = await portAvailable(config.host, config.port);
  checks.push({
    name: 'port',
    ok: portOk,
    detail: `${config.host}:${config.port} is ${portOk ? 'available' : 'in use'}`,
  });

  checks.push(await browserCheck());

  const failed = checks.filter((check) => !check.ok && !check.skipped);
  return { ok: failed.length === 0, checks };
}

export function emitDoctorReport(report: DoctorReport, events?: EventLogger, sessionId?: string): void {
  events?.emit({
    event: 'environment_checked',
    eventId: makeEventId(),
    sessionId: sessionId ?? '',
    schemaVersion: 1,
    framework: 'streetui',
    timestamp: new Date().toISOString(),
    ok: report.ok,
    checks: report.checks.map((check) => ({ name: check.name, ok: check.ok, detail: check.detail })),
  });
}