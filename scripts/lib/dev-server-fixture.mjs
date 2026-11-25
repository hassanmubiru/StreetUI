/**
 * Start a real StreetUI server for a browser verification fixture.
 *
 * `mode: 'dev'` uses `createDevServer`; `mode: 'prod'` builds and serves the
 * production output via the CLI's start server. The returned `actualMode` comes
 * from the code path that was actually taken, so a harness never has to copy the
 * requested mode into its evidence. This replaces legacy, undeclared esbuild
 * bundling in older harnesses.
 */
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

async function cliModule(repo) {
  return import(path.join(repo, 'packages', 'cli', 'dist', 'index.js'));
}

/** The production start server needs a concrete port (it reports the one given). */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

const noopLogger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };

export async function startServerFixture(repo, appDir, mode = 'dev', logger = noopLogger) {
  if (mode !== 'dev' && mode !== 'prod') {
    throw new Error(`Unknown fixture mode "${mode}". Expected dev or prod`);
  }
  const cli = await cliModule(repo);
  const project = await cli.resolveProject(appDir, { requireEntry: true });
  if (mode === 'dev') {
    const server = await cli.createDevServer({ project, logger, port: 0, strictPort: true });
    return {
      url: server.url,
      requestedMode: mode,
      actualMode: 'dev',
      stop: () => server.stop(),
    };
  }
  // Client-only projects have no server entry, so production mode is a real
  // build served by the static preview server. Projects with `src/server.ts`
  // get the SSR start server instead.
  if (!existsSync(project.config.serverEntry)) {
    const built = await cli.buildProject(project, 'production', { logger });
    const preview = await cli.startPreview({
      clientDir: built.clientDir,
      logger,
      port: await freePort(),
      strictPort: true,
    });
    return {
      url: preview.url,
      requestedMode: mode,
      actualMode: 'prod',
      stop: () => preview.stop(),
    };
  }
  const server = await cli.runStart({ project, logger, port: await freePort() });
  return {
    url: server.url,
    requestedMode: mode,
    actualMode: 'prod',
    stop: () => server.close(),
  };
}

/** Backwards-compatible dev-only helper used by existing harnesses. */
export async function startDevFixture(repo, appDir) {
  const fixture = await startServerFixture(repo, appDir, 'dev');
  return { url: fixture.url, actualMode: fixture.actualMode, stop: fixture.stop };
}
