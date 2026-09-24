/**
 * StreetUI Docs — integration tests.
 *
 * Drive the real pipeline end to end under happy-dom:
 *   DSL → Compiler → Graph → Runtime → StreetUI Renderer → DOM,
 * plus @streetui/router for navigation, params, query, active links, 404 and
 * route cleanup. Uses an in-memory history so navigation is deterministic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from 'streetui';
import { createMemoryHistory } from 'streetui';
import { mountDocsApp } from './docs-app.js';

beforeEach(() => resetIdCounter());

const text = (el: Element | null) => el?.textContent?.trim() ?? '';

function setup(initial = '/') {
  resetIdCounter();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = mountDocsApp(container, createMemoryHistory(initial));
  return { container, app };
}

function teardown(container: Element, app: { unmount(): void }) {
  app.unmount();
  container.remove();
}

describe('docs app — shell & home', () => {
  it('renders the persistent shell and the home route', () => {
    const { container, app } = setup('/');
    expect(container.querySelector('#site-nav')).not.toBeNull();
    expect(container.querySelector('#site-footer')).not.toBeNull();
    expect(container.querySelector('#home-title')).not.toBeNull();
    expect(text(container.querySelector('#home-title'))).toBe('Build UIs from a semantic graph');
    teardown(container, app);
  });

  it('marks the active nav link and keeps the shell across navigation', () => {
    const { container, app } = setup('/');
    const nav = container.querySelector('#site-nav');
    expect(container.querySelector('#nav-home-active')).not.toBeNull(); // home active
    expect(container.querySelector('#nav-docs-active')).toBeNull();

    app.router.navigate('/docs');
    expect(container.querySelector('#site-nav')).toBe(nav); // same shell element
    expect(container.querySelector('#nav-docs-active')).not.toBeNull();
    expect(container.querySelector('#nav-home-active')).toBeNull();
    teardown(container, app);
  });
});

describe('docs app — routing', () => {
  it('navigates to the docs index and lists sections', () => {
    const { container, app } = setup('/docs');
    expect(container.querySelector('#docs-title')).not.toBeNull();
    expect(container.querySelector('#docs-link-getting-started')).not.toBeNull();
    expect(container.querySelector('#docs-link-architecture')).not.toBeNull();
    expect(container.querySelector('#docs-link-api')).not.toBeNull();
    teardown(container, app);
  });

  it('resolves a dynamic docs section via :section param', () => {
    const { container, app } = setup('/docs/architecture');
    expect(text(container.querySelector('#docsection-title'))).toBe('Architecture');
    expect(text(container.querySelector('#docsection-body-text'))).toContain('semantic application graph');
    teardown(container, app);
  });

  it('shows a graceful message for an unknown docs section (still a matched route)', () => {
    const { container, app } = setup('/docs/nope');
    expect(text(container.querySelector('#docsection-title'))).toBe('Unknown section');
    expect(container.querySelector('#docsection-missing')).not.toBeNull();
    teardown(container, app);
  });

  it('renders a 404 page for unknown top-level paths', () => {
    const { container, app } = setup('/totally/missing');
    expect(container.querySelector('#notfound-title')).not.toBeNull();
    expect(text(container.querySelector('#notfound-text'))).toContain('/totally/missing');
    expect(app.router.currentRoute.get().isFallback).toBe(true);
    teardown(container, app);
  });
});

describe('docs app — examples: query param, bound input, reactive list, when()', () => {
  it('seeds the filter from ?q= and filters the reactive list', () => {
    const { container, app } = setup('/examples?q=form');
    expect(app.state.filter.get()).toBe('form');
    const list = container.querySelector('#examples-list')!;
    // Only "Contact form" (tag forms) matches "form".
    expect(list.querySelectorAll('li').length).toBe(1);
    expect(text(container.querySelector('#example-3'))).toBe('Contact form — forms');
    teardown(container, app);
  });

  it('updating the bound filter signal reconciles the list and toggles the empty state', () => {
    const { container, app } = setup('/examples');
    const list = () => container.querySelector('#examples-list')!;
    expect(list().querySelectorAll('li').length).toBe(EXAMPLES_COUNT);
    expect(container.querySelector('#examples-empty')).toBeNull();

    app.state.filter.set('router');
    expect(list().querySelectorAll('li').length).toBe(1);
    expect(text(container.querySelector('#example-5'))).toBe('Docs router — router');

    app.state.filter.set('zzz-no-match');
    expect(list().querySelectorAll('li').length).toBe(0);
    expect(container.querySelector('#examples-empty')).not.toBeNull();
    teardown(container, app);
  });
});

describe('docs app — route lifecycle cleanup', () => {
  it('does not leak the examples filter subscription after navigating away', () => {
    const { container, app } = setup('/examples');
    // The examples list is live and driven by the filter signal.
    expect(container.querySelector('#examples-list')).not.toBeNull();

    app.router.navigate('/about');
    expect(container.querySelector('#examples-list')).toBeNull();
    expect(container.querySelector('#about-title')).not.toBeNull();

    // Mutating the old route's signal must not throw and must not resurrect it.
    expect(() => app.state.filter.set('anything')).not.toThrow();
    expect(container.querySelector('#examples-list')).toBeNull();
    teardown(container, app);
  });
});

const EXAMPLES_COUNT = 5;
