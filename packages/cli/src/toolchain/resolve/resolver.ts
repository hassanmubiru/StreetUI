/**
 * StreetUI's own module resolver. It understands project-relative imports,
 * TypeScript's `.js` → `.ts` convention, tsconfig-style aliases, package.json
 * `exports` conditions, CSS, JSON, and static assets. It has no third-party
 * dependencies and never executes resolver input.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import { isInside, safeDecode, toPosix } from './paths.js';

export type ModuleKind = 'ts' | 'js' | 'css' | 'asset' | 'json' | 'builtin';

export type ModuleFormat = 'esm' | 'cjs';

export interface ResolvedImport {
  readonly kind: ModuleKind;
  /** Absolute source path for file-backed modules; the specifier for builtins. */
  readonly file: string;
  /** How a file-backed module is emitted by its package (ESM vs CommonJS). */
  readonly format?: ModuleFormat | undefined;
  readonly pkgName?: string | undefined;
  readonly pkgDir?: string | undefined;
  readonly query?: string | undefined;
}

export interface ResolverOptions {
  /** Project root; every resolved file must live under it. */
  readonly root: string;
  /** Extensionless-import candidates. */
  readonly extensions?: readonly string[];
  /** Export conditions, in priority order. */
  readonly conditions?: readonly string[];
  /** Exact or wildcard aliases (targets are absolute or root-relative). */
  readonly aliases?: Readonly<Record<string, string>>;
}

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'] as const;
const BROWSER_CONDITIONS = ['browser', 'import', 'module', 'default'] as const;
const NODE_CONDITIONS = ['node', 'import', 'require', 'default'] as const;
const ASSET_EXTENSIONS = new Set([
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.webm', '.mp3', '.wav', '.pdf',
]);

export interface ResolvedResolver {
  readonly root: string;
  readonly extensions: readonly string[];
  readonly aliases: Readonly<Record<string, string>>;
  resolve(specifier: string, importerFile: string | undefined, mode: 'development' | 'production'): ResolvedImport | undefined;
  resolveBrowser(specifier: string, importerFile: string | undefined): ResolvedImport | undefined;
  resolveNode(specifier: string, importerFile: string | undefined): ResolvedImport | undefined;
}

export function kindForFile(file: string): ModuleKind {
  const ext = extname(file).toLowerCase();
  if (ext === '.css') return 'css';
  if (ext === '.json') return 'json';
  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') return 'ts';
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'js';
  if (ASSET_EXTENSIONS.has(ext)) return 'asset';
  return 'asset';
}

/**
 * Determine the module format of a file-backed module.
 *
 * `.mjs`/`.mts` are ESM; `.cjs`/`.cts` are CommonJS. Plain `.js`/`.ts`
 * depend on the nearest `package.json` `type` field (`module` → ESM,
 * `commonjs`/absent → CommonJS). This mirrors how Node decides module format
 * and lets the toolchain diagnose unsupported CommonJS package imports instead
 * of serving them as invalid ESM.
 */
