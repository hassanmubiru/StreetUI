/**
 * Integration test — full StreetUI pipeline end to end.
 *
 * DSL → Compiler → Graph → Runtime → StreetUI Renderer → DOM
 *
 * Runs under happy-dom so real DOM APIs are available.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { createCounterApp } from './counter-app.js';
import { compile } from '@streetui/compiler';
import { createRenderer } from '@streetui/renderer';
import { createRuntime } from '@streetui/runtime';
import { BrowserDOMAdapter } from '@streetui/dom';

beforeEach(() => resetIdCounter());

describe('Counter Application — end-to-end', () => {
  function setup() {
    resetIdCounter();
    const { compiled, count } = createCounterApp();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const runtime = createRuntime({ renderer });
    const mounted = runtime.mount(compiled, container);

    return { container, count, mounted };
  }

  function teardown(container: Element, mounted: { unmount(): void }) {
    mounted.unmount();
    container.parentNode?.removeChild(container);
  }

  // ── Structure ───────────────────────────────────────────────────────────────

  it('renders a heading', () => {
    const { container, mounted } = setup();
    const h1 = container.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe('StreetUI Counter');
    teardown(container, mounted);
  });

  it('renders two buttons', () => {
    const { container, mounted } = setup();
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    teardown(container, mounted);
  });

  it('renders the count display with initial value 0', () => {
    const { container, count, mounted } = setup();
    expect(count.get()).toBe(0);
    // The text node rendering the count should show "0"
    const spans = Array.from(container.querySelectorAll('span'));
    const countSpan = spans.find(s => s.textContent === '0');
    expect(countSpan).not.toBeUndefined();
    teardown(container, mounted);
  });

  // ── Events ──────────────────────────────────────────────────────────────────

  it('increment button fires and updates the signal', () => {
    const { container, count, mounted } = setup();
    const buttons = container.querySelectorAll('button');
    const incrementBtn = Array.from(buttons).find(b => b.textContent === 'Increment');
    expect(incrementBtn).not.toBeUndefined();

    incrementBtn!.dispatchEvent(new Event('click'));
    expect(count.get()).toBe(1);

    incrementBtn!.dispatchEvent(new Event('click'));
    expect(count.get()).toBe(2);

    teardown(container, mounted);
  });

  it('DOM updates when signal changes — StreetUI renderer patches the DOM', () => {
    const { container, count, mounted } = setup();

    const getCountText = () => {
      const spans = Array.from(container.querySelectorAll('span'));
      return spans.find(s => /^\d+$/.test(s.textContent?.trim() ?? ''))?.textContent?.trim();
    };

    expect(getCountText()).toBe('0');

    // Programmatic signal update (same as clicking the button)
    count.set(5);
    expect(getCountText()).toBe('5');

    count.set(42);
    expect(getCountText()).toBe('42');

    teardown(container, mounted);
  });

  it('reset button sets count back to 0', () => {
    const { container, count, mounted } = setup();

    // Increment a few times
    const buttons = container.querySelectorAll('button');
    const incBtn = Array.from(buttons).find(b => b.textContent === 'Increment')!;
    incBtn.dispatchEvent(new Event('click'));
    incBtn.dispatchEvent(new Event('click'));
    incBtn.dispatchEvent(new Event('click'));
    expect(count.get()).toBe(3);

    // Reset
    const resetBtn = Array.from(buttons).find(b => b.textContent === 'Reset')!;
    resetBtn.dispatchEvent(new Event('click'));
    expect(count.get()).toBe(0);

    teardown(container, mounted);
  });

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  it('unmount removes all children from container', () => {
    const { container, mounted } = setup();
    expect(container.children.length).toBeGreaterThan(0);
    mounted.unmount();
    expect(container.children.length).toBe(0);
    teardown(container, mounted);
  });

  it('signal subscriptions do not fire after unmount', () => {
    const { container, count, mounted } = setup();
    mounted.unmount();

    // After unmount the DOM is gone — signal can still be updated without error
    expect(() => count.set(99)).not.toThrow();
    // Container has no children
    expect(container.children.length).toBe(0);
    teardown(container, mounted);
  });

  // ── Graph integrity ─────────────────────────────────────────────────────────

  it('compiled graph has the correct structure', () => {
    const { compiled } = createCounterApp();
    expect(compiled.graph.findByType('heading')).toHaveLength(1);
    expect(compiled.graph.findByType('button')).toHaveLength(2);
    expect(compiled.graph.findByType('text').length).toBeGreaterThanOrEqual(1);
    expect(compiled.graph.findByType('section')).toHaveLength(1);
    expect(compiled.graph.findByType('page')).toHaveLength(1);
  });

  it('heading has correct text prop', () => {
    const { compiled } = createCounterApp();
    const heading = compiled.graph.findByType('heading')[0]!;
    expect(heading.getProp('text')).toBe('StreetUI Counter');
  });

  it('buttons have click event handlers registered', () => {
    const { compiled } = createCounterApp();
    const buttons = compiled.graph.findByType('button');
    for (const btn of buttons) {
      expect(btn.events.some(e => e.type === 'click')).toBe(true);
    }
  });

  it('count text node has a state ref binding', () => {
    const { compiled } = createCounterApp();
    // At least one text node should be bound to the count signal
    const textNodes = compiled.graph.findByType('text');
    const boundNode = textNodes.find(n => n.stateRefs.length > 0);
    expect(boundNode).toBeDefined();
  });
});
