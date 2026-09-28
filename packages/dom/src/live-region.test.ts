/**
 * Live-region announcer (§15).
 *
 * Asserts the two-persistent-regions contract: exactly one polite + one
 * assertive region on the body, reused (never accumulated) across
 * announcements, wired with the right ARIA, and torn down on destroy. Server
 * construction is an inert no-op. happy-dom runs the microtask that carries the
 * text, so tests await a microtask turn before asserting spoken text.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserDOMAdapter } from './browser-adapter.js';
import { ServerDOMAdapter } from './server-adapter.js';
import { createAnnouncer } from './live-region.js';

const flush = (): Promise<void> => Promise.resolve().then(() => {});

describe('live-region announcer (browser)', () => {
  let dom: BrowserDOMAdapter;

  beforeEach(() => {
    dom = new BrowserDOMAdapter();
    document.body.innerHTML = '';
  });

  it('creates exactly one polite + one assertive region with correct ARIA', () => {
    const a = createAnnouncer(dom);
    const polite = document.querySelector('[data-streetui-live="polite"]')!;
    const assertive = document.querySelector('[data-streetui-live="assertive"]')!;
    expect(polite).not.toBeNull();
    expect(assertive).not.toBeNull();
    expect(polite.getAttribute('aria-live')).toBe('polite');
    expect(polite.getAttribute('role')).toBe('status');
    expect(polite.getAttribute('aria-atomic')).toBe('true');
    expect(assertive.getAttribute('aria-live')).toBe('assertive');
    expect(assertive.getAttribute('role')).toBe('alert');
    a.destroy();
  });

  it('routes messages to the right region and reuses the SAME nodes (no stale pile-up)', async () => {
    const a = createAnnouncer(dom);
    a.announce('saved');
    a.announce('danger', { assertive: true });
    await flush();

    const politeRegions = document.querySelectorAll('[data-streetui-live="polite"]');
    const assertiveRegions = document.querySelectorAll('[data-streetui-live="assertive"]');
    // Still exactly one of each — announcing mutates text, never appends nodes.
    expect(politeRegions.length).toBe(1);
    expect(assertiveRegions.length).toBe(1);
    expect(politeRegions[0]!.textContent).toBe('saved');
    expect(assertiveRegions[0]!.textContent).toBe('danger');

    // A second announcement replaces the text in place.
    a.announce('updated');
    await flush();
    expect(document.querySelectorAll('[data-streetui-live="polite"]').length).toBe(1);
    expect(document.querySelector('[data-streetui-live="polite"]')!.textContent).toBe('updated');
    a.destroy();
  });

  it('clear empties both regions, destroy removes them (idempotent)', async () => {
    const a = createAnnouncer(dom);
    a.announce('x');
    a.announce('y', { assertive: true });
    await flush();
    a.clear();
    expect(document.querySelector('[data-streetui-live="polite"]')!.textContent).toBe('');
    expect(document.querySelector('[data-streetui-live="assertive"]')!.textContent).toBe('');

    a.destroy();
    expect(document.querySelector('[data-streetui-live]')).toBeNull();
    expect(() => a.destroy()).not.toThrow();
    // Announcing after destroy is a silent no-op (no region resurrected).
    a.announce('late');
    await flush();
    expect(document.querySelector('[data-streetui-live]')).toBeNull();
  });
});

describe('live-region announcer (server) — inert no-op', () => {
  it('never touches the DOM and every method is safe to call', async () => {
    const dom = new ServerDOMAdapter();
    const a = createAnnouncer(dom);
    expect(() => a.announce('hi')).not.toThrow();
    expect(() => a.announce('hi', { assertive: true })).not.toThrow();
    expect(() => a.clear()).not.toThrow();
    expect(() => a.destroy()).not.toThrow();
    await flush();
  });
});
