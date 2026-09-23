/**
 * Focused behavior tests for the four backward-compatible API improvements:
 *   1. Widened text-like bindings (string | number | boolean + signals thereof)
 *   2. when() conditional-rendering primitive
 *   3. Controlled input `bind` (two-way convenience)
 *   4. data-streetui-key list-item identity attribute
 *
 * Every test drives the real pipeline (DSL → compiler → graph → renderer → DOM)
 * and asserts observable behavior — not internal implementation details.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';

beforeEach(() => resetIdCounter());

function makeContainer(): HTMLDivElement {
  return document.createElement('div');
}

function mountApp(build: (page: Parameters<Parameters<ReturnType<typeof streetui.app>['page']>[1]>[0]) => void) {
  resetIdCounter();
  const app = streetui.app({ name: 'test' });
  app.page('home', build);
  const compiled = compile(app);
  const container = makeContainer();
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const handle = renderer.mount(compiled, container);
  return { container, handle, graph: compiled.graph };
}

const txt = (el: Element | null) => el?.textContent?.trim() ?? '';
function clickHandlerCount(graph: { handlers: Map<string, unknown> }): number {
  let n = 0;
  for (const k of graph.handlers.keys()) if (k.startsWith('click:')) n++;
  return n;
}

// 1 ── Widened text-like bindings ───────────────────────────────────────────
describe('1. widened text-like bindings', () => {
  it('renders a static string (existing behavior preserved)', () => {
    const { container } = mountApp((p) => p.text('hello', { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('hello');
  });

  it('renders a static number', () => {
    const { container } = mountApp((p) => p.text(42, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('42');
  });

  it('renders a static boolean', () => {
    const { container } = mountApp((p) => p.text(true, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('true');
  });

  it('renders a reactive number signal directly (no derived(String()))', () => {
    const count = signal(0);
    const { container } = mountApp((p) => p.text(count, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('0');
  });

  it('renders a reactive boolean signal directly', () => {
    const flag = signal(false);
    const { container } = mountApp((p) => p.text(flag, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('false');
  });

  it('updates a reactive number after signal.set()', () => {
    const count = signal(1);
    const { container } = mountApp((p) => p.text(count, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('1');
    count.set(2);
    expect(txt(container.querySelector('#t'))).toBe('2');
    count.set(99);
    expect(txt(container.querySelector('#t'))).toBe('99');
  });

  it('updates a reactive boolean after signal.set()', () => {
    const flag = signal(false);
    const { container } = mountApp((p) => p.text(flag, { id: 't' }));
    expect(txt(container.querySelector('#t'))).toBe('false');
    flag.set(true);
    expect(txt(container.querySelector('#t'))).toBe('true');
  });

  it('accepts a numeric button label and heading', () => {
    const { container } = mountApp((p) => {
      p.heading(7, { id: 'h' });
      p.button(3, { id: 'b' });
    });
    expect(txt(container.querySelector('#h'))).toBe('7');
    expect(txt(container.querySelector('#b'))).toBe('3');
  });
});

// PLACEHOLDER_TESTS
