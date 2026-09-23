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

// 1 ── Initial rendering ────────────────────────────────────────────────────
describe('1. initial rendering', () => {
  it('renders navigation, hero, sections and footer', () => {
    const { container, mounted } = setup();
    expect(container.querySelector('#navbar')).not.toBeNull();
    expect(container.querySelector('#hero-title')).not.toBeNull();
    expect(text(container.querySelector('#hero-title'))).toBe('Build UIs from a semantic graph');
    expect(container.querySelectorAll('#navbar a').length).toBe(3);
    expect(container.querySelector('#site-footer')).not.toBeNull();
    // Every top-level section rendered as a real <section>
    expect(container.querySelectorAll('section').length).toBeGreaterThanOrEqual(9);
    teardown(container, mounted);
  });

  it('renders the initial reactive list with three items', () => {
    const { container, mounted } = setup();
    const list = container.querySelector('#features-list')!;
    expect(list.querySelectorAll('li').length).toBe(3);
    expect(text(container.querySelector('#feature-1'))).toBe('Core');
    expect(text(container.querySelector('#feature-2'))).toBe('Renderer');
    expect(text(container.querySelector('#feature-3'))).toBe('Runtime');
    teardown(container, mounted);
  });

  it('external nav link gets target/rel attributes', () => {
    const { container, mounted } = setup();
    const gh = container.querySelector('#nav-github')!;
    expect(gh.getAttribute('target')).toBe('_blank');
    expect(gh.getAttribute('rel')).toBe('noopener noreferrer');
    teardown(container, mounted);
  });
});

