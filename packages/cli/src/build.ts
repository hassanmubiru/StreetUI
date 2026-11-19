/**
 * `streetui build` — production build.
 *
 * Thin wrapper over StreetUI's own builder. The builder uses the same resolver,
 * module graph, and TypeScript transform as the dev server; it does not invoke
 * a third-party bundler.
 */

import type { ResolvedProject } from './project.js';
import type { Logger } from './logger.js';
import type { EventLogger } from './toolchain/json/events.js';
import { buildProject as runBuild, type BuildOutput } from './toolchain/build/builder.js';

export type { BuildOutput };

export async function buildProject(
  project: ResolvedProject,
  mode: 'development' | 'production' = 'production',
  options: { logger?: Logger; events?: EventLogger; sessionId?: string } = {},
): Promise<BuildOutput> {
  return runBuild({
    project,
    mode,
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
    ...(options.events !== undefined ? { events: options.events } : {}),
    ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
  });
}