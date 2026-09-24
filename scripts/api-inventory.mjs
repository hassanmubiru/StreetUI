#!/usr/bin/env node
/**
 * StreetUI public API inventory (§4 / §44).
 *
 * NON-MUTATING. Reads each public package's built type-declaration entry
 * (dist/index.d.ts) — the exact surface an external consumer sees — and
 * enumerates every exported symbol, classifying it as a value (fn/class/const)
 * or a type (type/interface). It also cross-checks that the declared package
 * `exports["."]` types target actually exists on disk.
 *
 * Output: dist-tarballs/api-inventory.json  + a console table.
 * This is an emitted artifact, never a source edit.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const PUBLIC = [
  'core', 'state', 'graph', 'dsl', 'compiler', 'runtime', 'events', 'scheduler',
  'dom', 'renderer', 'router', 'forms', 'i18n', 'context', 'devtools', 'testing',
  'cli',
];

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
    // `export declare function foo(` / `export declare const foo` / class
    if ((m = /^export declare (?:async )?function ([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export declare const ([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export declare (?:abstract )?class ([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export declare function \*?([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    else if ((m = /^export (?:declare )?type ([A-Za-z0-9_$]+)/.exec(line))) types.add(m[1]);
    else if ((m = /^export interface ([A-Za-z0-9_$]+)/.exec(line))) types.add(m[1]);
    else if ((m = /^export declare enum ([A-Za-z0-9_$]+)/.exec(line))) values.add(m[1]);
    // Re-export lists: `export { a, b, type C } from '...'` or bare `export { a, b };`
    else if ((m = /^export (?:type )?\{([^}]*)\}/.exec(line))) {
      const isTypeOnlyBlock = /^export type \{/.test(line);
      for (let part of m[1].split(',')) {
        part = part.trim();
        if (!part) continue;
        // handle `X as Y` → exported name is Y
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
 * Semver classification (§28). Heuristic-free, rule-based:
 *  - Anything reachable from the built dist/index.d.ts is PUBLIC → "stable".
 *  - We separately flag names that read as internal (leading _/`Internal`) as
 *    "internal" so a reviewer can confirm they should not be public.
 *  - No export is marked "experimental" or "deprecated" unless the source
 *    carries an @experimental / @deprecated tag (searched below).
 */
function classify(name, pkgDir) {
  if (/^_/.test(name) || /Internal$/.test(name)) return 'internal';
  return 'stable';
}

/** Grep the package source for @deprecated / @experimental JSDoc tags. */
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

for (const p of PUBLIC) {
  const pkgDir = join(PKGS, p);
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const dtsPath = join(pkgDir, 'dist', 'index.d.ts');
  if (!existsSync(dtsPath)) {
    report.packages.push({ name: pkg.name, error: 'dist/index.d.ts missing — build first' });
    continue;
  }
  const { values, types } = extractExports(readFileSync(dtsPath, 'utf8'));
  const deprecated = taggedSymbols(pkgDir, 'deprecated');
  const experimental = taggedSymbols(pkgDir, 'experimental');
  const all = [...values.map((n) => ({ name: n, kind: 'value' })), ...types.map((n) => ({ name: n, kind: 'type' }))];
  const exportsField = pkg.exports && pkg.exports['.'];
  const importTypes = exportsField?.import?.types;
  const importTypesOk = importTypes ? existsSync(join(pkgDir, importTypes)) : false;
  report.packages.push({
    name: pkg.name,
    version: pkg.version,
    exportEntryTypes: importTypes ?? null,
    exportEntryTypesExists: importTypesOk,
    valueCount: values.length,
    typeCount: types.length,
    exports: all.map((s) => ({
      ...s,
      stability: deprecated.has(s.name) ? 'deprecated'
        : experimental.has(s.name) ? 'experimental'
        : classify(s.name, pkgDir),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  });
}

report.totals = {
  packages: report.packages.length,
  values: report.packages.reduce((n, p) => n + (p.valueCount ?? 0), 0),
  types: report.packages.reduce((n, p) => n + (p.typeCount ?? 0), 0),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

console.log('StreetUI public API inventory');
for (const p of report.packages) {
  if (p.error) { console.log(`  ${p.name}: ${p.error}`); continue; }
  const internal = p.exports.filter((e) => e.stability === 'internal').length;
  const dep = p.exports.filter((e) => e.stability === 'deprecated').length;
  const exp = p.exports.filter((e) => e.stability === 'experimental').length;
  console.log(
    `  ${p.name.padEnd(22)} v${p.version}  values:${String(p.valueCount).padStart(3)} types:${String(p.typeCount).padStart(3)}` +
    `  [internal:${internal} deprecated:${dep} experimental:${exp}]  typesEntry:${p.exportEntryTypesExists ? 'ok' : 'MISSING'}`,
  );
}
console.log(`\ntotals → ${report.totals.values} values, ${report.totals.types} types across ${report.totals.packages} packages`);
console.log(`inventory → ${outPath}`);