// 2 ── Counter updates ──────────────────────────────────────────────────────
describe('2. counter updates reactively', () => {
  it('increments, decrements and resets via real button clicks', () => {
    const { container, state, mounted } = setup();
    const value = () => text(container.querySelector('#counter-value'));
    expect(value()).toBe('0');

    (container.querySelector('#btn-increment') as HTMLButtonElement).dispatchEvent(new Event('click'));
    (container.querySelector('#btn-increment') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(state.count.get()).toBe(2);
    expect(value()).toBe('2');

    (container.querySelector('#btn-decrement') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(value()).toBe('1');

    (container.querySelector('#btn-reset') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(state.count.get()).toBe(0);
    expect(value()).toBe('0');
    teardown(container, mounted);
  });
});

// 3 ── List updates ─────────────────────────────────────────────────────────
describe('3. reactive list — add / remove / update / clear', () => {
  it('adds an item', () => {
    const { container, actions, mounted } = setup();
    actions.addFeature('Compiler');
    const list = container.querySelector('#features-list')!;
    expect(list.querySelectorAll('li').length).toBe(4);
    expect(text(container.querySelector('#feature-4'))).toBe('Compiler');
    teardown(container, mounted);
  });

  it('removes the last item', () => {
    const { container, actions, mounted } = setup();
    actions.removeLastFeature();
    expect(container.querySelector('#features-list')!.querySelectorAll('li').length).toBe(2);
    expect(container.querySelector('#feature-3')).toBeNull();
    teardown(container, mounted);
  });

  it('removes a specific item via its per-item button', () => {
    const { container, mounted } = setup();
    (container.querySelector('#feature-remove-2') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(container.querySelector('#feature-2')).toBeNull();
    expect(container.querySelector('#feature-1')).not.toBeNull();
    expect(container.querySelector('#feature-3')).not.toBeNull();
    teardown(container, mounted);
  });

  it('updates an item in place (data change, identity unchanged)', () => {
    const { container, actions, mounted } = setup();
    const spanBefore = container.querySelector('#feature-1')!;
    actions.renameFeature(1, 'Core (updated)');
    const spanAfter = container.querySelector('#feature-1')!;
    expect(text(spanAfter)).toBe('Core (updated)');
    // Same DOM element reused — content patched in place, not replaced.
    expect(spanAfter).toBe(spanBefore);
    teardown(container, mounted);
  });

  it('clears the list', () => {
    const { container, actions, mounted } = setup();
    actions.clearFeatures();
    expect(container.querySelector('#features-list')!.querySelectorAll('li').length).toBe(0);
    teardown(container, mounted);
  });

  it('repopulates after a clear', () => {
    const { container, actions, mounted } = setup();
    actions.clearFeatures();
    actions.addFeature('Fresh');
    const list = container.querySelector('#features-list')!;
    expect(list.querySelectorAll('li').length).toBe(1);
    teardown(container, mounted);
  });
});

// 4 ── Keyed reorder preserves DOM identity ─────────────────────────────────
describe('4. keyed reorder preserves DOM identity', () => {
  it('rotating the list reuses the exact same <li> and <span> elements', () => {
    const { container, actions, mounted } = setup();
    const li = (id: number) => container.querySelector(`#feature-${id}`)!.closest('li');
    const li1 = li(1), li2 = li(2), li3 = li(3);
    const span1 = container.querySelector('#feature-1')!;

    // Core, Renderer, Runtime → Renderer, Runtime, Core
    actions.reorderFeatures();

    expect(li(1)).toBe(li1);
    expect(li(2)).toBe(li2);
    expect(li(3)).toBe(li3);
    expect(container.querySelector('#feature-1')).toBe(span1);

    // Verify the visual order actually changed in the DOM
    const order = Array.from(container.querySelectorAll('#features-list li span[id^="feature-"]'))
      .map((s) => text(s));
    expect(order).toEqual(['Renderer', 'Runtime', 'Core']);
    teardown(container, mounted);
  });
});

// 5 ── Form interaction ─────────────────────────────────────────────────────
describe('5. form interaction, validation and submitted state', () => {
  function typeInto(container: Element, id: string, value: string, type: 'input' | 'change' = 'input') {
    const el = container.querySelector(`#${id}`) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event(type));
  }

  it('controlled inputs update their signals on input/change', () => {
    const { container, state, mounted } = setup();
    typeInto(container, 'field-name', 'Ada');
    typeInto(container, 'field-email', 'ada@example.com', 'change');
    typeInto(container, 'field-message', 'Hello StreetUI');
    expect(state.formName.get()).toBe('Ada');
    expect(state.formEmail.get()).toBe('ada@example.com');
    expect(state.formMessage.get()).toBe('Hello StreetUI');
    teardown(container, mounted);
  });

  it('shows a validation message that updates reactively', () => {
    const { container, mounted } = setup();
    expect(text(container.querySelector('#form-validation'))).toBe('All fields are required.');
    typeInto(container, 'field-name', 'Ada');
    typeInto(container, 'field-email', 'not-an-email');
    typeInto(container, 'field-message', 'Hi');
    expect(text(container.querySelector('#form-validation'))).toBe('Please enter a valid email address.');
    typeInto(container, 'field-email', 'ada@example.com');
    expect(text(container.querySelector('#form-validation'))).toBe('Looks good.');
    teardown(container, mounted);
  });

  it('submitting a valid form sets the submitted state', () => {
    const { container, state, mounted } = setup();
    typeInto(container, 'field-name', 'Ada');
    typeInto(container, 'field-email', 'ada@example.com');
    typeInto(container, 'field-message', 'Hello');
    (container.querySelector('#the-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(state.submitted.get()).toBe(true);
    expect(text(container.querySelector('#form-submitted'))).toContain('Thanks Ada');
    teardown(container, mounted);
  });

  it('submitting an invalid form does not set submitted', () => {
    const { container, state, mounted } = setup();
    typeInto(container, 'field-name', 'Ada'); // email + message missing
    (container.querySelector('#the-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(state.submitted.get()).toBe(false);
    expect(text(container.querySelector('#form-submitted'))).toBe('');
    teardown(container, mounted);
  });
});

// 6 ── Conditional rendering ────────────────────────────────────────────────
describe('6. state-controlled conditional rendering', () => {
  it('toggles the details region on and off', () => {
    const { container, mounted } = setup();
    const region = () => container.querySelector('#details-region')!;
    expect(region().querySelectorAll('li').length).toBe(0);
    expect(text(container.querySelector('#btn-toggle'))).toBe('Show details');

    (container.querySelector('#btn-toggle') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(region().querySelectorAll('li').length).toBe(1);
    expect(text(container.querySelector('#details-text'))).toContain('semantic graph');
    expect(text(container.querySelector('#btn-toggle'))).toBe('Hide details');

    (container.querySelector('#btn-toggle') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(region().querySelectorAll('li').length).toBe(0);
    teardown(container, mounted);
  });
});

// __TESTS_MARKER__



