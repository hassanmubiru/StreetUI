import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scheduler, scheduleUpdate, flushSync, scheduler } from './scheduler.js';

describe('Scheduler', () => {
  let s: Scheduler;

  beforeEach(() => {
    s = new Scheduler();
  });

  it('starts empty', () => {
    expect(s.size).toBe(0);
    expect(s.isPending).toBe(false);
  });

  it('queues a job', () => {
    s.schedule({ key: 'a', priority: 'normal', fn: () => {} });
    expect(s.size).toBe(1);
  });

  it('replaces duplicate key', () => {
    let calls = 0;
    s.schedule({ key: 'a', priority: 'normal', fn: () => { calls++; } });
    s.schedule({ key: 'a', priority: 'normal', fn: () => { calls += 10; } });
    s.flush();
    expect(calls).toBe(10);
    expect(s.size).toBe(0);
  });

  it('flushes all jobs', () => {
    const results: string[] = [];
    s.schedule({ key: 'a', priority: 'normal', fn: () => results.push('a') });
    s.schedule({ key: 'b', priority: 'normal', fn: () => results.push('b') });
    s.flush();
    expect(results).toContain('a');
    expect(results).toContain('b');
  });

  it('orders by priority: immediate before normal before idle', () => {
    const order: string[] = [];
    s.schedule({ key: 'idle',      priority: 'idle',      fn: () => order.push('idle') });
    s.schedule({ key: 'normal',    priority: 'normal',    fn: () => order.push('normal') });
    s.schedule({ key: 'immediate', priority: 'immediate', fn: () => order.push('immediate') });
    s.flush();
    expect(order).toEqual(['immediate', 'normal', 'idle']);
  });

  it('can cancel a queued job', () => {
    let ran = false;
    s.schedule({ key: 'x', priority: 'normal', fn: () => { ran = true; } });
    s.cancel('x');
    s.flush();
    expect(ran).toBe(false);
  });

  it('clear removes all jobs without running them', () => {
    let ran = false;
    s.schedule({ key: 'a', priority: 'normal', fn: () => { ran = true; } });
    s.clear();
    expect(s.size).toBe(0);
    expect(ran).toBe(false);
  });

  it('isolates job failures', () => {
    const results: string[] = [];
    s.schedule({ key: 'bad',  priority: 'normal', fn: () => { throw new Error('boom'); } });
    s.schedule({ key: 'good', priority: 'normal', fn: () => results.push('good') });
    expect(() => s.flush()).not.toThrow();
    expect(results).toContain('good');
  });

  it('routes swallowed job errors to an installed diagnostic sink (§26/§27)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const seen: Array<{ message: string; context: unknown }> = [];
    s.setDiagnostics({ error: (message, context) => seen.push({ message, context }) });

    const err = new Error('boom');
    s.schedule({ key: 'bad', priority: 'normal', fn: () => { throw err; } });
    s.flush();

    expect(seen.length).toBe(1);
    expect(seen[0]?.message).toContain('bad');
    expect(seen[0]?.context).toBe(err);
    // The sink replaces the default console reporting — it is not duplicated.
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('falls back to console.error when no diagnostic sink is installed', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    s.schedule({ key: 'bad', priority: 'normal', fn: () => { throw new Error('boom'); } });
    s.flush();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    // Clearing the sink restores default behaviour.
    s.setDiagnostics({ error: () => {} });
    s.setDiagnostics(undefined);
    s.schedule({ key: 'bad2', priority: 'normal', fn: () => { throw new Error('boom2'); } });
    s.flush();
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  it('scheduleAll queues multiple jobs atomically', () => {
    const results: string[] = [];
    s.scheduleAll([
      { key: 'a', priority: 'normal', fn: () => results.push('a') },
      { key: 'b', priority: 'idle',   fn: () => results.push('b') },
    ]);
    s.flush();
    expect(results).toEqual(['a', 'b']);
  });

  it('does not double-flush if already flushing', () => {
    let count = 0;
    s.schedule({
      key: 'a',
      priority: 'normal',
      fn: () => {
        count++;
        // schedule new job during flush — should not cause recursive flush
        s.schedule({ key: 'b', priority: 'normal', fn: () => { count++; } });
      },
    });
    s.flush();
    expect(count).toBe(1); // 'b' queued but not flushed in same pass
  });

  it('microtask flush runs asynchronously', async () => {
    const results: string[] = [];
    scheduleUpdate('async-a', () => results.push('a'));
    expect(results).toHaveLength(0);
    await Promise.resolve();
    // give the microtask queue a chance
    await new Promise(r => setTimeout(r, 0));
    // the global scheduler may have flushed
    flushSync();
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe('global scheduler helpers', () => {
  it('flushSync flushes global scheduler', () => {
    const results: string[] = [];
    scheduler.schedule({ key: 'gs-test', priority: 'normal', fn: () => results.push('ok') });
    flushSync();
    expect(results).toContain('ok');
  });
});
