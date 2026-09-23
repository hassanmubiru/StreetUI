import { describe, it, expect, beforeEach } from 'vitest';
import {
  Application,
  createApplication,
  Lifecycle,
  CleanupRegistry,
  DiagnosticCollector,
  DiagnosticError,
  Environment,
  generateNodeId,
  generateApplicationId,
  resetIdCounter,
  nodeIdPrefix,
  formatDiagnostic,
} from './index.js';

beforeEach(() => {
  resetIdCounter();
});

describe('identity', () => {
  it('generates unique node IDs', () => {
    const a = generateNodeId('button');
    const b = generateNodeId('button');
    expect(a).not.toBe(b);
  });

  it('includes prefix in node ID', () => {
    const id = generateNodeId('heading');
    expect(nodeIdPrefix(id)).toBe('heading');
  });

  it('generates application IDs with app prefix', () => {
    const id = generateApplicationId('my-app');
    expect(id).toContain('app:my-app:');
  });
});

describe('Application', () => {
  it('creates an application with the given name', () => {
    const app = createApplication({ name: 'test-app' });
    expect(app.name).toBe('test-app');
  });

  it('starts in created phase', () => {
    const app = createApplication({ name: 'test-app' });
    expect(app.lifecycle.phase).toBe('created');
  });

  it('transitions to active after mount', async () => {
    const app = createApplication({ name: 'test-app' });
    await app.mount();
    expect(app.lifecycle.phase).toBe('active');
  });

  it('transitions to destroyed after unmount', async () => {
    const app = createApplication({ name: 'test-app' });
    await app.mount();
    await app.unmount();
    expect(app.lifecycle.phase).toBe('destroyed');
  });

  it('throws if mounted twice', async () => {
    const app = createApplication({ name: 'test-app' });
    await app.mount();
    await expect(app.mount()).rejects.toThrow();
  });

  it('calls onMount hooks', async () => {
    const app = createApplication({ name: 'test-app' });
    let called = false;
    app.onMount(() => { called = true; });
    await app.mount();
    expect(called).toBe(true);
  });

  it('calls onUnmount hooks', async () => {
    const app = createApplication({ name: 'test-app' });
    let called = false;
    app.onUnmount(() => { called = true; });
    await app.mount();
    await app.unmount();
    expect(called).toBe(true);
  });
});

describe('Lifecycle', () => {
  it('starts in created phase', () => {
    const lc = new Lifecycle();
    expect(lc.phase).toBe('created');
  });

  it('is not mounted when created', () => {
    const lc = new Lifecycle();
    expect(lc.isMounted).toBe(false);
  });

  it('is mounted after transition to active', async () => {
    const lc = new Lifecycle();
    await lc.transition('mounted');
    await lc.transition('active');
    expect(lc.isMounted).toBe(true);
  });

  it('is destroyed after transition to destroyed', async () => {
    const lc = new Lifecycle();
    await lc.transition('destroyed');
    expect(lc.isDestroyed).toBe(true);
  });

  it('fires hooks on transition', async () => {
    const lc = new Lifecycle();
    const calls: string[] = [];
    lc.on('mounted', () => { calls.push('mounted'); });
    lc.on('active', () => { calls.push('active'); });
    await lc.transition('mounted');
    await lc.transition('active');
    expect(calls).toEqual(['mounted', 'active']);
  });

  it('can remove a hook', async () => {
    const lc = new Lifecycle();
    let count = 0;
    const remove = lc.on('mounted', () => { count++; });
    remove();
    await lc.transition('mounted');
    expect(count).toBe(0);
  });
});

describe('CleanupRegistry', () => {
  it('runs all cleanup functions', () => {
    const reg = new CleanupRegistry();
    const calls: number[] = [];
    reg.add(() => calls.push(1));
    reg.add(() => calls.push(2));
    reg.run();
    expect(calls).toEqual([1, 2]);
  });

  it('clears after run', () => {
    const reg = new CleanupRegistry();
    let count = 0;
    reg.add(() => count++);
    reg.run();
    reg.run();
    expect(count).toBe(1);
  });

  it('does not throw if one cleanup throws', () => {
    const reg = new CleanupRegistry();
    reg.add(() => { throw new Error('fail'); });
    reg.add(() => { /* ok */ });
    expect(() => reg.run()).not.toThrow();
  });
});

describe('DiagnosticCollector', () => {
  it('collects errors', () => {
    const dc = new DiagnosticCollector();
    dc.error('E001', 'something went wrong');
    expect(dc.diagnostics).toHaveLength(1);
    expect(dc.hasErrors).toBe(true);
  });

  it('collects warnings', () => {
    const dc = new DiagnosticCollector();
    dc.warn('W001', 'watch out');
    expect(dc.hasWarnings).toBe(true);
    expect(dc.hasErrors).toBe(false);
  });

  it('throws DiagnosticError when errors present', () => {
    const dc = new DiagnosticCollector();
    dc.error('E001', 'boom');
    expect(() => dc.throwIfErrors()).toThrow(DiagnosticError);
  });

  it('does not throw when only warnings', () => {
    const dc = new DiagnosticCollector();
    dc.warn('W001', 'fine');
    expect(() => dc.throwIfErrors()).not.toThrow();
  });

  it('merges another collector', () => {
    const a = new DiagnosticCollector();
    const b = new DiagnosticCollector();
    a.error('E001', 'err');
    b.warn('W001', 'warn');
    a.merge(b);
    expect(a.diagnostics).toHaveLength(2);
  });

  it('clears diagnostics', () => {
    const dc = new DiagnosticCollector();
    dc.error('E001', 'err');
    dc.clear();
    expect(dc.diagnostics).toHaveLength(0);
  });

  it('formats diagnostics correctly', () => {
    const d = {
      severity: 'error' as const,
      code: 'E001',
      message: 'test error',
      location: undefined,
      cause: undefined,
    };
    expect(formatDiagnostic(d)).toBe('[ERROR] E001: test error');
  });
});

describe('Environment', () => {
  it('detects test environment', () => {
    const env = new Environment('test');
    expect(env.isTest).toBe(true);
    expect(env.isBrowser).toBe(false);
  });

  it('detects server environment', () => {
    const env = new Environment('server');
    expect(env.isServer).toBe(true);
  });
});
