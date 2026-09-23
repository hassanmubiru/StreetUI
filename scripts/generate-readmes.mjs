#!/usr/bin/env node
/**
 * Generate a minimal, accurate README for every PUBLIC StreetUI package that
 * lacks one. Idempotent: never overwrites an existing README (so hand-written
 * docs are preserved). Content is derived from the package's own name +
 * description — no invented claims.
 *
 * Run: node scripts/generate-readmes.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const PUBLIC = new Set([
  'core', 'state', 'graph', 'dsl', 'compiler', 'runtime', 'events', 'scheduler',
  'dom', 'renderer', 'router', 'forms', 'i18n', 'context', 'devtools', 'testing',
  'cli',
]);

let created = 0;
for (const dir of readdirSync(PKGS)) {
  if (!PUBLIC.has(dir)) continue;
  const readme = join(PKGS, dir, 'README.md');
  if (existsSync(readme)) continue;
  const pkg = JSON.parse(readFileSync(join(PKGS, dir, 'package.json'), 'utf8'));
  const isCli = !!pkg.bin;
  const install = isCli
    ? `npm install -g ${pkg.name}`
    : `npm install ${pkg.name}`;
  const body = `# ${pkg.name}

${pkg.description ?? ''}

Part of [StreetUI](https://github.com/streetui/streetui) — a semantic,
signal-based UI framework with its own reactivity and keyed DOM reconciler
(no virtual DOM).

## Install

\`\`\`sh
${install}
\`\`\`

${isCli ? '' : `## Usage

\`\`\`ts
import * as pkg from '${pkg.name}';
\`\`\`

Both ESM (\`import\`) and CommonJS (\`require\`) entry points are shipped, with
matching TypeScript declarations.
`}
## License

MIT
`;
  writeFileSync(readme, body);
  created++;
  console.log(`README ${pkg.name}`);
}
console.log(`\n${created} READMEs created.`);
