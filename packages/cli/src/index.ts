/**
 * `@streetui/cli` public entry. Exposes the programmatic API used by the
 * executables and the tests, and implements `runCli` — the command dispatcher
 * that turns argv into one of `create` / `dev` / `build` / `start` / `preview` /
 * `doctor` (plus `--help` / `--version`). The CLI orchestrates the existing
 * StreetUI pipeline; it is not a framework layer of its own.
 */

import { existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs, type ParsedArgs } from './args.js';
import { createLogger, type Logger } from './logger.js';
import { CliError } from './diagnostics.js';
import { resolveProject } from './project.js';
import { buildProject } from './build.js';
import { runDev } from './dev.js';
import { runStart } from './start.js';
import { createProject } from './create.js';
import { TEMPLATES } from './templates.js';
import { startPreview } from './preview.js';
import { runPlaygroundCommand } from './playground.js';
import { runDoctor, emitDoctorReport } from './toolchain/doctor/doctor.js';
import { createEventLogger, type EventLogger, makeEventId } from './toolchain/json/events.js';

export { parseArgs } from './args.js';
export { defineConfig, loadConfig, findConfigFile } from './config.js';
export type { StreetUIConfig, ResolvedConfig } from './config.js';
export { clientEnvDefine, publicEnvNames, PUBLIC_ENV_PREFIX } from './env.js';
export { resolveProject } from './project.js';
export type { ResolvedProject } from './project.js';
export { buildProject } from './build.js';
export type { BuildOutput } from './build.js';
export { runDev } from './dev.js';
export type { DevServer } from './dev.js';
export { createDevServer } from './toolchain/server/dev-server.js';
export type { RunningDevServer } from './toolchain/server/dev-server.js';
export { runStart } from './start.js';
export { createProject } from './create.js';
export type { CreateResult } from './create.js';
export { startServer, ReloadHub } from './serve.js';
export type { RenderRequest, RenderResult, RenderFn } from './serve.js';
export { CliError } from './diagnostics.js';
export { createLogger } from './logger.js';
export type { Logger } from './logger.js';
export { startPreview } from './preview.js';
export type { RunningPreview, PreviewOptions } from './preview.js';
export { runPlaygroundCommand } from './playground.js';
export type { RunningPlayground, PlaygroundOptions } from './playground.js';
export { runDoctor, emitDoctorReport } from './toolchain/doctor/doctor.js';
export type { DoctorCheck, DoctorReport } from './toolchain/doctor/doctor.js';
export { createEventLogger, silentEventLogger, STREETUI_EVENT_SCHEMA_VERSION, makeEventId } from './toolchain/json/events.js';
export type { EventLogger, StreetUIEvent, StreetUIEventType } from './toolchain/json/events.js';

/** The CLI version, read from the compiled package. Kept in one place. */
export const CLI_VERSION = '3.2.1';

/**
 * The coordinated framework release the generated projects depend on. During a
 * corrective release the CLI and the framework may move independently; apps
 * should depend on the framework line, not the CLI version.
 */
export const FRAMEWORK_VERSION = '3.2.1';

export interface RunCliOptions {
  readonly cwd?: string;
  readonly logger?: Logger;
  readonly returnServer?: boolean;
}

export interface RunCliResult {
  readonly exitCode: number;
  readonly server?: { url: string; stop: () => Promise<void> };
}

const HELP = `streetui — the StreetUI application CLI

Usage:
  streetui <command> [options]

Commands:
  create <dir>   Scaffold a new StreetUI project
  dev            Start StreetUI's own development server
  build          Produce a production build (dist/client, dist/server)
  start          Serve the production build (SSR)
  preview        Serve dist/client statically
  playground     Open the StreetUI Playground for the project
  doctor         Diagnose the project and toolchain environment

Options:
  -h, --help          Show this help
  -v, --version       Show the CLI version
  -p, --port <n>      Port for dev/start/preview (default 3000)
      --host <host>   Host for dev/start/preview (default localhost)
      --template <t>  Template for create (${TEMPLATES.join(' | ')})
      --dir <path>    Project directory (default current directory)
      --json          Machine-readable JSONL events (AI agents)

Examples:
  npm create streetui@latest my-app
  streetui dev --port 4000
  streetui build
  streetui preview`;

