/**
 * Server-side rendering runner for `streetui dev`.
 *
 * Node cannot import TypeScript, so the SSR graph is transpiled to a fresh
 * temporary directory (preserving relative structure) and imported from there.
 * Each rebuild uses a new directory so ESM's module cache cannot serve stale
 * code. The directory lives under `node_modules/.cache` so bare `@streetui/*`
 * imports still resolve against the project's dependencies.
 */

import { existsSync } from 'node:fs';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BuildProblem } from '../../diagnostics.js';
import { crawl } from '../graph/crawl.js';
import { createResolver, type ModuleFormat, type ResolverOptions } from '../resolve/resolver.js';
import { transformModule, serverOutputPath, relativeOutputSpecifier, type ResolveTarget } from '../transform/typescript.js';

export interface RenderRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string | string[] | undefined>;
}

export interface RenderResult {
  readonly html: string;
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

export type RenderFn = (request: RenderRequest) => RenderResult | Promise<RenderResult>;

export interface SsrRunnerOptions {
  readonly root: string;
  readonly serverEntry: string;
  readonly cacheDir: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly resolver?: ResolverOptions;
}

export interface SsrRunner {
  render(request: RenderRequest): Promise<RenderResult>;
  reload(): Promise<void>;
  close(): Promise<void>;
  readonly diagnostics: readonly BuildProblem[];
  /** Files reachable from the server entry (used to decide dev reloads). */
  getFiles(): ReadonlySet<string>;
}

interface BuiltServer {
  readonly dir: string;
  readonly render: RenderFn;
}

/** True when `file` lives inside a `node_modules` directory. */
function isDependencyFile(file: string): boolean {
  return file.split(/[/\\]/).includes('node_modules');
}

export function createSsrRunner(options: SsrRunnerOptions): SsrRunner {
  const resolver = createResolver({ root: options.root, ...(options.resolver ?? {}) });
  let built: BuiltServer | undefined;
  let diagnostics: BuildProblem[] = [];
  let files = new Set<string>();
  let buildCounter = 0;
  // Serialize builds so concurrent watcher events never leave a torn temp dir
  // (e.g. a server.js referencing a module that was skipped mid-write).
  let inflight = Promise.resolve();

  const resolveSpecifier = (
    specifier: string,
    importerFile: string,
    importerOutput: string,
  ): ResolveTarget | undefined => {
    if (specifier.startsWith('node:')) return undefined;
    const resolved = resolver.resolveNode(specifier, importerFile);
    if (resolved === undefined) return undefined;
    const dependencyOutput = serverOutputPath(options.root, resolved.file, options.serverEntry);
    return {
      url: relativeOutputSpecifier(importerOutput, dependencyOutput),
      kind: resolved.kind,
      id: resolved.file,
    };
  };

  const build = async (): Promise<BuiltServer> => {
    const packageDirs = new Set<string>();
    const formats = new Map<string, ModuleFormat>();
    const { graph, diagnostics: crawlDiagnostics } = crawl({
      entry: options.serverEntry,
      root: options.root,
      mode: 'production',
      ...(options.resolver !== undefined ? { resolver: options.resolver } : {}),
      resolveSpecifier: (specifier, importerFile) => {
        const resolved = resolver.resolveNode(specifier, importerFile);
        if (resolved === undefined || resolved.kind === 'builtin') return undefined;
        if (resolved.pkgDir !== undefined) packageDirs.add(resolved.pkgDir);
        if (resolved.format !== undefined) formats.set(resolved.file, resolved.format);
        return { file: resolved.file, kind: resolved.kind };
      },
    });
    diagnostics = [...crawlDiagnostics];
    files = new Set(graph.nodes.keys());

    const buildId = `${Date.now().toString(36)}-${(buildCounter++).toString(36)}`;
    const outDir = join(options.cacheDir, 'ssr', buildId);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');

    for (const id of graph.postOrder(options.serverEntry)) {
      const node = graph.get(id);
      if (node === undefined) continue;
      if (node.kind !== 'ts' && node.kind !== 'js') continue;

      // The cache is emitted as one ESM tree. A CommonJS dependency cannot be
      // represented there: its `require()` calls are not part of the ESM graph
      // crawl, so a rewritten copy would ship with unresolved dependencies and
      // Node would treat it as ESM. Report it instead of failing later with a
      // confusing "Named export not found".
      if (isDependencyFile(node.file) && formats.get(node.file) === 'cjs') {
        diagnostics = [
          ...diagnostics,
          {
            message:
              `Cannot server-render CommonJS dependency "${relative(options.root, node.file)}": ` +
              'the SSR cache is an ES module tree. Use an ESM build of this package.',
            file: node.file,
          },
        ];
        continue;
      }

      const outputPath = serverOutputPath(options.root, node.file, options.serverEntry);
      const importerOutput = join(outDir, outputPath);

      const transform = transformModule(node.source, {
        fileName: node.file,
        moduleId: node.id,
        // The server graph is emitted for Node; it must never contain CSS/asset
        // imports (browser-only). Production-mode transform strips them.
        mode: 'production',
        env: options.env ?? {},
        resolve: (specifier) => resolveSpecifier(specifier, node.file, outputPath),
        resolveId: (specifier) => {
          const resolved = resolver.resolveNode(specifier, node.file);
          return resolved?.file;
        },
      });

      if (transform.diagnostics.length > 0) {
        diagnostics = [...diagnostics, ...transform.diagnostics];
        continue;
      }

      const target = join(outDir, outputPath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, transform.code, 'utf8');
    }

    // Node 18 has no ESM syntax detection for ambiguous .js files. Preserve
    // dependency package boundaries so copied ESM keeps its "type":"module".
    for (const pkgDir of packageDirs) {
      const source = join(pkgDir, 'package.json');
      if (!existsSync(source)) continue;
      const target = join(outDir, relative(options.root, source));
      await mkdir(dirname(target), { recursive: true });
      await copyFile(source, target);
    }

    // A skipped module leaves a hole in the emitted graph, and importing it
    // would fail later with a confusing "Cannot find module". Report the real
    // problem (syntax error, unresolvable import) instead.
    if (diagnostics.length > 0) {
      const first = diagnostics[0];
      const where = first?.file !== undefined ? ` in ${relative(options.root, first.file)}` : '';
      throw new Error(`SSR build failed${where}: ${first?.message ?? 'unknown error'}`);
    }

    // Every dependency package that contributed modules must keep its manifest,
    // otherwise Node 18 misreads its ESM files as CommonJS.
    const missingManifests = [...packageDirs].filter((pkgDir) => {
      const source = join(pkgDir, 'package.json');
      if (!existsSync(source)) return false;
      return !existsSync(join(outDir, relative(options.root, source)));
    });
    if (missingManifests.length > 0) {
      throw new Error(
        `SSR cache is missing package manifests for: ${missingManifests
          .map((dir) => relative(options.root, dir))
          .join(', ')}`,
      );
    }

    const entryOutput = join(outDir, serverOutputPath(options.root, options.serverEntry, options.serverEntry));
    const mod = (await import(pathToFileURL(entryOutput).href)) as {
      render?: RenderFn;
      default?: RenderFn | { render?: RenderFn };
    };
    const render =
      mod.render ?? (typeof mod.default === 'function' ? mod.default : mod.default?.render);
    if (typeof render !== 'function') {
      throw new Error(`Server entry ${options.serverEntry} must export a "render(request)" function.`);
    }
    return { dir: outDir, render };
  };

  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = inflight.then(fn, fn);
    inflight = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const ensureBuilt = async (): Promise<BuiltServer> => {
    if (built === undefined) built = await enqueue(build);
    return built;
  };

  return {
    get diagnostics() {
      return diagnostics;
    },
    async render(request) {
      const current = await ensureBuilt();
      return current.render(request);
    },
    async reload() {
      await enqueue(async () => {
        const next = await build();
        const previous = built;
        built = next;
        if (previous !== undefined && previous.dir !== next.dir) {
          await rm(previous.dir, { recursive: true, force: true }).catch(() => undefined);
        }
      });
    },
    async close() {
      if (built === undefined) return;
      await rm(built.dir, { recursive: true, force: true }).catch(() => undefined);
      built = undefined;
    },
    getFiles() {
      return files;
    },
  };
}

/** True when a path is inside the SSR cache root (so the watcher ignores it). */
export function isSsrCachePath(file: string, cacheDir: string): boolean {
  const rel = relative(cacheDir, file);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('..' + '/'));
}