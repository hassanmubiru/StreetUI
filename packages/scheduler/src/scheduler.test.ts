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
