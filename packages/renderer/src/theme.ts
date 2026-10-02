/**
 * StreetUI styling — first-class, SSR/hydration-safe theme controller (§7).
 *
 * Theme is ordinary StreetUI state: a signal for the user's choice and a derived
 * signal for the resolved concrete theme. The only browser-specific parts —
 * reading a stored preference, matching the OS color scheme, and writing the
 * `data-theme` attribute onto a root element — are isolated behind guards so the
 * exact same module runs during SSR (no `document`, no `localStorage`) without
 * throwing. The server renders with the default theme; the client applies the
 * persisted/system choice on mount, which is a legitimate post-hydration update
 * rather than a hydration mismatch: the attribute lives on the root element,
 * outside the hydrated app container, and only re-points token variables (§16).
 *
 * This lives in the renderer layer because switching the theme writes to the DOM;
 * it builds on the DOM-free token system in `@streetui/core` (`createThemeTokens`
 * emits `:root` + `[data-theme="dark"]` variable blocks), so a theme flip is a
 * single attribute change with no restyle work and no re-render.
 */

import { signal, derived, effect, type Signal, type ReadonlySignal } from '@streetui/state';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const DEFAULT_STORAGE_KEY = 'streetui-theme';
const CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

/** Minimal persistence seam so tests/SSR can run without a real localStorage. */
export interface ThemeStorage {
  read(): ThemeChoice | null;
  write(choice: ThemeChoice): void;
}

/** Browser localStorage adapter, guarded; falls back to in-memory elsewhere. */
export function defaultThemeStorage(key: string = DEFAULT_STORAGE_KEY): ThemeStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        read() {
          const v = localStorage.getItem(key);
          return v === 'light' || v === 'dark' || v === 'system' ? v : null;
        },
        write(choice) {
          try { localStorage.setItem(key, choice); } catch { /* ignore quota/denied */ }
        },
      };
    }
  } catch { /* access denied (SSR, privacy mode) → in-memory */ }
  let mem: ThemeChoice | null = null;
  return { read: () => mem, write: (c) => { mem = c; } };
}

/** True when the OS prefers dark; false when it can't be determined (SSR). */
function systemPrefersDark(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export interface ThemeController {
  /** The user's choice: light | dark | system. */
  readonly choice: Signal<ThemeChoice>;
  /** The resolved concrete theme after applying `system`. */
  readonly resolved: ReadonlySignal<ResolvedTheme>;
  /** Set an explicit choice (persisted). */
  set(choice: ThemeChoice): void;
  /** Advance light → dark → system → light (for a single toggle control). */
  cycle(): void;
  /** Human label for the current choice (bind to the toggle button). */
  readonly label: ReadonlySignal<string>;
  /** Stop applying the theme to the DOM (disposes the effect). */
  dispose(): void;
}

export interface ThemeOptions {
  readonly storage?: ThemeStorage;
  /** Element to receive `data-theme` (defaults to the document root). Omit for SSR. */
  readonly root?: Element | null;
  /** Initial choice when nothing is stored (default 'system'). */
  readonly initial?: ThemeChoice;
}

/**
 * Create the theme controller. During SSR pass no `root` (or it will be null);
 * the signal still works so server markup can read `resolved`, but no DOM write
 * is attempted. Reactive theme switching is a single `data-theme` flip (§7/§16).
 */
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

  // Apply the resolved theme to the root element whenever it changes. The root
  // is resolved lazily so this is a no-op under SSR (no document).
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
