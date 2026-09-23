import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { signal } from '@streetui/state';
import { Scheduler } from '@streetui/scheduler';
import type { StreetRenderer, RenderHandle } from './renderer-interface.js';
import { Runtime, createRuntime } from './runtime.js';

beforeEach(() => resetIdCounter());

function makeRenderer(): StreetRenderer & { readonly flushCalled: number; readonly unmountCalled: number } {
  let _flushCalled = 0;
  let _unmountCalled = 0;
  const handle: RenderHandle = {
    flush() { _flushCalled++; },
    unmount() { _unmountCalled++; },
  };
  const renderer = {
    mount() { return handle; },
    get flushCalled() { return _flushCalled; },
    get unmountCalled() { return _unmountCalled; },
  };
  return renderer;
}

function makeContainer(): Element {
  return {
    nodeType: 1,
    childNodes: [],
  } as unknown as Element;
}

describe('Runtime', () => {
  it('mounts successfully', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.heading('Hello'); });
    const compiled = compile(app);

    const renderer = makeRenderer();
    const runtime = createRuntime({ renderer });
    const mounted = runtime.mount(compiled, makeContainer());

    expect(runtime.isMounted).toBe(true);
    expect(mounted.renderHandle).toBeDefined();
  });

  it('throws if mounted twice', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', () => {});
    const compiled = compile(app);

    const renderer = makeRenderer();
    const runtime = createRuntime({ renderer });
    runtime.mount(compiled, makeContainer());

    expect(() => runtime.mount(compiled, makeContainer())).toThrow();
  });

  it('unmounts cleanly', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', () => {});
    const compiled = compile(app);

    const renderer = makeRenderer();
    const runtime = createRuntime({ renderer });
    const mounted = runtime.mount(compiled, makeContainer());
    mounted.unmount();

    expect(runtime.isMounted).toBe(false);
    expect(renderer.unmountCalled).toBe(1);
  });

  it('unmounting twice is safe', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', () => {});
    const compiled = compile(app);

    const renderer = makeRenderer();
    const runtime = createRuntime({ renderer });
    const mounted = runtime.mount(compiled, makeContainer());
    mounted.unmount();
    expect(() => mounted.unmount()).not.toThrow();
  });

  it('signal change schedules a flush', async () => {
    const count = signal(0);
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.text(count as unknown as string);
    });
    const compiled = compile(app);

    const renderer = makeRenderer();
    const sched = new Scheduler();
    const runtime = createRuntime({ renderer, scheduler: sched });
    runtime.mount(compiled, makeContainer());

    count.set(1);
    // Scheduler has a pending job
    expect(sched.size).toBeGreaterThan(0);

    sched.flush();
    // flush was forwarded to render handle
    expect(renderer.flushCalled).toBeGreaterThan(0);
  });
});
