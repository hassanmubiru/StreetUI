/**
 * StreetUI's production builder.
 *
 * Uses the same resolver, module graph, and TypeScript transform as the dev
 * server. It is deliberately module-preserving: every reachable module is
 * emitted as ESM with rewritten relative specifiers, hashed filenames, an
 * extracted CSS bundle, emitted assets, source maps, and a manifest.
 *
 * There is no scope hoisting, tree shaking, or minification in v1. Those are
 * documented limitations, not silent promises.
 */

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, sep } from 'node:path';
import type { ResolvedProject } from '../../project.js';
import type { Logger } from '../../logger.js';
import type { EventLogger } from '../json/events.js';
import { makeEventId } from '../json/events.js';
import { CliError, formatBuildFailure, type BuildProblem } from '../../diagnostics.js';
import { crawl } from '../graph/crawl.js';
import { createResolver } from '../resolve/resolver.js';
import { formatForFile } from '../resolve/resolver.js';
import { shortHash, type ModuleNode } from '../graph/graph.js';
import {
  transformModule,
  serverOutputPath,
  relativeOutputSpecifier,
  externalSourceMap,
  type ResolveTarget,
} from '../transform/typescript.js';
import { writeManifest, type BuildManifest } from './manifest.js';

export interface BuildOptions {
  readonly project: ResolvedProject;
  readonly mode?: 'development' | 'production';
  readonly logger?: Logger;
  readonly events?: EventLogger;
  readonly sessionId?: string;
}

export interface BuildOutput {
  readonly clientDir: string;
  readonly serverDir: string;
  readonly manifest: BuildManifest;
  /** Absolute path to the emitted client entry. */
  readonly entryJs: string;
  /** Absolute path to the emitted server entry, when SSR is configured. */
  readonly serverEntry?: string;
  readonly fileCount: number;
  readonly durationMs: number;
}

interface ClientPlan {
  readonly entryId: string;
  readonly outputPath: Map<string, string>;
  readonly outputUrl: Map<string, string>;
  readonly css: string;
  readonly cssName: string;
  readonly assetFiles: Array<{ file: string; out: string }>;
  readonly jsModules: ModuleNode[];
}

function publicEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const result: Record<string, string> = { NODE_ENV: 'production' };
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('STREETUI_PUBLIC_') && value !== undefined) result[key] = value;
  }
  return result;
}

function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  let counter = 1;
  while (used.has(name)) name = `${base}-${counter++}`;
  used.add(name);
  return name;
}

