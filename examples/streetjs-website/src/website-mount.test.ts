/**
 * StreetJS website — mounted-DOM tests (happy-dom, memory history).
 *
 * These drive the real shell, router, theme, search and playground the way a
 * visitor or the server would. Real-browser behaviour (Chrome/Firefox), real
 * focus handling and axe-core are NOT covered here — see the Phase 3 report.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, resetIdCounter } from 'streetui';
import { findByRole, flushUpdates, trigger } from 'streetui/testing';
import { DOCS, PRIMARY_NAV } from './content.js';
import { renderWebsite } from './server-entry.js';
import { mountWebsite, type MountedWebsite } from './website.js';
import type { FetchLike } from './backend.js';
import type { ThemeChoice, ThemeStorage } from './theme.js';

const text = (el: Element | null): string => el?.textContent?.trim() ?? '';

function memoryStorage(initial: ThemeChoice | null = null): ThemeStorage & { value: () => ThemeChoice | null } {
  let v = initial;
  return { read: () => v, write: (c) => { v = c; }, value: () => v };
}

let site: MountedWebsite | null = null;
let container: HTMLElement;

beforeEach(() => {
  resetIdCounter();
  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
});

afterEach(() => {
  site?.unmount();
  site = null;
  container.remove();
  document.head.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
});

function mount(path: string, extra: Parameters<typeof mountWebsite>[1] = {}): MountedWebsite {
  site = mountWebsite(container, { history: createMemoryHistory(path), themeStorage: memoryStorage(), ...extra });
  return site;
}

function key(k: string, init: KeyboardEventInit = {}, target: EventTarget = document): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

describe('shell and routing', () => {
  it('renders the persistent shell and the home route', async () => {
    mount('/');
    await flushUpdates();
    for (const id of ['skip-link', 'site-nav', 'brand', 'theme-toggle', 'search-trigger', 'menu-toggle', 'page-outlet', 'site-footer']) {
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
    expect(container.querySelector('#page-home')).not.toBeNull();
  });

  it('has one nav link per primary nav item, all with real hrefs', async () => {
    mount('/');
    await flushUpdates();
    for (const item of PRIMARY_NAV) {
      const a = container.querySelector(`#${item.id}`);
      expect(a, item.id).not.toBeNull();
      expect(a?.getAttribute('href')).toBe(item.href);
    }
  });

  it('navigates client-side to a doc section and marks the active link', async () => {
    const s = mount('/');
    const first = DOCS[0]!;
    s.router.navigate(`/docs/${first.slug}`);
    await flushUpdates();
    expect(container.querySelector('#page-doc')).not.toBeNull();
    expect(container.querySelector('#nav-docs-active')).not.toBeNull();
    expect(container.querySelector('#nav-api-active')).toBeNull();
  });

  it('renders the 404 page for an unknown path and an unknown doc slug', async () => {
    const s = mount('/definitely-not-a-page');
    await flushUpdates();
    expect(container.querySelector('#page-notfound')).not.toBeNull();
    expect(s.router.currentRoute.get().isFallback).toBe(true);
    s.router.navigate('/docs/no-such-section');
    await flushUpdates();
    expect(container.querySelector('#page-notfound')).not.toBeNull();
  });

  it('every primary route mounts without throwing and shows its page section', async () => {
    const s = mount('/');
    for (const item of PRIMARY_NAV) {
      s.router.navigate(item.href);
      await flushUpdates();
      expect(container.querySelector('#page-outlet h1'), item.href).not.toBeNull();
    }
  });
});

describe('mobile menu', () => {
  it('opens and closes, and closes on navigation', async () => {
    const s = mount('/');
    await flushUpdates();
    expect(container.querySelector('#mobile-menu')).toBeNull();
    trigger(container.querySelector('#menu-toggle')!, 'click');
    await flushUpdates();
    expect(s.menuOpen.get()).toBe(true);
    expect(container.querySelector('#mobile-menu')).not.toBeNull();
    s.router.navigate('/docs');
    await flushUpdates();
    expect(s.menuOpen.get()).toBe(false);
    expect(container.querySelector('#mobile-menu')).toBeNull();
  });
});

describe('theme', () => {
  it('cycles system → light → dark → system, persists, and writes data-theme on <html>', async () => {
    const storage = memoryStorage();
    const s = mount('/', { themeStorage: storage });
    await flushUpdates();
    expect(text(container.querySelector('#theme-toggle'))).toBe('Theme: System');

    const toggle = (): void => trigger(container.querySelector('#theme-toggle')!, 'click');
    toggle(); await flushUpdates();
    expect(text(container.querySelector('#theme-toggle'))).toBe('Theme: Light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(storage.value()).toBe('light');

    toggle(); await flushUpdates();
    expect(text(container.querySelector('#theme-toggle'))).toBe('Theme: Dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    toggle(); await flushUpdates();
    expect(s.theme.choice.get()).toBe('system');
    expect(storage.value()).toBe('system');
  });

  it('restores a stored choice on mount', async () => {
    mount('/', { themeStorage: memoryStorage('dark') });
    await flushUpdates();
    expect(text(container.querySelector('#theme-toggle'))).toBe('Theme: Dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('global search', () => {
  it('opens with Ctrl+K and "/" but not "/" while typing in a field', async () => {
    const s = mount('/playground');
    await flushUpdates();
    const e1 = key('k', { ctrlKey: true });
    expect(e1.defaultPrevented).toBe(true);
    expect(s.search.open.get()).toBe(true);
    s.search.closeSearch();

    key('/');
    expect(s.search.open.get()).toBe(true);
    s.search.closeSearch();

    const field = container.querySelector<HTMLInputElement>('#decoder-input')!;
    field.focus();
    key('/', {}, field);
    expect(s.search.open.get()).toBe(false);
  });

  it('opens from the trigger button and renders the dialog on demand only', async () => {
    const s = mount('/');
    await flushUpdates();
    expect(document.getElementById('search-dialog')).toBeNull();
    trigger(container.querySelector('#search-trigger')!, 'click');
    await flushUpdates();
    expect(s.search.open.get()).toBe(true);
    expect(document.getElementById('search-input')).not.toBeNull();
    expect(document.getElementById('search-status')).not.toBeNull();
  });

  it('types a query through the input binding and shows results across kinds', async () => {
    const s = mount('/');
    s.search.openSearch();
    await flushUpdates();
    const input = document.getElementById('search-input') as HTMLInputElement;
    input.value = 'migration';
    trigger(input, 'input');
    await flushUpdates();
    expect(s.search.query.get()).toBe('migration');
    const rows = document.querySelectorAll('[id^="search-result-"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(document.getElementById('search-empty')).toBeNull();
    expect(text(document.getElementById('search-status'))).toMatch(/\d+ results?/);
  });

  it('shows the empty state when nothing matches', async () => {
    const s = mount('/');
    s.search.openSearch();
    s.search.query.set('zzzqxjv-nothing');
    await flushUpdates();
    expect(document.getElementById('search-empty')).not.toBeNull();
    expect(text(document.getElementById('search-status'))).toBe('No results');
  });

  it('Enter in the input navigates to the first result and closes the dialog', async () => {
    const s = mount('/');
    s.search.openSearch();
    s.search.query.set('migration');
    await flushUpdates();
    const first = s.search.results.get()[0]!;
    const input = document.getElementById('search-input') as HTMLInputElement;
    input.focus();
    key('Enter', {}, input);
    await flushUpdates();
    expect(s.router.currentRoute.get().path).toBe(first.href.split('?')[0]);
    expect(s.search.open.get()).toBe(false);
    expect(s.search.query.get()).toBe('');
  });

  it('ArrowDown moves focus input → first result; ArrowUp returns', async () => {
    const s = mount('/');
    s.search.openSearch();
    s.search.query.set('migration');
    await flushUpdates();
    const input = document.getElementById('search-input') as HTMLInputElement;
    input.focus();
    key('ArrowDown', {}, input);
    const firstRow = document.querySelector<HTMLElement>('[id^="search-result-"]')!;
    expect(document.activeElement?.id).toBe(firstRow.id);
    key('ArrowUp', {}, firstRow);
    expect(document.activeElement?.id).toBe('search-input');
  });

  it('clicking a result navigates through the router (no reload) and closes', async () => {
    const s = mount('/');
    s.search.openSearch();
    s.search.query.set('migration');
    await flushUpdates();
    const row = document.querySelector<HTMLAnchorElement>('a[id^="search-result-"]')!;
    const href = row.getAttribute('href')!;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    row.dispatchEvent(ev);
    await flushUpdates();
    expect(ev.defaultPrevented).toBe(true);
    expect(s.router.currentRoute.get().path).toBe(href.split('?')[0]);
    expect(s.search.open.get()).toBe(false);
  });

  it('the Close button closes and clears', async () => {
    const s = mount('/');
    s.search.openSearch();
    s.search.query.set('abc');
    await flushUpdates();
    trigger(document.getElementById('search-close')!, 'click');
    await flushUpdates();
    expect(s.search.open.get()).toBe(false);
    expect(s.search.query.get()).toBe('');
    expect(document.getElementById('search-dialog')).toBeNull();
  });

  it('stops listening after unmount', async () => {
    const s = mount('/');
    s.unmount();
    key('k', { ctrlKey: true });
    expect(s.search.open.get()).toBe(false);
    site = null;
  });
});

describe('playground and backend panel through the DOM', () => {
  it('a decoder preset fills the input and produces decoded rows', async () => {
    mount('/playground');
    await flushUpdates();
    trigger(container.querySelector('#decoder-preset-bool')!, 'click');
    await flushUpdates();
    expect((container.querySelector('#decoder-input') as HTMLInputElement).value).toBe('active | boolean | t');
    expect(container.querySelector('#decoder-rows')?.children.length ?? 0).toBeGreaterThan(0);
  });

  it('shows the invalid-URL message and does not call fetch', async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => { calls += 1; return { ok: true, status: 200, text: async () => '' }; };
    const s = mount('/playground', { fetchImpl });
    await flushUpdates();
    s.backend.baseUrl.set('ftp://nope');
    await flushUpdates();
    trigger(container.querySelector('#backend-run')!, 'click');
    await flushUpdates();
    expect(calls).toBe(0);
    expect(container.querySelector('#backend-url-error')).not.toBeNull();
  });

  it('probes only the three real framework routes and renders ok / error / unavailable states', async () => {
    const seen: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      seen.push(url);
      if (url.endsWith('/health/ready')) throw new TypeError('Failed to fetch');
      if (url.endsWith('/api/jobs/metrics')) return { ok: false, status: 404, text: async () => '' };
      return { ok: true, status: 200, text: async () => '{}' };
    };
    const s = mount('/playground', { fetchImpl });
    await flushUpdates();
    s.backend.baseUrl.set('http://localhost:3000');
    await flushUpdates();
    trigger(container.querySelector('#backend-run')!, 'click');
    for (let i = 0; i < 5; i += 1) { await Promise.resolve(); await flushUpdates(); }
    expect(seen.sort()).toEqual([
      'http://localhost:3000/api/jobs/metrics',
      'http://localhost:3000/health/live',
      'http://localhost:3000/health/ready',
    ]);
    const states = s.backend.results.get().map((r) => r.state);
    expect(states).toContain('ok');
    expect(states).toEqual(['ok', 'error', 'unavailable']);
    expect(container.querySelector('#backend-results')?.textContent).toContain('/health/ready');
    // The page itself stayed functional.
    expect(container.querySelector('#page-playground')).not.toBeNull();
  });
});

describe('SSR → hydrate', () => {
  async function hydrateFrom(path: string, stored: ThemeChoice | null) {
    const r = renderWebsite(path);
    document.head.insertAdjacentHTML('beforeend', r.head + r.styles);
    container.innerHTML = r.html;
    container.setAttribute('data-ssr', '');
    const brandBefore = container.querySelector('#brand');
    const outletBefore = container.querySelector('#page-outlet');
    resetIdCounter();
    const s = mount(path, { hydrate: true, themeStorage: memoryStorage(stored) });
    await flushUpdates();
    return { s, r, brandBefore, outletBefore };
  }

  it('adopts the server shell node-for-node and keeps navigating', async () => {
    const { s, brandBefore, outletBefore } = await hydrateFrom('/docs/' + DOCS[0]!.slug, null);
    expect(container.querySelector('#brand')).toBe(brandBefore);
    expect(container.querySelector('#page-outlet')).toBe(outletBefore);
    expect(container.querySelector('#page-doc')).not.toBeNull();
    s.router.navigate('/');
    await flushUpdates();
    expect(container.querySelector('#page-home')).not.toBeNull();
  });

  it('does not duplicate the stylesheet when hydrating', async () => {
    await hydrateFrom('/', null);
    expect(document.head.querySelectorAll('[data-streetui-css]').length).toBe(1);
  });

  it('hydrates every primary route without losing its page section', async () => {
    for (const item of PRIMARY_NAV) {
      const { s } = await hydrateFrom(item.href, null);
      expect(container.querySelector('#page-outlet h1'), item.href).not.toBeNull();
      s.unmount();
      site = null;
      container.innerHTML = '';
      document.head.innerHTML = '';
    }
  });

  it('reconciles the theme label when a stored choice differs from the server\'s "System"', async () => {
    const { r } = await hydrateFrom('/', 'dark');
    expect(r.html).toContain('Theme: System');
    // After mount the control reflects the stored choice, and <html> carries it.
    expect(text(container.querySelector('#theme-toggle'))).toBe('Theme: Dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('console hygiene', () => {
  it('mounts, navigates every route, searches and hydrates without console errors or warnings', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = mount('/');
      for (const item of PRIMARY_NAV) { s.router.navigate(item.href); await flushUpdates(); }
      s.router.navigate('/nope'); await flushUpdates();
      s.search.openSearch(); s.search.query.set('postgres'); await flushUpdates();
      s.search.closeSearch(); await flushUpdates();
      s.unmount(); site = null; container.innerHTML = '';

      const r = renderWebsite('/guides');
      document.head.insertAdjacentHTML('beforeend', r.head + r.styles);
      container.innerHTML = r.html;
      container.setAttribute('data-ssr', '');
      resetIdCounter();
      mount('/guides', { hydrate: true });
      await flushUpdates();
      expect(err).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      err.mockRestore();
      warn.mockRestore();
    }
  });
});
