import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir, readdir, readFile, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

/**
 * Every dependency package that contributed modules to the SSR cache must keep
 * its own `package.json` at its mirrored package root. Node 18 has no ESM syntax
 * detection and would otherwise fall back to the cache root manifest (`type:
 * module`) — or worse, to CommonJS — for the copied dependency files.
 */
async function packageDirsMissingManifest(cacheBuild: string): Promise<string[]> {
  const missing = new Set<string>();
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !/\.(js|cjs|mjs)$/.test(entry.name)) continue;
      const rel = full.slice(cacheBuild.length + 1).split(/[/\\]/);
      const marker = rel.indexOf('node_modules');
      if (marker < 0) continue;
      const after = rel.slice(marker + 1);
      const pkgSegments = after[0]!.startsWith('@') ? after.slice(0, 2) : after.slice(0, 1);
      const pkgRoot = join(cacheBuild, ...rel.slice(0, marker + 1), ...pkgSegments);
      if (!existsSync(join(pkgRoot, 'package.json'))) missing.add(pkgRoot);
    }
  };
  await walk(cacheBuild);
  return [...missing];
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

    const ssrCache = join(projectRoot, '.streetui-cache', 'ssr');
    const [buildId] = await readdir(ssrCache);
    const compilerPackage = JSON.parse(await readFile(
      join(ssrCache, buildId!, 'node_modules', '@streetui', 'compiler', 'package.json'),
      'utf8',
    )) as { type?: string };
    expect(compilerPackage.type).toBe('module');

    // No emitted package directory may be left without its manifest.
    expect(await packageDirsMissingManifest(join(ssrCache, buildId!))).toEqual([]);
    expect(existsSync(join(ssrCache, buildId!, 'node_modules', '@streetui', 'dsl', 'package.json'))).toBe(true);

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

  it('rebuilds SSR on change and reports the real error for a broken module', async () => {
    const base = await mkdtemp(join(tmpdir(), 'streetui-dev-ssr-'));
    cleanups.push(() => rm(base, { recursive: true, force: true }));
    const projectRoot = join(base, 'dev-app');
    await createProject({ targetDir: projectRoot, template: 'ssr', frameworkVersion: '3.0.2', logger: noopLogger });
    await wireDependencies(projectRoot);
    const { readFile, writeFile } = await import('node:fs/promises');
    const project = await resolveProject(projectRoot, { requireEntry: true });

    const errors: string[] = [];
    const server = await createDevServer({
      project,
      logger: { ...noopLogger, error: (message: string) => errors.push(message) },
    });
    cleanups.push(() => server.stop());

    const first = await fetch(`${server.url}/`);
    expect(first.status).toBe(200);
    const before = await first.text();
    expect(before).toContain('id="app"');

    // Valid change: the next response must reflect it (SSR cache regeneration).
    const appFile = join(projectRoot, 'src', 'app.ts');
    const original = await readFile(appFile, 'utf8');
    const marker = 'SSR rebuild marker';
    const patched = original.replace(/page\.heading\('([^']*)', \{ id: 'brand'/, `page.heading('${marker}', { id: 'brand'`);
    expect(patched).not.toBe(original);
    await writeFile(appFile, patched, 'utf8');

    let regenerated = false;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const html = await (await fetch(`${server.url}/`)).text();
      if (html.includes(marker)) {
        regenerated = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(regenerated).toBe(true);

    // Broken change: the error names the file and the syntax problem instead of
    // surfacing a confusing "Cannot find module" for a module never emitted.
    await writeFile(appFile, `${original}\nconst = ;\n`, 'utf8');
    let message = '';
    const errorDeadline = Date.now() + 20000;
    while (Date.now() < errorDeadline) {
      message = errors.find((line) => line.includes('SSR rebuild failed')) ?? '';
      if (message !== '') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(message).toContain('SSR build failed');
    expect(message).toContain('app.ts');
    expect(message).not.toContain('Cannot find module');

    await writeFile(appFile, original, 'utf8');
  });

  it('keeps exactly one SSR build directory across repeated reloads', async () => {
    const base = await mkdtemp(join(tmpdir(), 'streetui-dev-reload-'));
    cleanups.push(() => rm(base, { recursive: true, force: true }));
    const projectRoot = join(base, 'dev-app');
    await createProject({ targetDir: projectRoot, template: 'ssr', frameworkVersion: '3.0.2', logger: noopLogger });
    await wireDependencies(projectRoot);
    const { readFile, writeFile } = await import('node:fs/promises');
    const project = await resolveProject(projectRoot, { requireEntry: true });

    const server = await createDevServer({ project, logger: noopLogger });
    cleanups.push(() => server.stop());

    expect((await fetch(`${server.url}/`)).status).toBe(200);
    const appFile = join(projectRoot, 'src', 'app.ts');
    const original = await readFile(appFile, 'utf8');

    const waitForMarker = async (marker: string): Promise<void> => {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        const html = await (await fetch(`${server.url}/`)).text();
        if (html.includes(marker)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`marker "${marker}" never rendered`);
    };

    for (const marker of ['Reload one', 'Reload two']) {
      await writeFile(appFile, original.replace(/page\.heading\('([^']*)'/, `page.heading('${marker}'`), 'utf8');
      await waitForMarker(marker);
    }

    const ssrCache = join(projectRoot, '.streetui-cache', 'ssr');
    const builds = await readdir(ssrCache);
    expect(builds.length).toBe(1);

    await writeFile(appFile, original, 'utf8');
    await waitForMarker('dev-app');
  });

  it('reports a CommonJS dependency instead of emitting an unloadable cache module', async () => {
    const base = await mkdtemp(join(tmpdir(), 'streetui-dev-cjs-dep-'));
    cleanups.push(() => rm(base, { recursive: true, force: true }));
    const projectRoot = join(base, 'dev-app');
    await createProject({ targetDir: projectRoot, template: 'ssr', frameworkVersion: '3.0.2', logger: noopLogger });
    await wireDependencies(projectRoot);
    const { readFile, writeFile, mkdir: mk } = await import('node:fs/promises');

    const depDir = join(projectRoot, 'node_modules', 'legacy-dep');
    await mk(depDir, { recursive: true });
    await writeFile(join(depDir, 'package.json'), JSON.stringify({ name: 'legacy-dep', version: '1.0.0', main: 'index.js' }), 'utf8');
    await writeFile(join(depDir, 'index.js'), 'module.exports = { value: 1 };\n', 'utf8');

    const serverFile = join(projectRoot, 'src', 'server.ts');
    const originalServer = await readFile(serverFile, 'utf8');
    await writeFile(serverFile, `import legacyDep from 'legacy-dep';\n${originalServer}`, 'utf8');

    const project = await resolveProject(projectRoot, { requireEntry: true });
    const server = await createDevServer({ project, logger: noopLogger });
    cleanups.push(() => server.stop());

    const res = await fetch(`${server.url}/`);
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain('CommonJS dependency');
    expect(body).toContain('legacy-dep');
  });
});
