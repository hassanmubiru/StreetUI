/**
 * StreetUI Showcase — integration tests.
 *
 * These drive the real pipeline end to end under happy-dom:
 *   DSL → Compiler → Graph → Runtime → StreetUI Renderer → DOM
 *
 * They validate the eight required behaviors: initial rendering, counter,
 * list updates, keyed reorder (DOM identity), form interaction, conditional
 * rendering, event handlers, and unmount/cleanup.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { createShowcaseApp } from './showcase-app.js';
import { createRenderer } from '@streetui/renderer';
import { createRuntime } from '@streetui/runtime';
import { BrowserDOMAdapter } from '@streetui/dom';

beforeEach(() => resetIdCounter());

function setup() {
  resetIdCounter();
  const { compiled, state, actions } = createShowcaseApp();
  const container = document.createElement('div');
  document.body.appendChild(container);

  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const runtime = createRuntime({ renderer });
  const mounted = runtime.mount(compiled, container);

  return { container, state, actions, compiled, mounted };
}

function teardown(container: Element, mounted: { unmount(): void }) {
  mounted.unmount();
  container.parentNode?.removeChild(container);
}

const text = (el: Element | null) => el?.textContent?.trim() ?? '';
/** Count click-event handlers currently registered in the graph registry. */
function clickHandlerCount(graph: { handlers: Map<string, unknown> }): number {
  let n = 0;
  for (const key of graph.handlers.keys()) if (key.startsWith('click:')) n++;
  return n;
}

// __TESTS_MARKER__
