/**
 * StreetJS website — SSR/hydration-safe theme (light / dark / system).
 *
 * Theme is ordinary app state: a StreetUI signal. Browser-only parts (stored
 * preference, OS colour scheme, writing `data-theme` on <html>) are guarded so
 * the same module runs under SSR. The attribute lives on <html>, outside the
 * hydrated app container, so applying it after mount is not a hydration
 * mismatch.
 */

import { signal, derived, effect, type Signal, type ReadonlySignal } from 'streetui';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'streetjs-theme';
const CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

export interface ThemeStorage {
  read(): ThemeChoice | null;
  write(choice: ThemeChoice): void;
}

/** A storage that remembers nothing (SSR / tests). */
export const nullThemeStorage: ThemeStorage = { read: () => null, write: () => {} };

/** Guarded localStorage adapter; falls back to memory where unavailable. */
export function defaultThemeStorage(): ThemeStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        read() {
          const v = localStorage.getItem(THEME_STORAGE_KEY);
          return v === 'light' || v === 'dark' || v === 'system' ? v : null;
        },
        write(choice) {
          try { localStorage.setItem(THEME_STORAGE_KEY, choice); } catch { /* quota/denied */ }
        },
      };
    }
  } catch { /* access denied → memory */ }
  let mem: ThemeChoice | null = null;
  return { read: () => mem, write: (c) => { mem = c; } };
}

function systemPrefersDark(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export interface ThemeController {
  readonly choice: Signal<ThemeChoice>;
  readonly resolved: ReadonlySignal<ResolvedTheme>;
  set(choice: ThemeChoice): void;
  /** light → dark → system → light. */
  cycle(): void;
  /** e.g. "Theme: System" — bind to the toggle button. */
  readonly label: ReadonlySignal<string>;
  dispose(): void;
}

export interface ThemeOptions {
  readonly storage?: ThemeStorage;
  readonly root?: Element | null;
  readonly initial?: ThemeChoice;
}

export function createTheme(options: ThemeOptions = {}): ThemeController {
  const storage = options.storage ?? defaultThemeStorage();
  const choice = signal<ThemeChoice>(storage.read() ?? options.initial ?? 'system');
  const resolved = derived<ResolvedTheme>(() => {
    const c = choice.get();
    if (c === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return c;
  });
  const label = derived(() => {
    const c = choice.get();
    return c === 'light' ? 'Theme: Light' : c === 'dark' ? 'Theme: Dark' : 'Theme: System';
  });

  const root = options.root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  const stop = root !== null
    ? effect(() => { root.setAttribute('data-theme', resolved.get()); })
    : () => { /* SSR: nothing to apply */ };

  return {
    choice,
    resolved,
    label,
    set(next) { choice.set(next); storage.write(next); },
    cycle() {
      const i = CHOICES.indexOf(choice.get());
      const next = CHOICES[(i + 1) % CHOICES.length]!;
      choice.set(next);
      storage.write(next);
    },
    dispose() { stop(); },
  };
}
