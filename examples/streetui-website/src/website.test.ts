/**
 * StreetUI Website — tests, written against the public API only.
 *
 * Every assertion drives the real app the way a user or server would: mount the
 * website into a container, navigate the real router, toggle the real theme,
 * type into the real search signal, interact with the real playground, and run
 * the SSR → hydrate path. No private graph access, no second renderer.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryHistory, resetIdCounter } from 'streetui';
import { flushUpdates, findByRole, trigger } from 'streetui/testing';
import { mountWebsite, type MountedWebsite } from './website.js';
import { renderWebsite, STATE_KEY } from './server-entry.js';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const text = (el: Element | null): string => el?.textContent?.trim() ?? '';

let site: MountedWebsite | null = null;
let container: HTMLElement;

beforeEach(() => {
  resetIdCounter();
  container = makeContainer();
});

afterEach(() => {
  site?.unmount();
  site = null;
  if (container.parentNode !== null) container.parentNode.removeChild(container);
});

describe('routing', () => {
  it('renders the home route and the persistent shell', () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    expect(text(container.querySelector('#home-title'))).toContain('semantic graph');
    expect(container.querySelector('#brand')).not.toBeNull();
    expect(container.querySelector('#site-footer')).not.toBeNull();
    expect(container.querySelector('#skip-link')).not.toBeNull();
  });

  it('navigates to a docs section and renders its content + code', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    site.router.navigate('/docs/core-concepts');
    await flushUpdates();
    expect(text(container.querySelector('#docsection-title'))).toBe('Core Concepts');
    expect(text(container.querySelector('#docsection-code-src'))).toContain('streetui.app');
  });

  it('reads a dynamic :slug param on the blog route', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/blog/no-virtual-dom') });
    await flushUpdates();
    expect(text(container.querySelector('#blogpost-title'))).toBe('Why there is no virtual DOM');
  });

  it('falls back to the 404 route for an unknown path', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/does-not-exist') });
    await flushUpdates();
    expect(text(container.querySelector('#notfound-title'))).toBe('Page not found');
    expect(site.router.currentRoute.get().isFallback).toBe(true);
  });

  it('marks the active nav link', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/docs') });
    await flushUpdates();
    expect(container.querySelector('#nav-docs-active')).not.toBeNull();
    // "Home" is an exact match, so it is NOT active on /docs.
    expect(container.querySelector('#nav-home-active')).toBeNull();
  });
});

describe('examples filter (two-way bind + ?q= seeding)', () => {
  it('seeds the filter from the query string and filters the list', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/examples?q=form') });
    await flushUpdates();
    expect(site.examplesFilter.get()).toBe('form');
    expect(container.querySelector('#example-3-name')).not.toBeNull(); // Contact form
    expect(container.querySelector('#example-1-name')).toBeNull(); // Counter filtered out
  });

  it('shows the empty state when nothing matches', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/examples') });
    site.examplesFilter.set('zzzznomatch');
    await flushUpdates();
    expect(container.querySelector('#examples-empty')).not.toBeNull();
  });
});

describe('docs search', () => {
  it('returns live results and an empty state', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    site.search.query.set('reactiv');
    await flushUpdates();
    const results = container.querySelector('#search-results');
    expect(results).not.toBeNull();
    expect(text(results)).toContain('Reactivity');
    expect(container.querySelector('#search-empty')).toBeNull();

    site.search.query.set('zzzznomatch');
    await flushUpdates();
    expect(container.querySelector('#search-empty')).not.toBeNull();
  });
});

describe('theme system', () => {
  it('cycles choice and applies data-theme to the document element', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    await flushUpdates();
    expect(text(container.querySelector('#theme-toggle'))).toBe('Theme: System');

    site.theme.cycle(); // system → light
    await flushUpdates();
    expect(site.theme.choice.get()).toBe('light');
    expect(text(container.querySelector('#theme-toggle'))).toBe('Theme: Light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('playground (built in StreetUI)', () => {
  it('increments the counter demo via a real click', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/playground') });
    await flushUpdates();
    const inc = findByRole(container, 'button', { name: 'Increment' });
    trigger(inc, 'click');
    await flushUpdates();
    expect(text(container.querySelector('#pg-counter-value'))).toBe('1');
  });

  it('switches to the list demo and adds an item', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/playground') });
    await flushUpdates();
    trigger(findByRole(container, 'button', { name: 'List' }), 'click');
    await flushUpdates();
    const before = container.querySelectorAll('[id^="pg-item-"]').length;
    trigger(findByRole(container, 'button', { name: 'Add' }), 'click');
    await flushUpdates();
    const after = container.querySelectorAll('[id^="pg-item-"]').length;
    expect(after).toBe(before + 1);
  });
});

describe('SSR → hydrate', () => {
  it('server-renders a route into #page-outlet with embedded state', () => {
    const { html, stateScript } = renderWebsite('/docs/reactivity');
    expect(html).toContain('id="page-outlet"');
    expect(html).toContain('id="brand"');
    expect(html).toContain('Reactivity');
    expect(stateScript).toContain(STATE_KEY);
  });

  it('adopts a prior server render and keeps navigating on the client', async () => {
    // 1. "Server" render via the same build (deterministic ids).
    resetIdCounter();
    const serverContainer = makeContainer();
    const server = mountWebsite(serverContainer, {
      history: createMemoryHistory('/docs/reactivity'),
    });
    const html = serverContainer.innerHTML;
    server.unmount();
    if (serverContainer.parentNode !== null) {
      serverContainer.parentNode.removeChild(serverContainer);
    }
    expect(html).toContain('id="docsection-title"');

    // 2. Plant markup and hydrate in place.
    container.innerHTML = html;
    const brandBefore = container.querySelector('#brand');
    expect(brandBefore).not.toBeNull();

    resetIdCounter();
    site = mountWebsite(container, {
      history: createMemoryHistory('/docs/reactivity'),
      hydrate: true,
    });
    // The persistent shell adopts the exact server node (no recreation).
    expect(container.querySelector('#brand')).toBe(brandBefore);

    // 3. Live client navigation works after hydration.
    site.router.navigate('/');
    await flushUpdates();
    expect(container.querySelector('#home-title')).not.toBeNull();
  });
});
