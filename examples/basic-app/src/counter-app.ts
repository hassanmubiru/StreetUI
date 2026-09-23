/**
 * StreetUI Counter Application
 *
 * Full pipeline demonstration:
 *   StreetUI DSL
 *     → Compiler
 *     → Semantic Application Graph
 *     → Runtime
 *     → StreetUI Renderer
 *     → Browser DOM
 *
 * The count is held in a reactive signal. Clicking the button increments it.
 * The heading showing the count updates via the signal subscription — no
 * React, no virtual DOM, no third-party rendering library.
 */

import { signal } from '@streetui/state';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { createRuntime } from '@streetui/runtime';
import { createRenderer } from '@streetui/renderer';

export function createCounterApp() {
  // ── Reactive state ──────────────────────────────────────────────────────────
  const count = signal(0);

  // ── DSL definition ──────────────────────────────────────────────────────────
  const app = streetui.app({ name: 'Counter', version: '1.0.0' });

  app.page('home', page => {
    page.section('main', section => {
      // Static heading
      section.heading('StreetUI Counter', { level: 1, id: 'app-title' });

      // Reactive text — updates automatically when count changes
      section.text(count as unknown as string, { id: 'count-display' });

      // Description
      section.text('Clicks are handled by StreetUI\'s own runtime and renderer.', {
        id: 'description',
      });

      // Increment button — onClick wired through the graph handler registry
      section.button('Increment', {
        id: 'increment-btn',
        onClick: () => {
          count.update(n => n + 1);
        },
      });

      // Reset button
      section.button('Reset', {
        id: 'reset-btn',
        onClick: () => {
          count.set(0);
        },
      });
    });
  });

  // ── Compile ─────────────────────────────────────────────────────────────────
  const compiled = compile(app);

  return { compiled, count };
}

/**
 * Mount the counter application into a DOM container.
 * Returns an object that lets you query/control the mounted app.
 */
export function mountCounterApp(container: Element) {
  const { compiled, count } = createCounterApp();

  const renderer = createRenderer();
  const runtime = createRuntime({ renderer });
  const mounted = runtime.mount(compiled, container);

  return {
    count,
    mounted,
    unmount: () => mounted.unmount(),
  };
}
