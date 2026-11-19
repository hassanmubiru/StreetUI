/**
 * `streetui dev` — starts StreetUI's own development server.
 *
 * The heavy lifting lives in `toolchain/server/dev-server.ts`; this module keeps
 * the stable programmatic `runDev` entry point used by the CLI and tests.
 */

import type { Logger } from './logger.js';
import type { ResolvedProject } from './project.js';
import type { EventLogger } from './toolchain/json/events.js';
import { createDevServer } from './toolchain/server/dev-server.js';

export interface DevOptions {
  readonly project: ResolvedProject;
  readonly logger: Logger;
  readonly events?: EventLogger;
  readonly sessionId?: string;
  readonly host?: string;
  readonly port?: number;
  readonly strictPort?: boolean;
}

export interface DevServer {
  readonly url: string;
  stop(): Promise<void>;
}

/** Start the dev server. Resolves once it is listening; keep the handle to stop. */
export async function runDev(options: DevOptions): Promise<DevServer> {
  const running = await createDevServer({
    project: options.project,
    logger: options.logger,
    ...(options.events !== undefined ? { events: options.events } : {}),
    ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
    ...(options.host !== undefined ? { host: options.host } : {}),
    ...(options.port !== undefined ? { port: options.port } : {}),
    ...(options.strictPort !== undefined ? { strictPort: options.strictPort } : {}),
  });
  return { url: running.url, stop: running.stop };
}