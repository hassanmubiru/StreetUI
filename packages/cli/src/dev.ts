/**
 * `streetui dev` (Phase 5). Builds the project once, then watches for changes
 * with esbuild's incremental context API and rebuilds only what changed —
 * avoiding a full cold build per keystroke (Phase 27). On each successful
 * rebuild connected browsers are told to reload; build errors are printed with
 * real source positions and never crash the server.
 */

import { context, type BuildContext, type BuildOptions, type Message } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from './logger.js';
import type { ResolvedProject } from './project.js';
import { startServer, ReloadHub, type RunningServer } from './serve.js';
import { fromEsbuildMessage, formatBuildFailure } from './diagnostics.js';
import { clientEnvDefine } from './env.js';

export interface DevOptions {
  readonly project: ResolvedProject;
  readonly logger: Logger;
  readonly host?: string;
  readonly port?: number;
}

/** Handle returned so callers (and tests) can shut the dev server down. */
export interface DevServer {
  readonly url: string;
  stop(): Promise<void>;
}

/** Report esbuild results to the logger and reload browsers when clean. */
function reportResult(
  label: string,
  errors: readonly Message[],
  logger: Logger,
  reload: ReloadHub,
): void {
  if (errors.length > 0) {
    const problems = errors.map((m) => fromEsbuildMessage({ text: m.text, location: m.location }));
    logger.error(`${label} rebuild failed:`);
    logger.plain(formatBuildFailure(problems));
    return;
  }
  reload.triggerReload();
}

/** Start the dev server. Resolves once it is listening; keep the handle to stop. */
export async function runDev(options: DevOptions): Promise<DevServer> {
  const { project, logger } = options;
  const { config } = project;
  const clientDir = join(config.outDir, 'client');
  const serverDir = join(config.outDir, 'server');
  const serverBundle = join(serverDir, 'server.js');
  const reload = new ReloadHub();

  await rm(config.outDir, { recursive: true, force: true });
  await mkdir(clientDir, { recursive: true });
  await mkdir(serverDir, { recursive: true });

  const shared: BuildOptions = {
    bundle: true,
    format: 'esm',
    sourcemap: true,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  };

  const contexts: BuildContext[] = [];

  const clientCtx = await context({
    ...shared,
    entryPoints: [config.clientEntry],
    outfile: join(clientDir, 'main.js'),
    platform: 'browser',
    target: ['es2022'],
    define: clientEnvDefine('development'),
    plugins: [
      {
        name: 'streetui-client-reload',
        setup(builder) {
          builder.onEnd((result) => reportResult('Client', result.errors, logger, reload));
        },
      },
    ],
  });
  contexts.push(clientCtx);

  const hasServerEntry = existsSync(config.serverEntry);
  if (hasServerEntry) {
    const serverCtx = await context({
      ...shared,
      entryPoints: [config.serverEntry],
      outfile: serverBundle,
      platform: 'node',
      target: ['node18'],
      packages: 'external',
      plugins: [
        {
          name: 'streetui-server-reload',
          setup(builder) {
            builder.onEnd((result) => {
              if (result.errors.length > 0) {
                reportResult('Server', result.errors, logger, reload);
              }
            });
          },
        },
      ],
    });
    contexts.push(serverCtx);
  }

  // Initial build for every context, then enable watch mode.
  await Promise.all(contexts.map((c) => c.rebuild().catch(() => undefined)));
  await Promise.all(contexts.map((c) => c.watch()));

  if (existsSync(config.publicDir)) {
    await cp(config.publicDir, clientDir, { recursive: true });
  }

  const host = options.host ?? config.host;
  const port = options.port ?? config.port;

  let running: RunningServer | undefined;
  if (hasServerEntry) {
    running = await startServer({ clientDir, serverBundle, host, port, reload, devMode: true });
    logger.success(`Dev server running at ${running.url}`);
    logger.info('Watching for changes… (press Ctrl+C to stop)');
  } else {
    logger.warn('No server entry found — client bundle is being watched, but no dev server was started.');
  }

  const url = running?.url ?? `http://${host}:${port}`;
  return {
    url,
    stop: async () => {
      await Promise.all(contexts.map((c) => c.dispose()));
      await running?.close();
    },
  };
}
