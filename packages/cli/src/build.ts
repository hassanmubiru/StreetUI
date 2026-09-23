/**
 * Production build (Phase 7). Two esbuild passes over the project's real
 * entries — a browser bundle for hydration and a Node bundle for SSR — plus a
 * copy of the public directory. No separate production rendering system: the
 * same DSL → compile → renderer pipeline the app already uses is bundled as-is.
 */

import { build as esbuildBuild, type BuildOptions, type Message } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedProject } from './project.js';
import { fromEsbuildMessage, formatBuildFailure, CliError, type BuildProblem } from './diagnostics.js';
import { clientEnvDefine } from './env.js';

/** Where each artifact lands under the configured `outDir`. */
export interface BuildOutput {
  readonly clientDir: string;
  readonly serverDir: string;
  readonly clientBundle: string;
  readonly serverBundle: string;
}

/** Convert esbuild's error array into our problem shape, preserving locations. */
function toProblems(messages: readonly Message[]): BuildProblem[] {
  return messages.map((m) => fromEsbuildMessage({ text: m.text, location: m.location }));
}

/** Shared esbuild options for both passes. */
function baseOptions(mode: 'development' | 'production'): BuildOptions {
  return {
    bundle: true,
    format: 'esm',
    sourcemap: true,
    logLevel: 'silent',
    define: {
      // Public build-time constants. Server secrets are never injected here.
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    minify: mode === 'production',
  };
}

/**
 * Run the production build for `project`. Returns the output layout on success;
 * throws a `CliError` carrying formatted diagnostics on failure. When
 * `serverEntry` is absent the server pass is skipped (client-only project).
 */
export async function buildProject(
  project: ResolvedProject,
  mode: 'development' | 'production' = 'production',
): Promise<BuildOutput> {
  const { config } = project;
  const clientDir = join(config.outDir, 'client');
  const serverDir = join(config.outDir, 'server');

  await rm(config.outDir, { recursive: true, force: true });
  await mkdir(clientDir, { recursive: true });

  // Only errors are fatal. esbuild throws (rejects) when a pass has errors, so
  // the catch branch is the sole source of build-breaking problems. Warnings —
  // including exports-ordering notes emitted for third-party dependency
  // package.json files — must never fail a production build.
  const errors: BuildProblem[] = [];

  // Client (browser) pass — always required.
  await esbuildBuild({
    ...baseOptions(mode),
    entryPoints: [config.clientEntry],
    outfile: join(clientDir, 'main.js'),
    platform: 'browser',
    target: ['es2022'],
    // Only STREETUI_PUBLIC_* env vars reach the browser (plus NODE_ENV).
    define: clientEnvDefine(mode),
  }).catch((err: { errors?: Message[] }) => {
    errors.push(...toProblems(err.errors ?? []));
    return undefined;
  });

  // Server (node) pass — only when a server entry exists.
  const hasServerEntry = existsSync(config.serverEntry);
  if (hasServerEntry) {
    await mkdir(serverDir, { recursive: true });
    await esbuildBuild({
      ...baseOptions(mode),
      entryPoints: [config.serverEntry],
      outfile: join(serverDir, 'server.js'),
      platform: 'node',
      target: ['node18'],
      packages: 'external',
    }).catch((err: { errors?: Message[] }) => {
      errors.push(...toProblems(err.errors ?? []));
      return undefined;
    });
  }

  if (errors.length > 0) {
    throw new CliError(formatBuildFailure(errors), { exitCode: 1 });
  }

  // Copy static assets into the client output so they ship together.
  if (existsSync(config.publicDir)) {
    await cp(config.publicDir, clientDir, { recursive: true });
  }

  return {
    clientDir,
    serverDir,
    clientBundle: join(clientDir, 'main.js'),
    serverBundle: join(serverDir, 'server.js'),
  };
}
