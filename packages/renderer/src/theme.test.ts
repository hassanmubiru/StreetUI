/**
 * StreetUI styling — reactive theme controller tests (§7/§16).
 *
 * Verifies that the theme controller is pure StreetUI state (no second reactive
 * system), that switching is a single `data-theme` flip on a root element (not a
 * re-render), that `system` resolves against a stubbed media query, that storage
 * persists the choice, and that SSR (no root) performs no DOM write but still
 * exposes a readable resolved signal.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTheme, defaultThemeStorage, type ThemeStorage } from './theme.js';

function memStorage(initial: 'light' | 'dark' | 'system' | null = null): ThemeStorage {
  let v = initial;
  return { read: () => v, write: (c) => { v = c; } };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('createTheme (§7)', () => {
  it('writes data-theme on the root and flips it on set (single attribute, no re-render)', () => {
    const root = document.createElement('html');
    const t = createTheme({ root, storage: memStorage('light') });
    expect(root.getAttribute('data-theme')).toBe('light');
    t.set('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    t.dispose();
  });

  it('cycle advances light → dark → system → light', () => {
    const root = document.createElement('html');
    const store = memStorage('light');
    const t = createTheme({ root, storage: store });
    expect(t.choice.get()).toBe('light');
    t.cycle(); expect(t.choice.get()).toBe('dark');
    t.cycle(); expect(t.choice.get()).toBe('system');
    t.cycle(); expect(t.choice.get()).toBe('light');
    t.dispose();
  });

  it('persists the choice through storage', () => {
    const root = document.createElement('html');
    const store = memStorage(null);
    const a = createTheme({ root, storage: store });
    a.set('dark');
    a.dispose();
    const b = createTheme({ root, storage: store });
    expect(b.choice.get()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    b.dispose();
  });

  it('resolves "system" against the OS preference', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark') }) as MediaQueryList);
    const root = document.createElement('html');
    const t = createTheme({ root, storage: memStorage('system') });
    expect(t.resolved.get()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    t.dispose();
  });

  it('exposes a human label bound to the choice', () => {
    const t = createTheme({ root: document.createElement('html'), storage: memStorage('light') });
    expect(t.label.get()).toBe('Theme: Light');
    t.set('system');
    expect(t.label.get()).toBe('Theme: System');
    t.dispose();
  });

  it('SSR (no root) performs no DOM write but still resolves', () => {
    const t = createTheme({ root: null, storage: memStorage('dark') });
    expect(t.resolved.get()).toBe('dark');
    expect(() => t.dispose()).not.toThrow();
  });

  it('defaultThemeStorage is SSR-safe and round-trips in-memory when localStorage is absent', () => {
    const original = globalThis.localStorage;
    // Simulate absence of localStorage (SSR).
    vi.stubGlobal('localStorage', undefined);
    const s = defaultThemeStorage('x');
    expect(s.read()).toBeNull();
    s.write('dark');
    expect(s.read()).toBe('dark');
    vi.stubGlobal('localStorage', original);
  });
});
