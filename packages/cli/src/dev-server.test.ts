import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createProject } from './create.js';
import { resolveProject } from './project.js';
import { createDevServer } from './toolchain/server/dev-server.js';
import type { Logger } from './logger.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const MONOREPO_PACKAGES = ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler'];

const noopLogger: Logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };
const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const c of cleanups.splice(0)) await c();
});

async function wireDependencies(projectRoot: string): Promise<void> {
  const modules = join(projectRoot, 'node_modules');
  const scoped = join(modules, '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of MONOREPO_PACKAGES) {
    await symlink(join(repoRoot, 'packages', pkg), join(scoped, pkg), 'dir');
  }
  await symlink(join(repoRoot, 'packages', 'cli'), join(scoped, 'cli'), 'dir');
}

describe('dev server', () => {
  it('serves the SSR app and transformed modules over HTTP', async () => {
    const base = await mkdtemp(join(tmpdir(), 'streetui-dev-'));
    cleanups.push(() => rm(base, { recursive: true, force: true }));
    const projectRoot = join(base, 'dev-app');
    await createProject({ targetDir: projectRoot, template: 'ssr', frameworkVersion: '3.0.2', logger: noopLogger });
    await wireDependencies(projectRoot);
    const project = await resolveProject(projectRoot, { requireEntry: true });

    const server = await createDevServer({ project, logger: noopLogger });
    cleanups.push(() => server.stop());

    const home = await fetch(`${server.url}/`);
    const html = await home.text();
    expect(home.status).toBe(200);
    expect(html).toContain('id="app"');
    expect(html).toContain('dev-app');
    expect(html).toContain('/@streetui/client/hmr.js');

    const main = await fetch(`${server.url}/src/main.ts`);
    expect(main.status).toBe(200);
    const js = await main.text();
    expect(js).toContain('/@streetui/pkg/');
    expect(js).not.toContain("from '@streetui/");

    const hmr = await fetch(`http://127.0.0.1:${server.port}/@streetui/client/hmr.js`);
    expect(hmr.status).toBe(200);
    expect(hmr.headers.get('content-type')).toContain('javascript');

    const styles = await fetch(`${server.url}/styles.css`);
    expect(styles.status).toBe(200);
    expect(styles.headers.get('content-type')).toContain('css');
  });

  it('reports a clear diagnostic for a CommonJS module', async () => {
    const base = await mkdtemp(join(tmpdir(), 'streetui-dev-cjs-'));
    cleanups.push(() => rm(base, { recursive: true, force: true }));
    const projectRoot = join(base, 'dev-app');
    await createProject({ targetDir: projectRoot, template: 'ssr', frameworkVersion: '3.0.2', logger: noopLogger });
    await wireDependencies(projectRoot);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(projectRoot, 'src', 'legacy.cjs'), 'module.exports = {};', 'utf8');
    const project = await resolveProject(projectRoot, { requireEntry: true });

    const server = await createDevServer({ project, logger: noopLogger });
    cleanups.push(() => server.stop());

    const res = await fetch(`http://127.0.0.1:${server.port}/src/legacy.cjs`);
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain('CommonJS');
    expect(body).toContain('legacy.cjs');
  });
});