const quietLogger: Logger = {
  info() {},
  success() {},
  warn() {},
  error() {},
  plain() {},
};

function environmentChecks(project: Awaited<ReturnType<typeof resolveProject>>): Array<{ name: string; ok: boolean; detail: string }> {
  return [
    { name: 'node', ok: Number(process.versions.node.split('.')[0] ?? '0') >= 18, detail: `Node ${process.versions.node}` },
    { name: 'project', ok: project.packageJson.name !== undefined, detail: project.root },
    { name: 'clientEntry', ok: true, detail: project.config.clientEntry },
  ];
}

function frameworkVersionOf(project: Awaited<ReturnType<typeof resolveProject>>): string {
  return (
    project.packageJson.devDependencies?.['@streetui/cli'] ??
    project.packageJson.devDependencies?.['streetui'] ??
    project.packageJson.dependencies?.['streetui'] ??
    project.packageJson.version ??
    CLI_VERSION
  );
}

export async function runCli(argv: readonly string[], options: RunCliOptions = {}): Promise<RunCliResult> {
  const human = options.logger ?? createLogger();
  const cwd = options.cwd ?? process.cwd();
  const args = parseArgs(argv);
  const logger = args.json ? quietLogger : human;
  const sessionId = makeEventId();
  const events: EventLogger | undefined = args.json ? createEventLogger({ sessionId }) : undefined;

  if (args.unknown.length > 0) {
    logger.error(`Unknown or invalid option(s): ${args.unknown.join(', ')}`);
    logger.plain(HELP);
    return { exitCode: 1 };
  }

  if (args.version && args.command === undefined) {
    logger.plain(CLI_VERSION);
    return { exitCode: 0 };
  }
  if (args.help || args.command === undefined) {
    logger.plain(HELP);
    return { exitCode: args.command === undefined && !args.help ? 1 : 0 };
  }

  try {
    return await dispatch(args, cwd, logger, options.returnServer === true, events, sessionId);
  } catch (err) {
    if (err instanceof CliError) {
      logger.error(err.message);
      if (err.suggestion !== undefined) logger.plain(err.suggestion);
      return { exitCode: err.exitCode };
    }
    logger.error(`Unexpected error: ${(err as Error).message}`);
    return { exitCode: 1 };
  }
}

