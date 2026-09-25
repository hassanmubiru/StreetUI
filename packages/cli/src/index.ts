/**
 * `@streetui/cli` public entry. Exposes the programmatic API used by the
 * executables and the tests, and implements `runCli` — the command dispatcher
 * that turns argv into one of `create` / `dev` / `build` / `start` (plus
 * `--help` / `--version`). The CLI only orchestrates the existing StreetUI
 * pipeline; it is not a framework layer of its own.
 */

import { parseArgs, type ParsedArgs } from './args.js';
import { createLogger, type Logger } from './logger.js';
import { CliError } from './diagnostics.js';
import { resolveProject } from './project.js';
import { buildProject } from './build.js';
import { runDev } from './dev.js';
import { runStart } from './start.js';
import { createProject } from './create.js';

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
export { runStart } from './start.js';
export { createProject } from './create.js';
export type { CreateResult } from './create.js';
export { startServer, ReloadHub } from './serve.js';
export type { RenderRequest, RenderResult, RenderFn } from './serve.js';
export { CliError } from './diagnostics.js';
export { createLogger } from './logger.js';
export type { Logger } from './logger.js';

/** The CLI version, read from the compiled package. Kept in one place. */
export const CLI_VERSION = '1.5.0';

/** Options for `runCli`, all injectable so tests can drive it in-process. */
export interface RunCliOptions {
  /** Working directory the command acts on. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /** Logger sink. Defaults to the branded stdout logger. */
  readonly logger?: Logger;
  /**
   * When true, `dev` and `start` return their running handle instead of
   * blocking forever. Tests set this; the real binary leaves it false.
   */
  readonly returnServer?: boolean;
}

/** Result of a command: an exit code plus any long-lived handle for tests. */
export interface RunCliResult {
  readonly exitCode: number;
  readonly server?: { url: string; stop: () => Promise<void> };
}

const HELP = `streetui — the StreetUI application CLI

Usage:
  streetui <command> [options]

Commands:
  create <dir>   Scaffold a new StreetUI project
  dev            Start the development server with live reload
  build          Produce a production build (dist/client, dist/server)
  start          Serve the production build

Options:
  -h, --help          Show this help
  -v, --version       Show the CLI version
  -p, --port <n>      Port for dev/start (default 3000)
      --host <host>   Host for dev/start (default localhost)
      --template <t>  Template for create (basic | ssr)
      --dir <path>    Project directory (default current directory)

Examples:
  npm create streetui@latest my-app
  streetui dev --port 4000
  streetui build
  streetui start`;

/** Dispatch a parsed command line. Never throws for expected errors — it maps
 *  `CliError` to an exit code and a logged message instead. */
export async function runCli(argv: readonly string[], options: RunCliOptions = {}): Promise<RunCliResult> {
  const logger = options.logger ?? createLogger();
  const cwd = options.cwd ?? process.cwd();
  const args = parseArgs(argv);

  // Reject unknown flags before doing anything (Phase 14: no ignored options).
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
    return await dispatch(args, cwd, logger, options.returnServer === true);
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
): Promise<RunCliResult> {
  const projectCwd = args.dir ?? cwd;

  switch (args.command) {
    case 'create': {
      const targetDir = args.positionals[0] ?? args.dir;
      if (targetDir === undefined) {
        throw new CliError('create requires a target directory.', {
          suggestion: 'Usage: streetui create <dir> [--template basic|ssr]',
        });
      }
      await createProject({
        targetDir,
        ...(args.template !== undefined ? { template: args.template } : {}),
        frameworkVersion: CLI_VERSION,
        logger,
      });
      return { exitCode: 0 };
    }

    case 'build': {
      const project = await resolveProject(projectCwd, { requireEntry: true });
      const out = await buildProject(project, 'production');
      logger.success(`Build complete → ${out.clientDir}`);
      return { exitCode: 0 };
    }

    case 'dev': {
      const project = await resolveProject(projectCwd, { requireEntry: true });
      const server = await runDev({
        project,
        logger,
        ...(args.host !== undefined ? { host: args.host } : {}),
        ...(args.port !== undefined ? { port: args.port } : {}),
      });
      if (returnServer) return { exitCode: 0, server };
      await blockForever();
      return { exitCode: 0 };
    }

    case 'start': {
      const project = await resolveProject(projectCwd);
      const running = await runStart({
        project,
        logger,
        ...(args.host !== undefined ? { host: args.host } : {}),
        ...(args.port !== undefined ? { port: args.port } : {}),
      });
      if (returnServer) return { exitCode: 0, server: { url: running.url, stop: running.close } };
      await blockForever();
      return { exitCode: 0 };
    }

    default:
      throw new CliError(`Unknown command "${args.command}".`, {
        suggestion: 'Run "streetui --help" to see available commands.',
      });
  }
}

/** Keep the process alive for long-running commands until interrupted. */
function blockForever(): Promise<never> {
  return new Promise<never>(() => {
    /* resolved only by process termination */
  });
}
