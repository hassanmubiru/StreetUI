/**
 * Regression comparison — compares a current benchmark run against a stored
 * baseline. Produces absolute (ms) and relative (%) deltas per benchmark.
 *
 * There are deliberately NO hard pass/fail thresholds baked in here: on a shared
 * / virtualized machine the noise floor is real, so the harness reports the
 * numbers and lets a human (or the v0.7 report) judge which deltas are
 * meaningful. `regressed`/`improved` flags use a conservative default band only
 * to colour the console table, never to fail a build.
 */

import type { BenchResult } from './harness.js';

export interface Comparison {
  readonly name: string;
  readonly category: string;
  readonly n: number | null;
  readonly baselineMs: number | null;
  readonly currentMs: number;
  readonly deltaMs: number | null;
  readonly deltaPct: number | null;
  readonly status: 'improved' | 'regressed' | 'unchanged' | 'new';
}

export interface CompareOptions {
  /** Relative change (fraction) beyond which a delta is flagged. Default 0.10. */
  readonly band?: number;
}

export function compareResults(
  baseline: readonly BenchResult[],
  current: readonly BenchResult[],
  options: CompareOptions = {},
): Comparison[] {
  const band = options.band ?? 0.1;
  const baseByName = new Map<string, BenchResult>();
  for (const b of baseline) baseByName.set(b.name, b);

  const out: Comparison[] = [];
  for (const cur of current) {
    const base = baseByName.get(cur.name);
    if (base === undefined || base.medianMs <= 0) {
      out.push({
        name: cur.name,
        category: cur.category,
        n: cur.n,
        baselineMs: base?.medianMs ?? null,
        currentMs: cur.medianMs,
        deltaMs: null,
        deltaPct: null,
        status: 'new',
      });
      continue;
    }
    const deltaMs = cur.medianMs - base.medianMs;
    const deltaPct = (deltaMs / base.medianMs) * 100;
    let status: Comparison['status'] = 'unchanged';
    if (deltaPct <= -band * 100) status = 'improved';
    else if (deltaPct >= band * 100) status = 'regressed';
    out.push({
      name: cur.name,
      category: cur.category,
      n: cur.n,
      baselineMs: base.medianMs,
      currentMs: cur.medianMs,
      deltaMs,
      deltaPct,
      status,
    });
  }
  return out;
}
