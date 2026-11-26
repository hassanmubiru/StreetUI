#!/usr/bin/env node
/**
 * StreetUI public API inventory (§4 / §44 / M15.5).
 *
 * NON-MUTATING. Reads each public package's built type-declaration entries — the
 * exact surface an external consumer sees — and enumerates every exported
 * symbol, classifying it as a value (fn/class/const) or a type (type/interface).
 *
 * M15 scope: the inventory is driven by the release-set SSOT
 * (`scripts/lib/public-packages.mjs`), so it covers all 19 packed packages
 * (18 coordinated + `create-streetui`). For each package it walks every declared
 * `exports` subpath (`.`, `./server`, `./testing`, `./diagnostics`, …), resolves
 * the `types` target that subpath advertises, and records whether that file
 * exists. Bin-only packages are classified explicitly instead of being reported
 * as "missing declarations".
 *
 * Output: dist-tarballs/api-inventory.json by default + a console table.
 * This is an emitted artifact, never a source edit.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLISH_ORDER, packageName, isCoordinated } from './lib/public-packages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const outPath = outArg >= 0 && args[outArg + 1]
  ? resolve(process.cwd(), args[outArg + 1])
  : join(ROOT, 'dist-tarballs', 'api-inventory.json');

/** Extract exported symbol names from a .d.ts, split into values vs types. */
function extractExports(dts) {
  const values = new Set();
  const types = new Set();
  // Strip block comments so commented examples never register as exports.
  const src = dts.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = src.split('\n');
  for (const line of lines) {
    let m;
    if ((m = /^export declare (?:async )?function ([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export declare const ([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export declare (?:abstract )?class ([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export declare function \*?([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export (?:declare )?type ([A-Za-z0-9_$]+)/.exec(line))) types.add(m[1]);
    else if ((m = /^export interface ([A-Za-z0-9_$]+)/.exec(line))) types.add(m[1]);
    else if ((m = /^export declare enum ([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export (?:type )?\{([^}]*)\}/.exec(line))) {
      const isTypeOnlyBlock = /^export type \{/.test(line);
      for (let part of m[1].split(',')) {
        part = part.trim();
        if (!part) continue;
        const asMatch = /(?:^|\s)(\S+)\s+as\s+([A-Za-z0-9_$]+)/.exec(part);
        let name = asMatch ? asMatch[2] : part;
        let typeOnly = isTypeOnlyBlock;
        if (/^type\s+/.test(name)) { typeOnly = true; name = name.replace(/^type\s+/, ''); }
        name = name.replace(/^type\s+/, '').trim();
        if (!/^[A-Za-z0-9_$]+$/.test(name)) continue;
        (typeOnly ? types : values).add(name);
      }
    }
  }
  return { values: [...values].sort(), types: [...types].sort() };
}

/**
 * Pick the declaration file a subpath advertises. Handles both the modern
 * `{ types, import, require }` shape and a bare string target.
 */
function typesTargetOf(pkgDir, entry) {
  const candidates = [];
  const visit = (value) => {
    if (typeof value === 'string') {
      if (value.endsWith('.d.ts') || value.endsWith('.d.mts') || value.endsWith('.d.cts')) candidates.push(value);
      return;
    }
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    if (value === null || typeof value !== 'object') return;
    for (const key of ['types', 'import', 'require', 'default']) {
      if (key in value) visit(value[key]);
    }
  };
  visit(entry);
  // Fall back to the conventional location for the subpath.
  if (candidates.length === 0) return undefined;
  return candidates.find((rel) => existsSync(join(pkgDir, rel))) ?? candidates[0];
}

function classify(name) {
  if (/^_/.test(name) || /Internal$/.test(name)) return 'internal';
  return 'stable';
}

function taggedSymbols(pkgDir, tag) {
  const found = new Set();
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(p); continue; }
      if (!/\.ts$/.test(e.name) || /\.test\.ts$/.test(e.name)) continue;
      const txt = readFileSync(p, 'utf8');
      const re = new RegExp(`@${tag}[\\s\\S]{0,200}?export (?:declare )?(?:async )?(?:function|const|class|type|interface|enum) ([A-Za-z0-9_$]+)`, 'g');
      let m;
      while ((m = re.exec(txt))) found.add(m[1]);
    }
  };
  walk(join(pkgDir, 'src'));
  return found;
}

const report = { generatedAt: new Date().toISOString(), packages: [] };

for (const dir of PUBLISH_ORDER) {
  const pkgDir = join(PKGS, dir);
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const declaredName = packageName(dir);
  const entry = {
    dir,
    name: pkg.name,
    declaredName,
    // A mismatch between the inventory's expected name and the manifest is a
    // first-party defect worth surfacing, never silently accepted.
    nameMatches: pkg.name === declaredName,
    version: pkg.version,
    coordinated: isCoordinated(dir),
    binOnly: false,
    subpaths: [],
  };

  const bin = pkg.bin;
  const exportsField = pkg.exports;
  const binOnly = (exportsField === undefined || Object.keys(exportsField).length === 0) && bin !== undefined;
  entry.binOnly = binOnly;

  if (binOnly) {
    // Bin-only package (e.g. `create-streetui`): its contract is the executable,
    // not a root library export. Verify the declared bin file exists.
    const bins = typeof bin === 'string' ? { default: bin } : bin;
    entry.bins = Object.entries(bins ?? {}).map(([name, rel]) => ({ name, path: rel, exists: existsSync(join(pkgDir, rel)) }));
    report.packages.push(entry);
    continue;
  }

  const subpathEntries =
    exportsField === undefined
      ? [['.', join(pkgDir, 'dist', 'index.d.ts')]]
      : Object.entries(exportsField).filter(([key]) => key.startsWith('.'));

  for (const [subpath, value] of subpathEntries) {
    // `./package.json` is metadata, not an API surface.
    if (subpath === './package.json') {
      entry.subpaths.push({ subpath, kind: 'metadata', types: null, typesExists: null });
      continue;
    }
    if (typeof value === 'string' || (typeof value === 'object' && value !== null && !('types' in value) && !('import' in value) && !('require' in value))) {
      // A bare string target without a `types` sibling: derive `x.d.ts`.
      const rel = typeof value === 'string' ? value : undefined;
      const dts = rel === undefined ? undefined : rel.replace(/\.(m|c)?js$/, '.d.ts');
      const abs = dts === undefined ? undefined : join(pkgDir, dts);
      const exists = abs !== undefined && existsSync(abs);
      const surface = exists && abs !== undefined ? extractExports(readFileSync(abs, 'utf8')) : { values: [], types: [] };
      entry.subpaths.push({
        subpath,
        kind: 'declarations',
        types: dts ?? null,
        typesExists: exists,
        valueCount: surface.values.length,
        typeCount: surface.types.length,
        exports: surface,
      });
      continue;
    }
    const rel = typesTargetOf(pkgDir, value);
    const abs = rel === undefined ? undefined : join(pkgDir, rel);
    const exists = abs !== undefined && existsSync(abs);
    const surface = exists && abs !== undefined ? extractExports(readFileSync(abs, 'utf8')) : { values: [], types: [] };
    entry.subpaths.push({
      subpath,
      kind: 'declarations',
      types: rel ?? null,
      typesExists: exists,
      valueCount: surface.values.length,
      typeCount: surface.types.length,
      exports: surface,
    });
  }

  const taggedDeprecated = taggedSymbols(pkgDir, 'deprecated');
  const taggedExperimental = taggedSymbols(pkgDir, 'experimental');
  const totalValues = new Set();
  const totalTypes = new Set();
  for (const sub of entry.subpaths) {
    if (sub.exports === undefined) continue;
    for (const name of sub.exports.values) totalValues.add(name);
    for (const name of sub.exports.types) totalTypes.add(name);
    const all = [
      ...sub.exports.values.map((n) => ({ name: n, kind: 'value' })),
      ...sub.exports.types.map((n) => ({ name: n, kind: 'type' })),
    ];
    sub.exportList = all
      .map((s) => ({
        ...s,
        stability: taggedDeprecated.has(s.name) ? 'deprecated'
          : taggedExperimental.has(s.name) ? 'experimental'
          : classify(s.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  entry.valueCount = totalValues.size;
  entry.typeCount = totalTypes.size;

  report.packages.push(entry);
}

report.totals = {
  packages: report.packages.length,
  declarationPackages: report.packages.filter((p) => !p.binOnly).length,
  binOnlyPackages: report.packages.filter((p) => p.binOnly).length,
  subpaths: report.packages.reduce((n, p) => n + (p.subpaths?.length ?? 0), 0),
  values: report.packages.reduce((n, p) => n + (p.valueCount ?? 0), 0),
  types: report.packages.reduce((n, p) => n + (p.typeCount ?? 0), 0),
  missingDeclarationFiles: report.packages.reduce(
    (n, p) => n + (p.subpaths ?? []).filter((s) => s.kind === 'declarations' && !s.typesExists).length,
    0,
  ),
  nameMismatches: report.packages.filter((p) => p.nameMatches === false).length,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

console.log('StreetUI public API inventory');
for (const p of report.packages) {
  if (p.binOnly) {
    const ok = (p.bins ?? []).every((b) => b.exists);
    console.log(`  ${p.name.padEnd(24)} v${p.version}  bin-only  ${ok ? 'ok' : 'MISSING BIN'}`);
    continue;
  }
  const missing = (p.subpaths ?? []).filter((s) => s.kind === 'declarations' && !s.typesExists).length;
  console.log(
    `  ${p.name.padEnd(24)} v${p.version}  values:${String(p.valueCount).padStart(3)} types:${String(p.typeCount).padStart(3)}` +
    `  subpaths:${String((p.subpaths ?? []).length).padStart(2)}  typesEntry:${missing === 0 ? 'ok' : `${missing} MISSING`}` +
    `${p.nameMatches ? '' : '  NAME-MISMATCH'}`,
  );
}
console.log(
  `\ntotals → ${report.totals.values} values, ${report.totals.types} types, ` +
  `${report.totals.subpaths} subpaths across ${report.totals.packages} packages ` +
  `(${report.totals.binOnlyPackages} bin-only)`,
);
if (report.totals.missingDeclarationFiles > 0) {
  console.error(`[error] ${report.totals.missingDeclarationFiles} declared declaration target(s) missing on disk`);
}
if (report.totals.nameMismatches > 0) {
  console.error(`[error] ${report.totals.nameMismatches} package name(s) disagree with the release inventory`);
}
console.log(`inventory → ${outPath}`);
if (report.totals.missingDeclarationFiles > 0 || report.totals.nameMismatches > 0) process.exitCode = 1;
