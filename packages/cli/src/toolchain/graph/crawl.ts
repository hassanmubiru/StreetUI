/**
 * Lazy module-graph construction. The crawl starts at an entry and resolves
 * every static, export-from, and dynamic import. It does not execute code.
 */

import { readFileSync, statSync } from 'node:fs';
import type { BuildProblem } from '../../diagnostics.js';
import type { ResolverOptions } from '../resolve/resolver.js';
import { createResolver, fileToUrl } from '../resolve/resolver.js';
import { ModuleGraph, hashContent, type ModuleNode } from './graph.js';
import { collectSpecifiers, usesHotApi } from '../transform/typescript.js';

export interface CrawlOptions {
  readonly entry: string;
  readonly root: string;
  readonly mode: 'development' | 'production';
  readonly resolver?: ResolverOptions;
  readonly resolveSpecifier?: (specifier: string, importerFile: string) => { file: string; kind: ModuleNode['kind'] } | undefined;
  readonly readFile?: (file: string) => string;
  readonly shouldRecurse?: (file: string) => boolean;
}

export interface CrawlResult {
  readonly graph: ModuleGraph;
  readonly entryId: string;
  readonly diagnostics: readonly BuildProblem[];
}

function mtimeOf(file: string): number {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

export function crawl(options: CrawlOptions): CrawlResult {
  const { entry, root, mode } = options;
  const resolver = createResolver({ root, ...(options.resolver ?? {}) });
  const graph = new ModuleGraph(root);
  const diagnostics: BuildProblem[] = [];
  const visited = new Set<string>();

  const resolveSpecifier = (specifier: string, importerFile: string): { file: string; kind: ModuleNode['kind'] } | undefined => {
    if (options.resolveSpecifier !== undefined) return options.resolveSpecifier(specifier, importerFile);
    const resolved = mode === 'production' ? resolver.resolveNode(specifier, importerFile) : resolver.resolveBrowser(specifier, importerFile);
    if (resolved === undefined || resolved.kind === 'builtin') return undefined;
    return { file: resolved.file, kind: resolved.kind };
  };

  const visit = (file: string): void => {
    if (visited.has(file)) return;
    visited.add(file);

    let source: string;
    try {
      source = options.readFile !== undefined ? options.readFile(file) : readFileSync(file, 'utf8');
    } catch (error) {
      diagnostics.push({
        message: `Could not read module ${file}: ${(error as Error).message}`,
        file,
      });
      return;
    }

    const url = fileToUrl(file, root);
    if (url === undefined) {
      diagnostics.push({ message: `Module is outside the project root and cannot be served: ${file}`, file });
      return;
    }

    const kind = kindOf(file);
    const node = graph.add({
      id: file,
      url,
      file,
      kind,
      source,
      contentHash: hashContent(source),
      mtimeMs: mtimeOf(file),
      dependencies: new Map(),
      importers: new Set(),
      state: 'clean',
      hmrAccepted: usesHotApi(source),
    });

    if (kind !== 'ts' && kind !== 'js') return;
    if (options.shouldRecurse !== undefined && !options.shouldRecurse(file)) return;

    for (const ref of collectSpecifiers(source, file)) {
      if (ref.text.startsWith('node:')) continue;
      const resolved = resolveSpecifier(ref.text, file);
      if (resolved === undefined) {
        diagnostics.push({
          message: `Could not resolve "${ref.text}" from ${file}`,
          file,
          suggestion: ref.text.startsWith('@streetui/')
            ? 'Run "npm install" so the StreetUI package is present in node_modules.'
            : 'Check the import path and file extension.',
        });
        continue;
      }
      visit(resolved.file);
      graph.connect(node.id, ref.text, resolved.file);
    }
  };

  visit(entry);
  return { graph, entryId: entry, diagnostics };
}

function kindOf(file: string): ModuleNode['kind'] {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  if (ext === '.css') return 'css';
  if (ext === '.json') return 'json';
  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') return 'ts';
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'js';
  return 'asset';
}