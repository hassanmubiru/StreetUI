import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProject } from './create.js';
import type { Logger } from './logger.js';

const noopLogger: Logger = {
  info() {}, success() {}, warn() {}, error() {}, plain() {},
};

const tmpDirs: string[] = [];
async function scratch(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'streetui-create-'));
  tmpDirs.push(d);
  return d;
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('createProject', () => {
  it('scaffolds the SSR template with the expected files', async () => {
    const base = await scratch();
    const target = join(base, 'my-app');
    const result = await createProject({
      targetDir: target,
      template: 'ssr',
      frameworkVersion: '0.6.0',
      logger: noopLogger,
    });
    expect(result.template).toBe('ssr');
    for (const f of ['package.json', 'tsconfig.json', 'streetui.config.ts', 'README.md']) {
      expect(existsSync(join(target, f)), `${f} exists`).toBe(true);
    }
    expect(existsSync(join(target, 'src', 'app.ts'))).toBe(true);
    expect(existsSync(join(target, 'src', 'main.ts'))).toBe(true);
    expect(existsSync(join(target, 'src', 'server.ts'))).toBe(true);
    expect(existsSync(join(target, 'public'))).toBe(true);
  });

  it('materialises _gitignore as .gitignore and _package.json as package.json', async () => {
    const base = await scratch();
    const target = join(base, 'app');
    await createProject({ targetDir: target, frameworkVersion: '0.6.0', logger: noopLogger });
    expect(existsSync(join(target, '.gitignore'))).toBe(true);
    expect(existsSync(join(target, '_gitignore'))).toBe(false);
    expect(existsSync(join(target, '_package.json'))).toBe(false);
  });

  it('substitutes tokens: project name and framework version, leaving none behind', async () => {
    const base = await scratch();
    const target = join(base, 'cool-app');
    await createProject({
      targetDir: target,
      frameworkVersion: '0.6.0',
      logger: noopLogger,
    });
    const pkg = await readFile(join(target, 'package.json'), 'utf8');
    const parsed = JSON.parse(pkg) as { name: string; devDependencies?: Record<string, string> };
    expect(parsed.name).toBe('cool-app');
    // no unreplaced placeholders anywhere in the generated tree
    const all = await collectText(target);
    expect(all).not.toContain('__PROJECT_NAME__');
    expect(all).not.toContain('__FRAMEWORK_VERSION__');
  });

  it('scaffolds the basic template on request', async () => {
    const base = await scratch();
    const target = join(base, 'basic-app');
    const result = await createProject({
      targetDir: target,
      template: 'basic',
      frameworkVersion: '0.6.0',
      logger: noopLogger,
    });
    expect(result.template).toBe('basic');
    expect(existsSync(join(target, 'src', 'app.ts'))).toBe(true);
  });

  it('refuses to scaffold into a non-empty directory', async () => {
    const base = await scratch();
    const target = join(base, 'occupied');
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'existing.txt'), 'hi', 'utf8');
    await expect(
      createProject({ targetDir: target, frameworkVersion: '0.6.0', logger: noopLogger }),
    ).rejects.toThrow();
  });

  it('rejects an unknown template', async () => {
    const base = await scratch();
    const target = join(base, 'x');
    await expect(
      createProject({
        targetDir: target,
        template: 'nope',
        frameworkVersion: '0.6.0',
        logger: noopLogger,
      }),
    ).rejects.toThrow(/Unknown template/);
  });
});

/** Concatenate every text file under a directory for placeholder scanning. */
async function collectText(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  let out = '';
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out += await collectText(full);
    else if (/\.(ts|json|css|md|svg|html)$/.test(e.name) || e.name.startsWith('.')) {
      out += await readFile(full, 'utf8');
    }
  }
  return out;
}