async function dispatch(
  args: ParsedArgs,
  cwd: string,
  logger: Logger,
  returnServer: boolean,
  events: EventLogger | undefined,
  sessionId: string,
): Promise<RunCliResult> {
  const projectCwd = args.dir ?? cwd;

  switch (args.command) {
    case 'create': {
      const targetDir = args.positionals[0] ?? args.dir;
      if (targetDir === undefined) {
        throw new CliError('create requires a target directory.', {
          suggestion: `Usage: streetui create <dir> [--template ${TEMPLATES.join('|')}]`,
        });
      }
      await createProject({
        targetDir,
        ...(args.template !== undefined ? { template: args.template } : {}),
        frameworkVersion: FRAMEWORK_VERSION,
        cliVersion: CLI_VERSION,
        logger,
      });
      return { exitCode: 0 };
    }

    case 'dev': {
      const project = await resolveProject(projectCwd, { requireEntry: true });
      events?.emit({
        event: 'project_detected',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        root: project.root,
        version: frameworkVersionOf(project),
      });
      events?.emit({
        event: 'environment_checked',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        ok: true,
        checks: environmentChecks(project),
      });
      events?.emit({
        event: 'compilation_started',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        mode: 'development',
      });
      const server = await runDev({
        project,
        logger,
        ...(events !== undefined ? { events } : {}),
        ...(args.host !== undefined ? { host: args.host } : {}),
        ...(args.port !== undefined ? { port: args.port } : {}),
        strictPort: args.port !== undefined,
      });
      if (returnServer) return { exitCode: 0, server: { url: server.url, stop: server.stop } };
      await blockForever({ stop: server.stop });
      return { exitCode: 0 };
    }

    case 'build': {
      const project = await resolveProject(projectCwd, { requireEntry: true });
      events?.emit({
        event: 'project_detected',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        root: project.root,
        version: frameworkVersionOf(project),
      });
      const out = await buildProject(project, 'production', {
        logger,
        sessionId,
        ...(events !== undefined ? { events } : {}),
      });
      logger.success(`Build complete → ${out.clientDir}`);
      return { exitCode: 0 };
    }

    case 'preview': {
      const project = await resolveProject(projectCwd);
      const running = await startPreview({
        clientDir: join(project.config.outDir, 'client'),
        logger,
        sessionId,
        ...(events !== undefined ? { events } : {}),
        ...(args.host !== undefined ? { host: args.host } : {}),
        ...(args.port !== undefined ? { port: args.port } : {}),
        strictPort: args.port !== undefined,
        version: frameworkVersionOf(project),
      });
      if (returnServer) return { exitCode: 0, server: { url: running.url, stop: running.stop } };
      await blockForever({ stop: running.stop });
      return { exitCode: 0 };
    }

    case 'doctor': {
      const project = await resolveProject(projectCwd);
      const report = await runDoctor(project);
      emitDoctorReport(report, events, sessionId);
      if (args.json) return { exitCode: report.ok ? 0 : 1 };
      logger.plain(`StreetUI doctor — ${report.ok ? 'OK' : 'issues found'}`);
      for (const check of report.checks) {
        const mark = check.skipped ? 'skip' : check.ok ? 'ok' : 'FAIL';
        logger.plain(`  [${mark}] ${check.name}: ${check.detail}`);
      }
      return { exitCode: report.ok ? 0 : 1 };
    }

    case 'start': {
      const project = await resolveProject(projectCwd);
      const running = await runStart({
        project,
        logger,
        sessionId,
        ...(events !== undefined ? { events } : {}),
        ...(args.host !== undefined ? { host: args.host } : {}),
        ...(args.port !== undefined ? { port: args.port } : {}),
      });
      if (returnServer) return { exitCode: 0, server: { url: running.url, stop: running.close } };
      await blockForever({ stop: running.close });
      return { exitCode: 0 };
    }

    case 'playground': {
      const pgDir = args.positionals[0] ?? args.dir ?? projectCwd;
      // `--template` on a missing/empty target scaffolds a fresh project first,
      // so the Playground can create a project (M9.4, local mode).
      if (args.template !== undefined) {
        const missing = !existsSync(pgDir) || readdirSync(pgDir).length === 0;
        if (missing) {
          await createProject({
            targetDir: pgDir,
            template: args.template,
            frameworkVersion: FRAMEWORK_VERSION,
            cliVersion: CLI_VERSION,
            logger,
          });
          // Install dependencies so the fresh project can run (local mode).
          try {
            const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
              cwd: pgDir,
              stdio: 'ignore',
              env: { ...process.env, NO_COLOR: '1' },
            });
            if (r.status !== 0) logger.warn('npm install finished with a non-zero status; run "npm install" manually.');
          } catch (error) {
            logger.warn(`Could not install dependencies: ${(error as Error).message}`);
          }
        }
      }
      const project = await resolveProject(pgDir, { requireEntry: true });
      events?.emit({
        event: 'project_detected',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        root: project.root,
        version: frameworkVersionOf(project),
      });
      const running = await runPlaygroundCommand({
        project,
        logger,
        sessionId,
        ...(args.host !== undefined ? { host: args.host } : {}),
        ...(args.port !== undefined ? { port: args.port } : {}),
      });
      if (returnServer) return { exitCode: 0, server: { url: running.url, stop: running.stop } };
      await blockForever({ stop: running.stop });
      return { exitCode: 0 };
    }

    default:
      throw new CliError(`Unknown command "${args.command}".`, {
        suggestion: 'Run "streetui --help" to see available commands.',
      });
  }
}

/** Keep the process alive for long-running commands until interrupted. */
function blockForever(server: { stop: () => Promise<void> }): Promise<never> {
  return new Promise<never>(() => {
    let stopping = false;
    const shutdown = (): void => {
      if (stopping) return;
      stopping = true;
      void server.stop().finally(() => process.exit(0));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}