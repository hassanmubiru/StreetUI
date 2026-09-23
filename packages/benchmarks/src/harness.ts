/**
 * Benchmark harness — deterministic, dependency-free measurement built on
 * Node's built-in `node:perf_hooks`. No third-party benchmarking library.
 *
 * Model:
 *  - Each benchmark has an optional per-iteration `setup` (NOT timed) that
 *    produces fresh state, and a `run` function that performs the measured work.
 *  - `warmup` iterations prime the JIT and are discarded.
 *  - `iterations` measured samples are collected; for very cheap operations an
 *    `inner` loop count amortizes timer resolution and the per-sample time is
 *    divided back down to a single-operation cost.
 *  - Reported statistics are median / p95 / min / max / mean (all milliseconds),
 *    which are robust to the occasional GC pause on a noisy machine.
 */

import { performance } from 'node:perf_hooks';
import os from 'node:os';

export interface BenchResult {
  /** Fully-qualified, stable name — the comparison join key. */
  readonly name: string;
  /** Category grouping (e.g. "compiler", "keyed-lists"). */
  readonly category: string;
  /** Workload size where applicable (node/item/subscriber count). */
  readonly n: number | null;
  /** Number of measured samples retained. */
  readonly samples: number;
  /** Inner-loop repetitions folded into each sample. */
  readonly inner: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly meanMs: number;
  /** Derived throughput from the median (operations per second). */
  readonly opsPerSec: number;
  /** Optional caller-supplied structural counter (e.g. DOM ops) for context. */
  readonly note?: string;
}

export interface BenchOptions<S> {
  readonly category: string;
  readonly n?: number | null;
  readonly warmup?: number;
  readonly iterations?: number;
  readonly inner?: number;
  /** Fresh, untimed state produced before each measured sample. */
  readonly setup?: () => S;
  /** Untimed cleanup after each measured sample. */
  readonly teardown?: (state: S) => void;
  readonly note?: string;
}

const DEFAULTS = { warmup: 8, iterations: 40, inner: 1 } as const;

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[idx] as number;
}

export function summarize(
  name: string,
  category: string,
  n: number | null,
  inner: number,
  samplesMs: readonly number[],
  note?: string,
): BenchResult {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = count === 0 ? 0 : sum / count;
  const median =
    count === 0
      ? 0
      : count % 2 === 1
        ? (sorted[(count - 1) / 2] as number)
        : ((sorted[count / 2 - 1] as number) + (sorted[count / 2] as number)) / 2;
  const min = count === 0 ? 0 : (sorted[0] as number);
  const max = count === 0 ? 0 : (sorted[count - 1] as number);
  const p95 = percentile(sorted, 95);
  const result: BenchResult = {
    name,
    category,
    n,
    samples: count,
    inner,
    medianMs: median,
    p95Ms: p95,
    minMs: min,
    maxMs: max,
    meanMs: mean,
    opsPerSec: median > 0 ? 1000 / median : 0,
  };
  return note === undefined ? result : { ...result, note };
}

/**
 * Run a single benchmark and return its statistics. The `run` callback receives
 * the state produced by `setup` (or `undefined` when no setup is provided).
 */
export function bench<S = undefined>(
  name: string,
  run: (state: S) => void,
  options: BenchOptions<S>,
): BenchResult {
  const warmup = options.warmup ?? DEFAULTS.warmup;
  const iterations = options.iterations ?? DEFAULTS.iterations;
  const inner = Math.max(1, options.inner ?? DEFAULTS.inner);
  const n = options.n ?? null;

  const once = (): void => {
    const state = (options.setup ? options.setup() : undefined) as S;
    for (let k = 0; k < inner; k++) run(state);
    if (options.teardown) options.teardown(state);
  };

  // Warmup — discarded.
  for (let w = 0; w < warmup; w++) once();

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const state = (options.setup ? options.setup() : undefined) as S;
    const t0 = performance.now();
    for (let k = 0; k < inner; k++) run(state);
    const t1 = performance.now();
    if (options.teardown) options.teardown(state);
    samples.push((t1 - t0) / inner);
  }

  return summarize(name, options.category, n, inner, samples, options.note);
}

export interface BenchEnvironment {
  readonly node: string;
  readonly platform: string;
  readonly osRelease: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly cpuCount: number;
  readonly totalMemGB: number;
  readonly capturedAt: string;
}

export function environment(): BenchEnvironment {
  const cpus = os.cpus();
  return {
    node: process.version,
    platform: os.platform(),
    osRelease: os.release(),
    arch: os.arch(),
    cpuModel: cpus.length > 0 ? (cpus[0] as os.CpuInfo).model.trim() : 'unknown',
    cpuCount: cpus.length,
    totalMemGB: Math.round((os.totalmem() / 1e9) * 10) / 10,
    capturedAt: new Date().toISOString(),
  };
}

export interface BenchSuiteResult {
  readonly environment: BenchEnvironment;
  readonly results: readonly BenchResult[];
}
