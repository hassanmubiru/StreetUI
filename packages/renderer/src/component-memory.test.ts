/**
 * Component memory / lifecycle stability (§25/§26).
 *
 * Repeatedly mounts → updates → unmounts → remounts a component that owns
 * cleanup + an effect, at 50 / 100 / 200 cycles, and proves the platform does
 * not leak per-instance state:
 *
 *   • every `ctx.onCleanup` fires exactly once per unmount (no double-dispose,
 *     no missed dispose);
 *   • the effect created in `setup` is fully torn down each cycle (its teardown
 *     count tracks the mount count, and a post-unmount source change is inert);
 *   • the graph's live handler-registry size returns to the SAME baseline after
 *     every unmount — i.e. the `__component__<id>` handler is pruned and does
 *     not accumulate across cycles.
 *
 * These are deterministic structural assertions (registry size, dispose counts)
 * rather than heap sampling, which is noise under happy-dom (per the SSR/mem
 * notes). No browser, no GC probing, no fabricated numbers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui, component } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
});

describe.each([50, 100, 200])('component memory cycles — %i iterations', (cycles) => {
  it('disposes cleanly every cycle with a stable handler baseline', async () => {
    let mounts = 0;
    let cleanups = 0;
    let effectTeardowns = 0;
    let effectRuns = 0;
    const source = signal(0);

    const Widget = component<{ n: number }>((props, ctx) => {
      mounts++;
      const local = signal(props.n);
      ctx.onCleanup(() => { cleanups++; });
      ctx.effect(() => {
        source.get();
        effectRuns++;
        return () => { effectTeardowns++; };
      });
      return (c) => {
        c.text(local, { id: 'w' });
        c.button('b', { id: 'b', onClick: () => local.set(local.peek() + 1) });
      };
    }, { name: 'Widget' });

    const show = signal(false);
    const app = streetui.app({ name: 'mem' });
    app.page('home', (page) => page.when(show, (b) => b.component('w', Widget, { n: 1 })));

    const compiled = compile(app);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.mount(compiled, container);

    const graph = compiled.graph;
    let unmountedBaseline = -1;

    for (let i = 0; i < cycles; i++) {
      // mount
      show.set(true);
      await flush();
      expect(container.querySelector('[data-streetui-component="Widget"]')).not.toBeNull();

      // update (fine-grained; must NOT re-run setup)
      (container.querySelector('#b') as HTMLElement).click();
      await flush();

      // unmount
      show.set(false);
      await flush();
      expect(container.querySelector('[data-streetui-component="Widget"]')).toBeNull();

      // The unmounted handler-registry size must be identical every cycle.
      const size = graph.handlerCount;
      if (unmountedBaseline === -1) unmountedBaseline = size;
      expect(size).toBe(unmountedBaseline);
    }

    // One setup + one cleanup + one effect-teardown per cycle. No leak, no drift.
    expect(mounts).toBe(cycles);
    expect(cleanups).toBe(cycles);
    expect(effectTeardowns).toBe(cycles);

    // After the final unmount the effect is dead: source changes do nothing.
    const before = effectRuns;
    source.set(source.peek() + 1);
    await flush();
    expect(effectRuns).toBe(before);

    handle.unmount();
  });
});
