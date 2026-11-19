import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createResolver, fileToUrl, urlToFile } from './resolver.js';

describe('module resolver', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'streetui-resolver-'));
    await mkdir(join(root, 'src', 'components'), { recursive: true });
    await mkdir(join(root, 'node_modules', '@scope', 'pkg', 'dist'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), 'export const x = 1;', 'utf8');
    await writeFile(join(root, 'src', 'components', 'Header.ts'), 'export const h = 1;', 'utf8');
    await writeFile(join(root, 'src', 'styles.css'), 'body{}', 'utf8');
    await writeFile(join(root, 'src', 'logo.svg'), '<svg/>', 'utf8');
    await writeFile(
      join(root, 'node_modules', '@scope', 'pkg', 'package.json'),
      JSON.stringify({ name: '@scope/pkg', main: 'dist/index.js' }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', '@scope', 'pkg', 'dist', 'index.js'), 'export const p=1;', 'utf8');
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const resolver = () => createResolver({ root });

  it('resolves a relative .js specifier to a .ts file', () => {
    const resolved = resolver().resolveBrowser('./index.js', join(root, 'src', 'index.ts'));
    expect(resolved?.file).toBe(join(root, 'src', 'index.ts'));
    expect(resolved?.kind).toBe('ts');
  });

  it('resolves an alias via tsconfig-style wildcard', () => {
    const r = createResolver({ root, aliases: { '@/*': 'src/*' } });
    const resolved = r.resolveBrowser('@/components/Header', join(root, 'src', 'index.ts'));
    expect(resolved?.file).toBe(join(root, 'src', 'components', 'Header.ts'));
  });

  it('resolves a scoped package through its main entry', () => {
    const resolved = resolver().resolveBrowser('@scope/pkg', join(root, 'src', 'index.ts'));
    expect(resolved?.file).toBe(join(root, 'node_modules', '@scope', 'pkg', 'dist', 'index.js'));
  });

  it('resolves CSS and assets by extension', () => {
    expect(resolver().resolveBrowser('./styles.css', join(root, 'src', 'index.ts'))?.kind).toBe('css');
    expect(resolver().resolveBrowser('./logo.svg', join(root, 'src', 'index.ts'))?.kind).toBe('asset');
  });

  it('returns builtin for node: imports', () => {
    expect(resolver().resolveBrowser('node:fs', join(root, 'src', 'index.ts'))?.kind).toBe('builtin');
  });

  it('rejects paths outside the root', () => {
    expect(resolver().resolveBrowser('../../etc/passwd', join(root, 'src', 'index.ts'))).toBeUndefined();
  });

  it('round-trips file URLs', () => {
    const file = join(root, 'src', 'components', 'Header.ts');
    const url = fileToUrl(file, root);
    expect(url).toBe('/src/components/Header.ts');
    expect(urlToFile(url as string, root)).toBe(file);
  });

  it('classifies CJS vs ESM package modules', async () => {
    await mkdir(join(root, 'node_modules', 'cjs-pkg', 'dist'), { recursive: true });
    await writeFile(
      join(root, 'node_modules', 'cjs-pkg', 'package.json'),
      JSON.stringify({ name: 'cjs-pkg', main: 'dist/index.js' }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'cjs-pkg', 'dist', 'index.js'), 'module.exports = {};', 'utf8');
    await mkdir(join(root, 'node_modules', 'esm-pkg', 'dist'), { recursive: true });
    await writeFile(
      join(root, 'node_modules', 'esm-pkg', 'package.json'),
      JSON.stringify({ name: 'esm-pkg', type: 'module', main: 'dist/index.js' }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'esm-pkg', 'dist', 'index.js'), 'export default {};', 'utf8');

    expect(resolver().resolveBrowser('cjs-pkg', join(root, 'src', 'index.ts'))?.format).toBe('cjs');
    expect(resolver().resolveBrowser('esm-pkg', join(root, 'src', 'index.ts'))?.format).toBe('esm');
    expect(resolver().resolveBrowser('cjs-pkg', join(root, 'src', 'index.ts'))?.pkgName).toBe('cjs-pkg');
  });

  it('classifies a type-less CJS package correctly when the host app is type:module', async () => {
    // The host app uses "type":"module"; a dependency without `type` must still
    // be classified CJS (not inherit the app's module type).
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'host', type: 'module' }), 'utf8');
    await mkdir(join(root, 'node_modules', 'no-type-pkg', 'dist'), { recursive: true });
    await writeFile(
      join(root, 'node_modules', 'no-type-pkg', 'package.json'),
      JSON.stringify({ name: 'no-type-pkg', main: 'dist/index.js' }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'no-type-pkg', 'dist', 'index.js'), 'module.exports = {};', 'utf8');
    expect(resolver().resolveBrowser('no-type-pkg', join(root, 'src', 'index.ts'))?.format).toBe('cjs');
  });

  it('prefers the ESM branch of a dual package and honors nested package.json boundaries', async () => {
    await mkdir(join(root, 'node_modules', 'dual-pkg'), { recursive: true });
    await writeFile(
      join(root, 'node_modules', 'dual-pkg', 'package.json'),
      JSON.stringify({
        name: 'dual-pkg',
        type: 'module',
        exports: { '.': { import: './index.mjs', require: './index.cjs' } },
      }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'dual-pkg', 'index.mjs'), 'export default {};', 'utf8');
    await writeFile(join(root, 'node_modules', 'dual-pkg', 'index.cjs'), 'module.exports = {};', 'utf8');

    // The ESM branch (index.mjs) -> esm.
    const esm = resolver().resolveBrowser('dual-pkg', join(root, 'src', 'index.ts'));
    expect(esm?.file).toBe(join(root, 'node_modules', 'dual-pkg', 'index.mjs'));
    expect(esm?.format).toBe('esm');

    // A nested CommonJS package under a `type:module` parent must still be CJS.
    await mkdir(join(root, 'node_modules', 'parent-pkg', 'node_modules', 'nested-cjs'), { recursive: true });
    await writeFile(join(root, 'node_modules', 'parent-pkg', 'package.json'), JSON.stringify({ name: 'parent-pkg', type: 'module' }), 'utf8');
    await writeFile(
      join(root, 'node_modules', 'parent-pkg', 'node_modules', 'nested-cjs', 'package.json'),
      JSON.stringify({ name: 'nested-cjs', main: 'index.js' }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'parent-pkg', 'node_modules', 'nested-cjs', 'index.js'), 'module.exports = {};', 'utf8');
    const nested = resolver().resolveBrowser('nested-cjs', join(root, 'node_modules', 'parent-pkg', 'index.js'));
    expect(nested?.format).toBe('cjs');
  });

  it('resolves browser-condition exports to the ESM browser entry', async () => {
    await mkdir(join(root, 'node_modules', 'br-pkg'), { recursive: true });
    await writeFile(
      join(root, 'node_modules', 'br-pkg', 'package.json'),
      JSON.stringify({
        name: 'br-pkg',
        exports: { '.': { browser: './browser.mjs', node: './node.cjs', default: './index.mjs' } },
      }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'br-pkg', 'browser.mjs'), 'export const b = 1;', 'utf8');
    await writeFile(join(root, 'node_modules', 'br-pkg', 'node.cjs'), 'module.exports = {};', 'utf8');
    const browserRes = resolver().resolveBrowser('br-pkg', join(root, 'src', 'index.ts'));
    expect(browserRes?.file).toBe(join(root, 'node_modules', 'br-pkg', 'browser.mjs'));
    expect(browserRes?.format).toBe('esm');
  });
});
