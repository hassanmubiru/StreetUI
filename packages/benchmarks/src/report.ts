/**
 * Console/table formatting and JSON persistence for benchmark runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchResult, BenchSuiteResult } from './harness.js';
import type { Comparison } from './compare.js';

/** results/ directory next to the built runner (packages/benchmarks/results). */
export function resultsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/ → package root → results/
  return path.resolve(here, '..', 'results');
}

export function writeSuite(fileName: string, suite: BenchSuiteResult): string {
  const dir = resultsDir();
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, fileName);
  fs.writeFileSync(full, JSON.stringify(suite, null, 2) + '\n', 'utf8');
  return full;
}

export function readSuite(fileName: string): BenchSuiteResult | null {
  const full = path.join(resultsDir(), fileName);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8')) as BenchSuiteResult;
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}
function padStart(s: string, width: number): string {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

export function formatResults(results: readonly BenchResult[]): string {
  const lines: string[] = [];
  lines.push(
    pad('benchmark', 44) +
      padStart('n', 6) +
      padStart('median ms', 13) +
      padStart('p95 ms', 12) +
      padStart('ops/s', 14),
  );
  lines.push('-'.repeat(89));
  for (const r of results) {
    lines.push(
      pad(r.name, 44) +
        padStart(r.n === null ? '-' : String(r.n), 6) +
        padStart(r.medianMs.toFixed(4), 13) +
        padStart(r.p95Ms.toFixed(4), 12) +
        padStart(r.opsPerSec >= 1 ? Math.round(r.opsPerSec).toLocaleString() : r.opsPerSec.toFixed(2), 14),
    );
  }
  return lines.join('\n');
}

export function formatComparison(comparisons: readonly Comparison[]): string {
  const lines: string[] = [];
  lines.push(
    pad('benchmark', 44) +
      padStart('base ms', 12) +
      padStart('cur ms', 12) +
      padStart('delta %', 11) +
      '  status',
  );
  lines.push('-'.repeat(92));
  for (const c of comparisons) {
    const deltaStr = c.deltaPct === null ? '-' : (c.deltaPct >= 0 ? '+' : '') + c.deltaPct.toFixed(1);
    lines.push(
      pad(c.name, 44) +
        padStart(c.baselineMs === null ? '-' : c.baselineMs.toFixed(4), 12) +
        padStart(c.currentMs.toFixed(4), 12) +
        padStart(deltaStr, 11) +
        '  ' +
        c.status,
    );
  }
  return lines.join('\n');
}

export function formatEnvironment(suite: BenchSuiteResult): string {
  const e = suite.environment;
  return [
    `node       ${e.node}`,
    `platform   ${e.platform} ${e.osRelease}`,
    `arch       ${e.arch}`,
    `cpu        ${e.cpuModel} (${e.cpuCount} logical)`,
    `memory     ${e.totalMemGB} GB`,
    `captured   ${e.capturedAt}`,
  ].join('\n');
}