export async function buildProject(options: BuildOptions): Promise<BuildOutput> {
  const started = Date.now();
  const { project, logger, events } = options;
  const sessionId = options.sessionId ?? makeEventId();
  const mode = options.mode ?? 'production';
  const config = project.config;
  const root = config.root;
  const env = publicEnv();
  const problems: BuildProblem[] = [];

  const resolver = createResolver({
    root,
    ...(config.extensions !== undefined ? { extensions: config.extensions } : {}),
    ...(config.aliases !== undefined ? { aliases: config.aliases } : {}),
  });

  events?.emit({
    event: 'compilation_started',
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: 'streetui',
    timestamp: new Date().toISOString(),
    mode,
  });

  await rm(config.outDir, { recursive: true, force: true });
  const clientDir = join(config.outDir, 'client');
  const serverDir = join(config.outDir, 'server');
  await mkdir(clientDir, { recursive: true });

  // ── Client graph ────────────────────────────────────────────────────────
  const clientCrawl = crawl({ entry: config.clientEntry, root, mode: 'production' });
  const clientGraph = clientCrawl.graph;
  problems.push(...clientCrawl.diagnostics);
  const entryNode = clientGraph.get(clientCrawl.entryId);
  if (entryNode === undefined) {
    throw new CliError(`Client entry could not be read: ${config.clientEntry}`);
  }

  const used = new Set<string>();
  const outputPath = new Map<string, string>();
  const outputUrl = new Map<string, string>();

  const assignJsName = (node: ModuleNode): string => {
    const name =
      node.id === clientCrawl.entryId
        ? uniqueName(`app-${shortHash(node.source)}.js`, used)
        : uniqueName(`${basename(node.file).replace(/\.[^.]+$/, '')}-${shortHash(node.source + node.file)}.js`, used);
    const path = `assets/${name}`;
    outputPath.set(node.id, path);
    outputUrl.set(node.id, `/${path}`);
    return name;
  };

  const jsModules = clientGraph.preOrder(clientCrawl.entryId).map((id) => clientGraph.get(id)).filter((node): node is ModuleNode => {
    if (node === undefined) return false;
    return node.kind === 'ts' || node.kind === 'js' || node.kind === 'json';
  });
  for (const node of jsModules) assignJsName(node);

  const cssNodes = clientGraph.cssInOrder(clientCrawl.entryId);
  const css = cssNodes.map((node) => node.source).join('\n');
  const cssName = uniqueName(`styles-${shortHash(css || entryNode.source)}.css`, used);
  const cssPath = `assets/${cssName}`;

  const assetNodes = clientGraph.assets(clientCrawl.entryId);
  const assetFiles: Array<{ file: string; out: string }> = [];
  for (const node of assetNodes) {
    const content = await readFile(node.file);
    const name = uniqueName(
      `${basename(node.file).replace(/\.[^.]+$/, '')}-${shortHash(node.source + node.file)}.${extname(node.file).slice(1)}`,
      used,
    );
    const out = `assets/${name}`;
    outputPath.set(node.id, out);
    outputUrl.set(node.id, `/${out}`);
    assetFiles.push({ file: node.file, out });
  }

  const resolveClientTarget = (specifier: string, importerFile: string, importerOutput: string): ResolveTarget | undefined => {
    const resolved = resolver.resolveBrowser(specifier, importerFile);
    if (resolved === undefined) return undefined;
    if (resolved.kind === 'css') {
      return { url: `/${cssPath}`, kind: 'css', id: resolved.file };
    }
    if (resolved.kind === 'asset') {
      const url = outputUrl.get(resolved.file);
      if (url === undefined) return undefined;
      return { url, kind: 'asset', id: resolved.file };
    }
    if (resolved.kind === 'json') {
      const out = outputPath.get(resolved.file);
      if (out === undefined) return undefined;
      return { url: relativeOutputSpecifier(importerOutput, out), kind: 'json', id: resolved.file };
    }
    const out = outputPath.get(resolved.file);
    if (out === undefined) return undefined;
    return { url: relativeOutputSpecifier(importerOutput, out), kind: resolved.kind, id: resolved.file };
  };

  // ── Emit client modules ─────────────────────────────────────────────────
  for (const node of jsModules) {
    const out = outputPath.get(node.id);
    if (out === undefined) continue;

    if (node.kind === 'json') {
      const target = join(clientDir, out);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, `export default ${node.source};\n`, 'utf8');
      continue;
    }

    // CommonJS cannot be emitted as browser ESM. Surface a clear diagnostic and
    // skip the module instead of producing broken output.
    if (node.kind === 'js' && formatForFile(node.file) === 'cjs') {
      const importer = [...node.importers][0];
      problems.push({
        message:
          `Module ${node.file} is CommonJS and cannot be bundled for the browser. ` +
          (importer !== undefined ? `Importing module: ${importer}. ` : '') +
          `Module format: CommonJS. ` +
          `Reason: StreetUI emits browser-native ESM; CommonJS package entry points ` +
          `are not converted. Choose an ESM entry (import/module condition or .mjs) ` +
          `or wrap the dependency in a small ESM adapter.`,
        file: node.file,
        importer,
      });
      continue;
    }

    const transform = transformModule(node.source, {
      fileName: node.file,
      moduleId: node.id,
      mode,
      env,
      resolve: (specifier) => resolveClientTarget(specifier, node.file, out),
      resolveId: (specifier) => resolver.resolveBrowser(specifier, node.file)?.file,
    });
    problems.push(...transform.diagnostics);
    if (transform.diagnostics.length > 0) continue;

    const target = join(clientDir, out);
    await mkdir(dirname(target), { recursive: true });
    const mapComment = transform.sourceMap !== undefined ? externalSourceMap(basename(out)) : '';
    await writeFile(target, `${transform.code}${mapComment}`, 'utf8');
    if (transform.sourceMap !== undefined) {
      await writeFile(`${target}.map`, transform.sourceMap, 'utf8');
    }
  }

  // ── Emit CSS + assets ───────────────────────────────────────────────────
  if (css.length > 0) {
    await mkdir(join(clientDir, 'assets'), { recursive: true });
    await writeFile(join(clientDir, cssPath), css, 'utf8');
  }
  for (const asset of assetFiles) {
    const target = join(clientDir, asset.out);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(asset.file, target);
  }

  // ── Manifest ────────────────────────────────────────────────────────────
  const entryOut = outputPath.get(entryNode.id) ?? 'assets/app.js';
  const manifest: BuildManifest = {
    schemaVersion: 1,
    framework: 'streetui',
    entry: {
      js: `/${entryOut}`,
      ...(css.length > 0 ? { css: `/${cssPath}` } : {}),
    },
    modules: Object.fromEntries(
      jsModules.map((node) => [node.id, `/${outputPath.get(node.id) ?? entryOut}`] as const),
    ),
    assets: Object.fromEntries(assetFiles.map((asset) => {
      const node = assetNodes.find((candidate) => candidate.file === asset.file);
      return [node?.id ?? asset.file, `/${asset.out}`] as const;
    })),
    dynamicImports: {},
  };
  await writeManifest(clientDir, manifest);

  // ── Client-only HTML ────────────────────────────────────────────────────
  if (!existsSync(config.serverEntry)) {
    const tags = [
      manifest.entry.css !== undefined ? `<link rel="stylesheet" href="${manifest.entry.css}" />` : '',
      `<script type="module" src="${manifest.entry.js}"></script>`,
    ]
      .filter((tag) => tag.length > 0)
      .join('\n    ');
    const html = [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
      `  ${tags}`,
      '</head>',
      '<body>',
      '  <div id="app"></div>',
      '</body>',
      '</html>',
      '',
    ].join('\n');
    await writeFile(join(clientDir, 'index.html'), html, 'utf8');
  }

  // ── Public directory ────────────────────────────────────────────────────
  if (existsSync(config.publicDir)) {
    await copyDir(config.publicDir, clientDir);
  }

  // ── Server build (SSR) ──────────────────────────────────────────────────
  let serverEntry: string | undefined;
  if (existsSync(config.serverEntry)) {
    const serverCrawl = crawl({ entry: config.serverEntry, root, mode: 'production' });
    problems.push(...serverCrawl.diagnostics);
    const serverGraph = serverCrawl.graph;
    await mkdir(serverDir, { recursive: true });
    await writeFile(join(serverDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');

    const serverResolve = (specifier: string, importerFile: string, importerOutput: string): ResolveTarget | undefined => {
      const isRelative = specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');
      const isAlias = Object.keys(resolver.aliases).some((key) =>
        key.endsWith('*') ? specifier.startsWith(key.slice(0, -1)) : specifier === key,
      );
      if (!isRelative && !isAlias) return undefined;
      const resolved = resolver.resolveNode(specifier, importerFile);
      if (resolved === undefined) return undefined;
      if (resolved.kind === 'css') return { url: '', kind: 'css', id: resolved.file };
      if (resolved.kind === 'asset') {
        const node = serverGraph.get(resolved.file);
        return { url: node?.url ?? '', kind: 'asset', id: resolved.file };
      }
      const dependencyOutput = serverOutputPath(root, resolved.file, config.serverEntry);
      return {
        url: relativeOutputSpecifier(importerOutput, dependencyOutput),
        kind: resolved.kind,
        id: resolved.file,
      };
    };

    for (const id of serverGraph.postOrder(config.serverEntry)) {
      const node = serverGraph.get(id);
      if (node === undefined) continue;
      if (node.kind !== 'ts' && node.kind !== 'js') continue;
      // Server output keeps bare package specifiers external (resolved by Node
      // from the installed project dependencies), so package modules are not
      // emitted into dist/server.
      if (node.file.includes(`${sep}node_modules${sep}`)) continue;

      const output = serverOutputPath(root, node.file, config.serverEntry);
      const transform = transformModule(node.source, {
        fileName: node.file,
        moduleId: node.id,
        mode,
        env,
        resolve: (specifier) => serverResolve(specifier, node.file, output),
        resolveId: (specifier) => resolver.resolveNode(specifier, node.file)?.file,
      });
      problems.push(...transform.diagnostics);
      if (transform.diagnostics.length > 0) continue;

      const target = join(serverDir, output);
      await mkdir(dirname(target), { recursive: true });
      const mapComment = transform.sourceMap !== undefined ? externalSourceMap(basename(target)) : '';
      await writeFile(target, `${transform.code}${mapComment}`, 'utf8');
      if (transform.sourceMap !== undefined) {
        await writeFile(`${target}.map`, transform.sourceMap, 'utf8');
      }
    }
    serverEntry = join(serverDir, 'server.js');
  }

  const blocking = problems.filter((problem) => problem.message.length > 0);
  if (blocking.length > 0) {
    throw new CliError(formatBuildFailure(blocking), {
      suggestion: 'Fix the reported errors and run "streetui build" again.',
    });
  }

  const durationMs = Date.now() - started;
  const fileCount = jsModules.length + assetFiles.length + cssNodes.length + (existsSync(config.serverEntry) ? 1 : 0);

  logger?.success(`Built ${fileCount} client modules → ${clientDir}`);
  events?.emit({
    event: 'build_completed',
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: 'streetui',
    timestamp: new Date().toISOString(),
    outDir: clientDir,
    files: fileCount,
    durationMs,
  });

  return {
    clientDir,
    serverDir,
    manifest,
    entryJs: join(clientDir, entryOut),
    ...(serverEntry !== undefined ? { serverEntry } : {}),
    fileCount,
    durationMs,
  };
}

async function copyDir(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) await copyDir(source, target);
    else if (entry.isFile()) await copyFile(source, target);
  }
}