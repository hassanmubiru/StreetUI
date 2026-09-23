/**
 * Event benchmarks: handler registration (mount of many interactive nodes),
 * dispatch cost, and cleanup (unmount removing all listeners).
 */

import { bench, type BenchResult } from '../harness.js';
import { streetui } from '@streetui/dsl';
import { compile, type CompiledApplication } from '@streetui/compiler';
import { createRenderer } from '@streetui/renderer';
import type { RenderHandle } from '@streetui/runtime';
import { freshContainer } from '../dom-env.js';

const SIZES = [10, 100, 1000];

function buttonApp(n: number): CompiledApplication {
  let clicks = 0;
  const app = streetui.app({ name: 'events', version: '0.7.0' });
  app.page('home', (page) => {
    page.section('main', (s) => {
      for (let i = 0; i < n; i++) {
        s.button(`btn ${i}`, {
          onClick: () => {
            clicks++;
          },
        });
      }
    });
  });
  return compile(app);
}

interface DispatchState {
  handle: RenderHandle;
  buttons: Element[];
}

export function eventsSuite(): BenchResult[] {
  const results: BenchResult[] = [];
  const renderer = createRenderer();

  // Registration: mount cost of an app that is entirely event-bound buttons.
  for (const n of SIZES) {
    results.push(
      bench<{ compiled: CompiledApplication; container: Element; handle?: RenderHandle }>(
        `events/register n=${n}`,
        (state) => {
          state.handle = renderer.mount(state.compiled, state.container);
        },
        {
          category: 'events',
          n,
          iterations: n >= 1000 ? 20 : 50,
          setup: () => ({ compiled: buttonApp(n), container: freshContainer() }),
          teardown: (state) => state.handle?.unmount(),
        },
      ),
    );
  }

  // Dispatch: fire a click on every button once.
  for (const n of SIZES) {
    results.push(
      bench<DispatchState>(
        `events/dispatch n=${n}`,
        (state) => {
          for (const btn of state.buttons) {
            btn.dispatchEvent(new Event('click', { bubbles: true }));
          }
        },
        {
          category: 'events',
          n,
          iterations: 40,
          setup: () => {
            const container = freshContainer();
            const handle = renderer.mount(buttonApp(n), container);
            const buttons = Array.from(container.querySelectorAll('button'));
            return { handle, buttons };
          },
          teardown: (state) => state.handle.unmount(),
        },
      ),
    );
  }

  // Cleanup: unmount cost (removes every listener + subscription).
  for (const n of SIZES) {
    results.push(
      bench<{ handle: RenderHandle }>(
        `events/cleanup n=${n}`,
        (state) => {
          state.handle.unmount();
        },
        {
          category: 'events',
          n,
          iterations: n >= 1000 ? 20 : 50,
          setup: () => ({ handle: renderer.mount(buttonApp(n), freshContainer()) }),
        },
      ),
    );
  }

  return results;
}
