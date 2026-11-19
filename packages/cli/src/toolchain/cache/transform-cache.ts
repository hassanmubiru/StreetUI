/** In-memory transform cache keyed by content hash. */

import type { TransformResult } from '../transform/typescript.js';

interface Entry {
  readonly hash: string;
  readonly result: TransformResult;
}

export class TransformCache {
  private readonly entries = new Map<string, Entry>();

  get(file: string, hash: string): TransformResult | undefined {
    const entry = this.entries.get(file);
    if (entry === undefined || entry.hash !== hash) return undefined;
    return entry.result;
  }

  set(file: string, hash: string, result: TransformResult): void {
    this.entries.set(file, { hash, result });
  }

  invalidate(file: string): void {
    this.entries.delete(file);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}