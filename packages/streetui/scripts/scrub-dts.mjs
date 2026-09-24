// @ts-check
/**
 * Post-build declaration scrub.
 *
 * The `streetui` package bundles every internal `@streetui/*` module into its
 * own `dist/` (JS via esbuild `noExternal`, types via rollup-dts
 * `dts.resolve`). After that inlining, the *only* place internal scoped names
 * can survive is inside JSDoc comment text (e.g. an `@example` that imports from
 * `@streetui/dsl`, or prose mentioning a sibling package). Those are harmless at
 * runtime and at the type level, but they would leak internal package paths into
 * the shipped public declarations.
 *
 * This script rewrites any residual `@streetui/<pkg>` mention to `streetui` in
 * the emitted declaration files, and *fails loudly* if a real, load-bearing
 * `import`/`export ... from '@streetui/…'` statement survived in the JS or the
 * declarations (which would indicate the bundle did not actually inline a
 * dependency).
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist', import.meta.url));

/** Recursively collect every file under `dir`. */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const SCOPED = /@streetui\/[a-z][a-z0-9-]*/g;
// A real module specifier for an internal package (leak we must never ship).
const REAL_IMPORT = /\bfrom\s*['"]@streetui\/[a-z][a-z0-9-]*['"]/;
const REAL_REQUIRE = /\brequire\(\s*['"]@streetui\/[a-z][a-z0-9-]*['"]\s*\)/;

const files = walk(distDir);
let scrubbed = 0;
/** @type {string[]} */
const leaks = [];

for (const file of files) {
  const isDecl = file.endsWith('.d.ts') || file.endsWith('.d.cts');
  const isCode = file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.mjs');
  if (!isDecl && !isCode) continue;

  const original = readFileSync(file, 'utf8');

  // A surviving import/require of an internal package is a real leak.
  if (REAL_IMPORT.test(original) || REAL_REQUIRE.test(original)) {
    leaks.push(file);
    continue;
  }

  if (!SCOPED.test(original)) continue;
  // Only comment/prose mentions remain — rewrite them to the public name.
  const next = original.replace(SCOPED, 'streetui');
  if (next !== original) {
    writeFileSync(file, next);
    scrubbed += 1;
  }
}

if (leaks.length > 0) {
  console.error(
    'scrub-dts: real @streetui/* import/require survived bundling in:\n' +
      leaks.map((f) => `  - ${f}`).join('\n'),
  );
  process.exit(1);
}

console.log(`scrub-dts: cleaned ${scrubbed} file(s); no internal import leaks.`);