export function formatForFile(file: string): ModuleFormat {
  const ext = extname(file).toLowerCase();
  if (ext === '.mjs' || ext === '.mts') return 'esm';
  if (ext === '.cjs' || ext === '.cts') return 'cjs';
  let dir = dirname(resolve(file));
  while (true) {
    const pkgJsonPath = join(dir, 'package.json');
    if (existsSync(pkgJsonPath)) {
      // The first package.json encountered is the one that owns this file; its
      // `type` decides the module format. Without `type`, the default is CJS.
      // Do NOT keep walking up to a parent package (e.g. the host app's
      // `"type":"module"`), which would misclassify a CommonJS dependency.
      try {
        const type_ = (JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { type?: string }).type;
        return type_ === 'module' ? 'esm' : 'cjs';
      } catch {
        return 'cjs';
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'cjs';
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function withExtensionCandidates(base: string, extensions: readonly string[]): string[] {
  const candidates: string[] = [base];
  // TypeScript's NodeNext convention: `./app.js` may refer to `app.ts`.
  if (base.endsWith('.js')) {
    const stem = base.slice(0, -3);
    candidates.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`);
  } else if (base.endsWith('.mjs')) {
    candidates.push(`${base.slice(0, -4)}.mts`);
  } else if (base.endsWith('.cjs')) {
    candidates.push(`${base.slice(0, -4)}.cts`);
  }
  for (const ext of extensions) {
    if (!extname(base)) candidates.push(`${base}${ext}`);
  }
  return candidates;
}

function resolveFile(base: string, extensions: readonly string[]): string | undefined {
  for (const candidate of withExtensionCandidates(base, extensions)) {
    if (isFile(candidate)) return candidate;
  }
  if (isDirectory(base)) {
    for (const ext of extensions) {
      const index = join(base, `index${ext}`);
      if (isFile(index)) return index;
    }
  }
  return undefined;
}

interface PackageRecord {
  readonly dir: string;
  readonly json: PackageJson;
}

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly exports?: unknown;
  readonly imports?: unknown;
  readonly module?: string;
  readonly main?: string;
  readonly browser?: unknown;
  readonly type?: string;
}

function findPackage(name: string, startDir: string, root: string): PackageRecord | undefined {
  let dir = resolve(startDir);
  while (true) {
    const candidate = join(dir, 'node_modules', name);
    if (isInside(root, candidate)) {
      const pkgJsonPath = join(candidate, 'package.json');
      if (existsSync(pkgJsonPath)) {
        try {
          return { dir: candidate, json: JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as PackageJson };
        } catch {
          return undefined;
        }
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function isSubpathMap(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).some((key) => key.startsWith('.'))
  );
}

function resolveExportTarget(
  target: unknown,
  pkgDir: string,
  conditions: readonly string[],
  star: string | undefined,
): string | undefined {
  if (typeof target === 'string') {
    const withStar = star === undefined ? target : target.split('*').join(star);
    if (!withStar.startsWith('./')) return undefined;
    return resolveFile(join(pkgDir, withStar.slice(2)), ['.js', '.mjs', '.cjs', '.json', '.ts']);
  }
  if (Array.isArray(target)) {
    for (const entry of target) {
      const resolved = resolveExportTarget(entry, pkgDir, conditions, star);
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  }
  if (typeof target === 'object' && target !== null) {
    const record = target as Record<string, unknown>;
    for (const condition of conditions) {
      if (condition in record) {
        const resolved = resolveExportTarget(record[condition], pkgDir, conditions, star);
        if (resolved !== undefined) return resolved;
      }
    }
    if ('default' in record) return resolveExportTarget(record.default, pkgDir, conditions, star);
  }
  return undefined;
}

function matchSubpath(
  exportsValue: unknown,
  subpath: string,
  pkgDir: string,
  conditions: readonly string[],
): string | undefined {
  if (typeof exportsValue === 'string' || Array.isArray(exportsValue) || !isSubpathMap(exportsValue)) {
    if (subpath !== '.') return undefined;
    return resolveExportTarget(exportsValue, pkgDir, conditions, undefined);
  }

  if (subpath in exportsValue) {
    return resolveExportTarget(exportsValue[subpath], pkgDir, conditions, undefined);
  }

  for (const [key, value] of Object.entries(exportsValue)) {
    const star = key.indexOf('*');
    if (star < 0) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= prefix.length + suffix.length) {
      const captured = subpath.slice(prefix.length, subpath.length - suffix.length);
      return resolveExportTarget(value, pkgDir, conditions, captured);
    }
  }
  return undefined;
}

function resolvePackage(
  name: string,
  subpath: string,
  startDir: string,
  root: string,
  conditions: readonly string[],
): ResolvedImport | undefined {
  const pkg = findPackage(name, startDir, root);
  if (pkg === undefined) return undefined;

  if (pkg.json.exports !== undefined) {
    const resolved = matchSubpath(pkg.json.exports, subpath, pkg.dir, conditions);
    if (resolved !== undefined) {
      return { kind: kindForFile(resolved), file: resolved, format: formatForFile(resolved), pkgName: name, pkgDir: pkg.dir };
    }
    // Exports maps are authoritative: an unmatched subpath is not resolved via
    // the legacy `main`/`module` fields.
    return undefined;
  }

  const legacy = subpath === '.' ? (pkg.json.module ?? pkg.json.main ?? 'index.js') : subpath;
  const resolved = resolveFile(join(pkg.dir, legacy), ['.js', '.mjs', '.cjs', '.json', '.ts']);
  if (resolved === undefined) return undefined;
  return { kind: kindForFile(resolved), file: resolved, format: formatForFile(resolved), pkgName: name, pkgDir: pkg.dir };
}

function resolveAlias(
  specifier: string,
  aliases: Readonly<Record<string, string>>,
  root: string,
  extensions: readonly string[],
): string | undefined {
  for (const [key, target] of Object.entries(aliases)) {
    if (key.endsWith('*')) {
      const prefix = key.slice(0, -1);
      if (specifier.startsWith(prefix)) {
        const rest = specifier.slice(prefix.length);
        const substituted = target.includes('*') ? target.split('*').join(rest) : join(target, rest);
        const absoluteTarget = isAbsolute(substituted) ? substituted : resolve(root, substituted);
        return resolveFile(absoluteTarget, extensions);
      }
    } else if (specifier === key) {
      const absoluteTarget = isAbsolute(target) ? target : resolve(root, target);
      return resolveFile(absoluteTarget, extensions);
    }
  }
  return undefined;
}

function findNearestPackage(startDir: string, root: string): PackageRecord | undefined {
  let dir = resolve(startDir);
  while (true) {
    const pkgJsonPath = join(dir, 'package.json');
    if (isInside(root, pkgJsonPath) && existsSync(pkgJsonPath)) {
      try {
        return { dir, json: JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as PackageJson };
      } catch {
        return undefined;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function resolvePackageImports(
  specifier: string,
  startDir: string,
  root: string,
  conditions: readonly string[],
): ResolvedImport | undefined {
  const pkg = findNearestPackage(startDir, root);
  const imports = pkg?.json.imports;
  if (imports === undefined || typeof imports !== 'object' || imports === null) return undefined;

  let target: unknown;
  if (Object.prototype.hasOwnProperty.call(imports, specifier)) {
    target = (imports as Record<string, unknown>)[specifier];
  } else {
    for (const [key, value] of Object.entries(imports as Record<string, unknown>)) {
      const star = key.indexOf('*');
      if (star < 0) continue;
      const prefix = key.slice(0, star);
      const suffix = key.slice(star + 1);
      if (specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length) {
        const captured = specifier.slice(prefix.length, specifier.length - suffix.length);
        target = typeof value === 'string' ? value.split('*').join(captured) : value;
        break;
      }
    }
  }

  if (target === undefined) return undefined;
  if (pkg === undefined) return undefined;
  const resolved = resolveExportTarget(target, pkg.dir, conditions, undefined);
  if (resolved === undefined) return undefined;
  return { kind: kindForFile(resolved), file: resolved, format: formatForFile(resolved), pkgName: pkg.json.name, pkgDir: pkg.dir };
}

function splitQuery(specifier: string): { path: string; query?: string } {
  const index = specifier.indexOf('?');
  if (index < 0) return { path: specifier };
  return { path: specifier.slice(0, index), query: specifier.slice(index + 1) };
}

function finish(
  file: string,
  kind: ModuleKind,
  pkg?: { name?: string | undefined; dir?: string | undefined },
  query?: string | undefined,
): ResolvedImport {
  return {
    kind,
    file,
    format: formatForFile(file),
    ...(pkg?.name !== undefined ? { pkgName: pkg.name } : {}),
    ...(pkg?.dir !== undefined ? { pkgDir: pkg.dir } : {}),
    ...(query !== undefined ? { query } : {}),
  };
}

export function createResolver(options: ResolverOptions): ResolvedResolver {
  const root = resolve(options.root);
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const aliases = options.aliases ?? {};
  const conditions = options.conditions ?? BROWSER_CONDITIONS;

  const resolveWith = (
    specifier: string,
    importerFile: string | undefined,
    conditionsForMode: readonly string[],
  ): ResolvedImport | undefined => {
    const { path, query } = splitQuery(specifier);
    if (path.length === 0) return undefined;
    if (path.startsWith('node:')) return finish(path, 'builtin', undefined, query);

    const withinRoot = (file: string | undefined): string | undefined =>
      file !== undefined && isInside(root, file) ? file : undefined;

    const alias = withinRoot(resolveAlias(path, aliases, root, extensions));
    if (alias !== undefined) return finish(alias, kindForFile(alias), undefined, query);

    if (path.startsWith('#')) {
      const resolved = resolvePackageImports(path, importerFile === undefined ? root : dirname(importerFile), root, conditionsForMode);
      if (resolved === undefined) return undefined;
      const file = withinRoot(resolved.file);
      return file === undefined ? undefined : finish(file, resolved.kind, { name: resolved.pkgName, dir: resolved.pkgDir }, query);
    }

    if (path.startsWith('/')) {
      const file = withinRoot(resolveFile(join(root, path), extensions));
      return file === undefined ? undefined : finish(file, kindForFile(file), undefined, query);
    }

    if (path.startsWith('./') || path.startsWith('../')) {
      const base = importerFile === undefined ? root : dirname(importerFile);
      const file = withinRoot(resolveFile(resolve(base, path), extensions));
      return file === undefined ? undefined : finish(file, kindForFile(file), undefined, query);
    }

    // Bare package specifier. A scoped package has two leading segments.
    const segments = path.split('/');
    const name = path.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
    if (name === undefined) return undefined;
    const subpath = `.${path.slice(name.length)}` || '.';
    const resolved = resolvePackage(name, subpath, importerFile === undefined ? root : dirname(importerFile), root, conditionsForMode);
    if (resolved === undefined) return undefined;
    const file = withinRoot(resolved.file);
    if (file === undefined) return undefined;
    return finish(file, resolved.kind, { name, dir: resolved.pkgDir }, query);
  };

  return {
    root,
    extensions,
    aliases,
    resolve: (specifier, importerFile) => resolveWith(specifier, importerFile, conditions),
    resolveBrowser: (specifier, importerFile) => resolveWith(specifier, importerFile, BROWSER_CONDITIONS),
    resolveNode: (specifier, importerFile) => resolveWith(specifier, importerFile, NODE_CONDITIONS),
  };
}

/** Convert an absolute source path into a browser URL. */
export function fileToUrl(file: string, root: string): string | undefined {
  const normalized = resolve(file);
  if (!isInside(root, normalized)) return undefined;
  const marker = `${sep}node_modules${sep}`;
  const index = normalized.indexOf(marker);
  if (index >= 0) {
    const after = normalized.slice(index + marker.length);
    const parts = after.split(sep);
    let name: string;
    let rest: string[];
    if (parts[0]?.startsWith('@')) {
      name = `${parts[0]}/${parts[1] ?? ''}`;
      rest = parts.slice(2);
    } else {
      name = parts[0] ?? '';
      rest = parts.slice(1);
    }
    return `/@streetui/pkg/${name}/${rest.join('/')}`;
  }
  return `/${toPosix(normalized.slice(root.length).replace(/^[/\\]/, ''))}`;
}

/** Map a browser module URL back to a file inside the project. */
export function urlToFile(url: string, root: string): string | undefined {
  const { path } = splitQuery(url);
  let decoded: string | undefined;
  try {
    decoded = safeDecode(path);
  } catch {
    return undefined;
  }
  if (decoded === undefined) return undefined;

  if (decoded.startsWith('/@streetui/pkg/')) {
    const rest = decoded.slice('/@streetui/pkg/'.length);
    const parts = rest.split('/');
    let name: string;
    let relative: string;
    if (rest.startsWith('@')) {
      name = `${parts[0] ?? ''}/${parts[1] ?? ''}`;
      relative = parts.slice(2).join('/');
    } else {
      name = parts[0] ?? '';
      relative = parts.slice(1).join('/');
    }
    const pkg = findPackage(name, root, root);
    if (pkg === undefined) return undefined;
    const file = resolve(pkg.dir, relative);
    return isInside(root, file) ? file : undefined;
  }

  if (decoded.startsWith('/@streetui/')) return undefined;
  const file = resolve(root, decoded.replace(/^\/+/, ''));
  return isInside(root, file) ? file : undefined;
}