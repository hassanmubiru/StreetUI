/**
 * `streetui start` (Phase 8). Serves an existing production build. If the build
 * output is missing we build it first, so `start` on a fresh checkout still
 * works. Uses the standard Node HTTP server from `serve.ts`.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from './logger.js';
import type { ResolvedProject } from './project.js';
import { buildProject } from './build.js';
import { startServer, type RunningServer } from './serve.js';
import { CliError } from './diagnostics.js';

export interface StartOptions {
  readonly project: ResolvedProject;
  readonly logger: Logger;
  /** Overrides for the configured host/port (from --host/--port). */
  readonly host?: string;
  readonly port?: number;
}

/** Build (if needed) and serve the production output. Resolves once listening. */
export async function runStart(options: StartOptions): Promise<RunningServer> {
  const { project, logger } = options;
  const { config } = project;
  const clientDir = join(config.outDir, 'client');
  const serverBundle = join(config.outDir, 'server', 'server.js');

  if (!existsSync(serverBundle)) {
    logger.info('No production build found — building first…');
    await buildProject(project, 'production');
  }
  if (!existsSync(serverBundle)) {
    throw new CliError('Production build did not produce a server bundle.', {
      suggestion: 'Ensure your project has a server entry (default src/server.ts) that exports render().',
    });
  }

  const host = options.host ?? config.host;
  const port = options.port ?? config.port;
  const running = await startServer({ clientDir, serverBundle, host, port });
  logger.success(`Production server running at ${running.url}`);
  return running;
}
