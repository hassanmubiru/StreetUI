#!/usr/bin/env node
/**
 * Enforce conservative published-bundle budgets after a build.
 * Budgets are intentionally checked on the shipped ESM files and compressed
 * bytes, not source size. Increase a budget only with a bundle report explaining
 * why the public package needs the additional cost.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const budgets = {
  'packages/streetui/dist/index.js': { raw: 300_000, gzip: 70_000 },
  'packages/streetui/dist/server.js': { raw: 90_000, gzip: 20_000 },
  'packages/streetui/dist/testing.js': { raw: 170_000, gzip: 40_000 },
};

const failures = [];
for (const [file, budget] of Object.entries(budgets)) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing; run pnpm build first`);
    continue;
  }
  const data = fs.readFileSync(file);
  const raw = data.length;
  const gzip = zlib.gzipSync(data, { level: 9 }).length;
  console.log(`${file}: raw=${raw} gzip=${gzip} (budgets raw=${budget.raw}, gzip=${budget.gzip})`);
  if (raw > budget.raw) failures.push(`${file}: raw ${raw} > ${budget.raw}`);
  if (gzip > budget.gzip) failures.push(`${file}: gzip ${gzip} > ${budget.gzip}`);
}

if (failures.length > 0) {
  console.error('\nBundle budget failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Bundle budgets passed.');
