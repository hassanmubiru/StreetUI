import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createResolver } from './resolve/resolver.js';
import { ModuleGraph } from './graph/graph.js';
import { crawl } from './graph/crawl.js';

/**
 * Third-party npm compatibility fixtures (purpose-built, offline-safe).
 * Covers the shapes the matrix documents: conditional exports, browser
 * condition, subpath imports (#), nested deps, dual ESM/CJS, and circular deps.
 */
describe('third-party compatibility', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'streetui-compat-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'node_modules', '@scope', 'browser-pkg'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'subpath-pkg'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'nested-a', 'node_modules', 'nested-b'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'imports-pkg'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'dual-pkg'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), 'export {}', 'utf8');

    // Conditional exports with a browser condition.
    await writeFile(
      join(root, 'node_modules', '@scope', 'browser-pkg', 'package.json'),
      JSON.stringify({
        name: '@scope/browser-pkg',
        version: '1.0.0',
        exports: {
          '.': { browser: './browser.js', import: './node.js', default: './index.js' },
        },
      }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', '@scope', 'browser-pkg', 'browser.js'), 'export const env = "browser";', 'utf8');
    await writeFile(join(root, 'node_modules', '@scope', 'browser-pkg', 'node.js'), 'export const env = "node";', 'utf8');
    await writeFile(join(root, 'node_modules', '@scope', 'browser-pkg', 'index.js'), 'export const env = "default";', 'utf8');

    // Subpath exports + a #-imports map.
    await writeFile(
      join(root, 'node_modules', 'subpath-pkg', 'package.json'),
      JSON.stringify({
        name: 'subpath-pkg',
        version: '1.0.0',
        exports: { '.': './index.js', './feature': './feature.js' },
      }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'subpath-pkg', 'index.js'), 'export const root = 1;', 'utf8');
    await writeFile(join(root, 'node_modules', 'subpath-pkg', 'feature.js'), 'export const f = 2;', 'utf8');

    await writeFile(
      join(root, 'node_modules', 'imports-pkg', 'package.json'),
      JSON.stringify({
        name: 'imports-pkg',
        version: '1.0.0',
        type: 'module',
        imports: { '#internal': './internal.js' },
        exports: { '.': './index.js' },
      }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'imports-pkg', 'index.js'), 'import "./internal.js"; export const i = 1;', 'utf8');
    await writeFile(join(root, 'node_modules', 'imports-pkg', 'internal.js'), 'export const hidden = true;', 'utf8');

    // Nested dependency: nested-a depends on nested-b inside its own node_modules.
    await writeFile(
      join(root, 'node_modules', 'nested-a', 'package.json'),
      JSON.stringify({ name: 'nested-a', version: '1.0.0', type: 'module', dependencies: { 'nested-b': '1.0.0' }, exports: { '.': './index.js' } }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'nested-a', 'index.js'), 'import "nested-b"; export const a = 1;', 'utf8');
    await writeFile(
      join(root, 'node_modules', 'nested-a', 'node_modules', 'nested-b', 'package.json'),
      JSON.stringify({ name: 'nested-b', version: '1.0.0', type: 'module', exports: { '.': './index.js' } }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'nested-a', 'node_modules', 'nested-b', 'index.js'), 'export const b = 2;', 'utf8');

    // Dual ESM/CommonJS package.
    await writeFile(
      join(root, 'node_modules', 'dual-pkg', 'package.json'),
      JSON.stringify({
        name: 'dual-pkg',
        version: '1.0.0',
        exports: { '.': { import: './index.mjs', require: './index.cjs' } },
      }),
      'utf8',
    );
    await writeFile(join(root, 'node_modules', 'dual-pkg', 'index.mjs'), 'export const esm = true;', 'utf8');
    await writeFile(join(root, 'node_modules', 'dual-pkg', 'index.cjs'), 'module.exports = {};', 'utf8');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const resolver = () => createResolver({ root });
  const importer = () => join(root, 'src', 'index.ts');

  it('picks the browser condition over import/default', () => {
    const resolved = resolver().resolveBrowser('@scope/browser-pkg', importer());
    expect(resolved?.file).toBe(join(root, 'node_modules', '@scope', 'browser-pkg', 'browser.js'));
  });

  it('resolves a package subpath export', () => {
    expect(resolver().resolveBrowser('subpath-pkg/feature', importer())?.file).toBe(
      join(root, 'node_modules', 'subpath-pkg', 'feature.js'),
    );
  });

  it('resolves a package #-import from inside the package', () => {
    const where = join(root, 'node_modules', 'imports-pkg', 'index.js');
    expect(resolver().resolveBrowser('#internal', where)?.file).toBe(
      join(root, 'node_modules', 'imports-pkg', 'internal.js'),
    );
  });

  it('resolves a nested dependency from the nest package scope', () => {
    const where = join(root, 'node_modules', 'nested-a', 'index.js');
    expect(resolver().resolveBrowser('nested-b', where)?.file).toBe(
      join(root, 'node_modules', 'nested-a', 'node_modules', 'nested-b', 'index.js'),
    );
  });

  it('selects the ESM branch of a dual package in the browser', () => {
    const resolved = resolver().resolveBrowser('dual-pkg', importer());
    expect(resolved?.file).toBe(join(root, 'node_modules', 'dual-pkg', 'index.mjs'));
    expect(resolved?.format).toBe('esm');
  });

  it('detects cycles in a fixture graph', async () => {
    await mkdir(join(root, 'src', 'a'), { recursive: true });
    await mkdir(join(root, 'src', 'b'), { recursive: true });
    await writeFile(join(root, 'src', 'a', 'x.ts'), 'import "../b/y.js"; export const x = 1;', 'utf8');
    await writeFile(join(root, 'src', 'b', 'y.ts'), 'import "../a/x.js"; export const y = 1;', 'utf8');
    const { graph } = crawl({ entry: join(root, 'src', 'a', 'x.ts'), root, mode: 'development' });
    expect(graph.detectCycles().length).toBeGreaterThan(0);
  });

  it('builds a complete graph of mixed dependencies', async () => {
    await writeFile(
      join(root, 'src', 'index.ts'),
      [
        'import "@scope/browser-pkg";',
        'import "subpath-pkg/feature";',
        'import "nested-a";',
        'import "dual-pkg";',
        'export const ok = true;',
      ].join('\n'),
      'utf8',
    );
    const { graph, diagnostics } = crawl({ entry: join(root, 'src', 'index.ts'), root, mode: 'development' });
    expect(diagnostics).toHaveLength(0);
    expect(graph.nodes.size).toBeGreaterThanOrEqual(4);
  });
});

describe('module graph helpers', () => {
  it('walks postOrder dependencies-before-importers', () => {
    const g = new ModuleGraph('/root');
    for (const id of ['/app', '/util', '/dep']) {
      g.add({ id, url: id, file: id, kind: 'ts', source: '', contentHash: '', mtimeMs: 0, dependencies: new Map(), importers: new Set(), state: 'clean', hmrAccepted: false });
    }
    g.connect('/app', './util', '/util');
    g.connect('/util', './dep', '/dep');
    expect(g.postOrder('/app')).toEqual(['/dep', '/util', '/app']);
  });
});
