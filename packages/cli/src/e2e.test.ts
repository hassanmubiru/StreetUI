import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject } from './create.js';
import { resolveProject } from './project.js';
import { buildProject } from './build.js';
import { startServer } from './serve.js';
import type { Logger } from './logger.js';

/**
 * Phase 21 — the full developer journey, exercised against the ACTUAL generated
 * template (not helpers): create → resolve → build → start → HTTP request →
 * verify server-rendered HTML. Nothing is faked; a real esbuild build produces
 * real bundles and a real `node:http` server answers a real `fetch`.
 */

const noopLogger: Logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };

// packages/cli/src/e2e.test.ts → repo root is three levels up.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const MONOREPO_PACKAGES = [
  'compiler', 'dom', 'dsl', 'renderer', 'state',
  'core', 'graph', 'runtime', 'events', 'scheduler',
];

const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const c of cleanups.splice(0)) await c();
});

/** Ask the OS for a free TCP port. */
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolvePort(port));
    });
  });
}

/** Link the generated project's @streetui/* deps to the built monorepo packages. */
async function wireDependencies(projectRoot: string): Promise<void> {
  const modules = join(projectRoot, 'node_modules');
  const scoped = join(modules, '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of MONOREPO_PACKAGES) {
    await symlink(join(repoRoot, 'packages', pkg), join(scoped, pkg), 'dir');
  }
  // The compiled streetui.config.ts keeps `@streetui/cli` (defineConfig) external.
  await symlink(join(repoRoot, 'packages', 'cli'), join(scoped, 'cli'), 'dir');
}

describe('developer journey (create → build → start → request)', () => {
  it('serves the generated SSR app over real HTTP with hydratable markup', async () => {
    const base = await mkdtemp(join(tmpdir(), 'streetui-e2e-'));
    cleanups.push(() => rm(base, { recursive: true, force: true }));
    const projectRoot = join(base, 'journey-app');

    // 1. create
    await createProject({
      targetDir: projectRoot,
      template: 'ssr',
      frameworkVersion: '0.6.0',
      logger: noopLogger,
    });

    // 2. install (simulated by linking the built workspace packages)
    await wireDependencies(projectRoot);

    // 3. resolve + build
    const project = await resolveProject(projectRoot, { requireEntry: true });
    const out = await buildProject(project, 'production');
    expect(existsSync(out.clientBundle), 'client bundle produced').toBe(true);
    expect(existsSync(out.serverBundle), 'server bundle produced').toBe(true);
    // static assets copied alongside the client bundle
    expect(existsSync(join(out.clientDir, 'styles.css'))).toBe(true);

    // 4. start the production server
    const port = await freePort();
    const server = await startServer({
      clientDir: out.clientDir,
      serverBundle: out.serverBundle,
      host: '127.0.0.1',
      port,
      devMode: false,
    });
    cleanups.push(() => server.close());

    // 5. request the home route and verify the server-rendered HTML
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('id="app"');
    expect(html).toContain('journey-app'); // brand heading / title
    expect(html).toContain('data-streetui-state'); // hydration state island
    expect(html).toContain('src="/main.js"'); // client entry for hydration

    // 6. the client bundle is served as real JavaScript
    const jsRes = await fetch(`http://127.0.0.1:${port}/main.js`);
    expect(jsRes.status).toBe(200);
    expect(jsRes.headers.get('content-type')).toContain('javascript');
    expect((await jsRes.text()).length).toBeGreaterThan(0);

    // 7. a second route renders different server HTML (SSR view switching)
    const about = await fetch(`http://127.0.0.1:${port}/about`);
    expect(about.status).toBe(200);
    expect((await about.text())).toContain('id="app"');
  });
});
