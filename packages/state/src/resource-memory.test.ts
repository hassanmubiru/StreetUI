/**
 * Resource memory stress (StreetUI 2.0 §26).
 *
 * Repeatedly creates and disposes resources at 50 / 100 / 200 instances and
 * proves the platform leaves NO residue:
 *   • every watched dependency's live observer count returns exactly to its
 *     pre-stress baseline after all resources are disposed (no leaked
 *     `dep.subscribe` handlers);
 *   • an in-flight load's AbortController is aborted on dispose, so a torn-down
 *     resource never writes state after the fact.
 *
 * These are deterministic structural assertions (observer counts, post-dispose
 * status) — no wall-clock timing.
 */
import { describe, it, expect } from 'vitest';
import { signal, observerCount } from './signal.js';
import { resource } from './resource.js';

describe.each([50, 100, 200])('resource memory stress — %i instances', (N) => {
  it('create → dispose N watching resources drains observers to baseline', () => {
    const dep = signal(0);
    const baseline = observerCount(dep) ?? 0;

    // Create N resources that each subscribe to `dep` via `watch`.
    const resources = Array.from({ length: N }, () =>
      resource<number>(async () => dep.get(), { watch: [dep], immediate: false }),
    );

    // Every resource added exactly one live subscriber to `dep`.
    expect(observerCount(dep)).toBe(baseline + N);

    // Dispose them all.
    for (const r of resources) r.dispose();

    // The watcher registry drained back to exactly where it started.
    expect(observerCount(dep)).toBe(baseline);
  });

  it('disposing mid-load prevents any post-teardown state write', async () => {
    let released = 0;

    for (let i = 0; i < N; i++) {
      // A loader that only resolves after we have already disposed the resource.
      let release!: () => void;
      const gate = new Promise<void>((res) => {
        release = () => {
          released++;
          res();
        };
      });
      const r = resource<string>(
        async ({ signal: sig }) => {
          await gate;
          // Honour cancellation exactly as a real loader would.
          if (sig.aborted) throw new DOMException('aborted', 'AbortError');
          return 'late';
        },
        { immediate: true },
      );
      expect(r.status.get()).toBe('loading');

      // Tear down BEFORE the loader resolves.
      r.dispose();
      release();
      await Promise.resolve();
      await gate;
      await Promise.resolve();

      // A disposed resource never transitions to success on a late resolution.
      expect(r.status.get()).toBe('loading');
      expect(r.data.get()).toBeUndefined();
    }

    expect(released).toBe(N);
  });
});
