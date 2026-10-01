/**
 * StreetUI Website — regression suite (Phase 5, v2.6).
 *
 * Drives the REAL website through the public API only (mount, navigate every
 * route, hydrate a server render) and asserts the things a production site must
 * never regress on:
 *   • every route renders its page heading,
 *   • the persistent shell keeps node identity across navigation,
 *   • no console errors/warnings and no uncaught exceptions occur,
 *   • the SSR→hydrate path adopts the server shell without recreating it,
 *   • exactly one route outlet exists at all times (no duplicate/stale subtree).
 *
 * ENGINE BOUNDARY: this runs under the Node/happy-dom test environment. Real
 * cross-browser behaviour (Chrome 154 / Firefox 155), paint timing, and
 * assistive-technology checks are measured in the authoritative environment and
 * reported separately — they are NOT simulated here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemoryHistory, resetIdCounter } from 'streetui';
import { flushUpdates } from 'streetui/testing';
import { mountWebsite, type MountedWebsite } from './website.js';
import { renderWebsite } from './server-entry.js';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const text = (el: Element | null): string => el?.textContent?.trim() ?? '';

/** Every route and the deterministic page-title it must render. */
const ROUTE_TABLE: ReadonlyArray<{ path: string; titleId: string; title: string }> = [
  { path: '/', titleId: 'home-title', title: 'Build UIs from a semantic graph' },
  { path: '/getting-started', titleId: 'start-title', title: 'Getting Started' },
  { path: '/docs', titleId: 'docs-title', title: 'Documentation' },
  { path: '/docs/core-concepts', titleId: 'docsection-title', title: 'Core Concepts' },
  { path: '/api', titleId: 'api-title', title: 'API Reference' },
  { path: '/examples', titleId: 'examples-title', title: 'Examples' },
  { path: '/playground', titleId: 'playground-title', title: 'Playground' },
  { path: '/benchmarks', titleId: 'benchmarks-title', title: 'Benchmarks' },
  { path: '/changelog', titleId: 'changelog-title', title: 'Changelog' },
  { path: '/blog', titleId: 'blog-title', title: 'Blog' },
  { path: '/blog/no-virtual-dom', titleId: 'blogpost-title', title: 'Why there is no virtual DOM' },
  { path: '/about', titleId: 'about-title', title: 'About' },
  { path: '/does-not-exist', titleId: 'notfound-title', title: 'Page not found' },
];

let site: MountedWebsite | null = null;
let container: HTMLElement;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let uncaught: unknown[];
const onError = (e: ErrorEvent): void => { uncaught.push(e.error ?? e.message); };
const onRejection = (e: PromiseRejectionEvent): void => { uncaught.push(e.reason); };

beforeEach(() => {
  resetIdCounter();
  container = makeContainer();
  uncaught = [];
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
});

afterEach(() => {
  site?.unmount();
  site = null;
  if (container.parentNode !== null) container.parentNode.removeChild(container);
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

const assertClean = (): void => {
  expect(errorSpy, 'console.error calls').toHaveBeenCalledTimes(0);
  expect(warnSpy, 'console.warn calls').toHaveBeenCalledTimes(0);
  expect(uncaught, 'uncaught errors / rejections').toEqual([]);
};

describe('website regression — every route renders cleanly', () => {
  for (const route of ROUTE_TABLE) {
    it(`mounts ${route.path} with its page heading and no console noise`, async () => {
      site = mountWebsite(container, { history: createMemoryHistory(route.path) });
      await flushUpdates();
      expect(text(container.querySelector(`#${route.titleId}`))).toBe(route.title);
      // Exactly one outlet, shell landmarks present.
      expect(container.querySelectorAll('#page-outlet').length).toBe(1);
      expect(container.querySelector('#brand')).not.toBeNull();
      expect(container.querySelector('#site-footer')).not.toBeNull();
      assertClean();
    });
  }
});

describe('website regression — persistent shell survives full navigation sweep', () => {
  it('keeps shell node identity and a single outlet across every route', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    await flushUpdates();
    const brand = container.querySelector('#brand');
    const footer = container.querySelector('#site-footer');
    const outlet = container.querySelector('#page-outlet');
    expect(brand).not.toBeNull();

    for (const route of ROUTE_TABLE) {
      site.router.navigate(route.path);
      await flushUpdates();
      // Shell persists as the SAME element objects (built once, never rebuilt).
      expect(container.querySelector('#brand')).toBe(brand);
      expect(container.querySelector('#site-footer')).toBe(footer);
      expect(container.querySelector('#page-outlet')).toBe(outlet);
      // Route content swapped in; still exactly one outlet, correct title.
      expect(container.querySelectorAll('#page-outlet').length).toBe(1);
      expect(text(container.querySelector(`#${route.titleId}`))).toBe(route.title);
    }
    assertClean();
  });
});

describe('website regression — keyboard affordances', () => {
  it('skip link targets the outlet, and the outlet exists to receive focus', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    await flushUpdates();
    const skip = container.querySelector('#skip-link');
    expect(skip).not.toBeNull();
    expect(skip?.getAttribute('href')).toBe('#page-outlet');
    // The target the skip link points at must exist.
    expect(container.querySelector('#page-outlet')).not.toBeNull();
    assertClean();
  });

  it('theme toggle is a real button and search input is a real control', async () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    await flushUpdates();
    const toggle = container.querySelector('#theme-toggle');
    expect(toggle?.tagName.toLowerCase()).toBe('button');
    const search = container.querySelector('#search-input');
    expect(search?.tagName.toLowerCase()).toBe('input');
    assertClean();
  });
});

describe('website regression — SSR → hydrate adopts the server render', () => {
  it('renders every route to a string without throwing', () => {
    for (const route of ROUTE_TABLE) {
      const { html } = renderWebsite(route.path);
      expect(html).toContain('id="page-outlet"');
      expect(html).toContain('id="brand"');
    }
    assertClean();
  });

  it('hydrates a server render in place, adopting the shell, then navigates', async () => {
    // "Server" render via the same deterministic build.
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

    container.innerHTML = html;
    const brandBefore = container.querySelector('#brand');
    const outletBefore = container.querySelector('#page-outlet');
    expect(brandBefore).not.toBeNull();
    expect(outletBefore).not.toBeNull();

    resetIdCounter();
    site = mountWebsite(container, {
      history: createMemoryHistory('/docs/reactivity'),
      hydrate: true,
    });
    // Shell + outlet adopted node-for-node (no recreation, no duplication).
    expect(container.querySelector('#brand')).toBe(brandBefore);
    expect(container.querySelector('#page-outlet')).toBe(outletBefore);
    expect(container.querySelectorAll('#page-outlet').length).toBe(1);

    // Live client navigation works after hydration.
    site.router.navigate('/about');
    await flushUpdates();
    expect(text(container.querySelector('#about-title'))).toBe('About');
    expect(container.querySelector('#brand')).toBe(brandBefore);
    assertClean();
  });
});
