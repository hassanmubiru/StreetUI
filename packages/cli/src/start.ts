/**
 * `streetui start` — serves an existing production build.
 *
 * If the build output is missing we build it first, so `start` on a fresh
 * checkout still works. Uses the standard Node HTTP server from `serve.ts`.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from './logger.js';
import type { ResolvedProject } from './project.js';
import type { EventLogger } from './toolchain/json/events.js';
import { makeEventId } from './toolchain/json/events.js';
import { buildProject } from './build.js';
import { startServer, type RunningServer } from './serve.js';
import { readManifest } from './toolchain/build/manifest.js';
import { CliError } from './diagnostics.js';

export interface StartOptions {
  readonly project: ResolvedProject;
  readonly logger: Logger;
  readonly events?: EventLogger;
  readonly sessionId?: string;
  readonly host?: string;
  readonly port?: number;
}

export async function runStart(options: StartOptions): Promise<RunningServer> {
  const { project, logger, events } = options;
  const sessionId = options.sessionId ?? makeEventId();
  const { config } = project;
  const clientDir = join(config.outDir, 'client');
  let serverBundle = join(config.outDir, 'server', 'server.js');

  if (!existsSync(serverBundle)) {
    logger.info('No production build found — building first…');
    await buildProject(project, 'production', {
      logger,
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(events !== undefined ? { events } : {}),
    });
  }
  if (!existsSync(serverBundle)) {
    throw new CliError('Production build did not produce a server bundle.', {
      suggestion: 'Ensure your project has a server entry (default src/server.ts) that exports render().',
    });
  }

  const manifest = await readManifest(clientDir);
  const host = options.host ?? config.host;
  const port = options.port ?? config.port;
  const running = await startServer({
    clientDir,
    serverBundle,
    host,
    port,
    ...(manifest !== undefined
      ? {
          manifest: {
            entry: {
              js: manifest.entry.js,
              ...(manifest.entry.css !== undefined ? { css: manifest.entry.css } : {}),
            },
          },
        }
      : {}),
  });
  logger.success(`Production server running at ${running.url}`);
  const version =
    project.packageJson.devDependencies?.['@streetui/cli'] ??
    project.packageJson.devDependencies?.['streetui'] ??
    project.packageJson.dependencies?.['streetui'] ??
    project.packageJson.version;
  const actualPort = Number(new URL(running.url).port);
  events?.emit({
    event: 'server_started',
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: 'streetui',
    timestamp: new Date().toISOString(),
    url: running.url,
    port: actualPort,
    host,
    version,
  });
  return running;
}