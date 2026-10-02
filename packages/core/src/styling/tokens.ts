/**
 * StreetUI styling — first-class design tokens + theming (§6/§7/§16).
 *
 * Tokens are declared as a nested tree of named values and compiled to CSS custom
 * properties emitted once under `:root`, with dark-mode values emitted under
 * `[data-theme="dark"]`. A token *reference* is the string `var(--name)`, usable
 * anywhere a CSS value is expected inside a `StyleDef`. Dark mode therefore never
 * duplicates a style definition — it only re-points the variables (§7/§16).
 *
 * SSR/hydration safety: the token CSS is registered in the shared style registry
 * (tokens band) and serialized into the single `<style data-streetui-css>` block
 * like any other rule, so the server ships the variables and the client adopts
 * them. Switching theme is a single `data-theme` attribute flip on the root
 * element — no restyle work, no re-render (§16).
 */

import { styleRegistry } from './registry.js';

export type TokenLeaf = string | number;
export interface TokenTree { readonly [key: string]: TokenLeaf | TokenTree; }

/** The ref tree mirrors the input shape; every leaf becomes a `var(--…)` string. */
export type TokenRefs<T> = {
  readonly [K in keyof T]: T[K] extends TokenLeaf
    ? string
    : T[K] extends TokenTree
      ? TokenRefs<T[K]>
      : never;
};

export interface ThemeTokenDef<L extends TokenTree> {
  /** Base (light) token values — required; defines the full token surface. */
  readonly light: L;
  /** Dark overrides — a partial subset; unlisted tokens inherit the light value. */
  readonly dark?: DeepPartial<L>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends TokenLeaf ? TokenLeaf : T[K] extends TokenTree ? DeepPartial<T[K]> : never;
};

export interface ThemeTokens<L extends TokenTree> {
  /** Token references (`var(--…)`) mirroring the declared tree. */
  readonly ref: TokenRefs<L>;
  /** The generated CSS for `:root` and `[data-theme="dark"]`. */
  readonly css: string;
  /** The stable identity under which this token block is registered. */
  readonly id: string;
}

function kebab(seg: string): string {
  return seg.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function isLeaf(v: unknown): v is TokenLeaf {
  return typeof v === 'string' || typeof v === 'number';
}

/** Walk a token tree, invoking `visit(varName, value)` for each leaf (sorted). */
function walkTokens(
  tree: TokenTree,
  path: readonly string[],
  visit: (varName: string, value: TokenLeaf) => void,
): void {
  for (const key of Object.keys(tree).sort()) {
    const v = tree[key];
    const next = [...path, kebab(key)];
    if (isLeaf(v)) visit(`--${next.join('-')}`, v);
    else walkTokens(v as TokenTree, next, visit);
  }
}

/** Build the ref tree (leaf → `var(--name)`) mirroring the token tree shape. */
function buildRefs(tree: TokenTree, path: readonly string[]): unknown {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(tree)) {
    const v = tree[key];
    const next = [...path, kebab(key)];
    out[key] = isLeaf(v) ? `var(--${next.join('-')})` : buildRefs(v as TokenTree, next);
  }
  return out;
}

/** Deterministic identity for a token block (content hash of light+dark). */
function tokenIdentity(def: ThemeTokenDef<TokenTree>): string {
  const json = JSON.stringify({ light: def.light, dark: def.dark ?? null });
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `t-${(h >>> 0).toString(36)}`;
}

/**
 * Declare a set of design tokens. Returns typed references and registers the
 * generated `:root` / `[data-theme="dark"]` CSS in the shared registry (idempotent).
 */
export function createThemeTokens<L extends TokenTree>(def: ThemeTokenDef<L>): ThemeTokens<L> {
  const id = tokenIdentity(def);

  let root = '';
  walkTokens(def.light, [], (name, value) => { root += `${name}:${value};`; });
  let dark = '';
  if (def.dark) walkTokens(def.dark as TokenTree, [], (name, value) => { dark += `${name}:${value};`; });

  let css = root.length > 0 ? `:root{${root}}` : '';
  if (dark.length > 0) css += `[data-theme="dark"]{${dark}}`;

  styleRegistry.register(id, 'tokens', css);

  return {
    ref: buildRefs(def.light, []) as TokenRefs<L>,
    css,
    id,
  };
}

/**
 * The default StreetUI semantic token set (§6/§7). Covers color surfaces, content,
 * borders, accent, focus and danger semantics, plus spacing, radii, typography,
 * shadows, z-index, durations, easings and breakpoints. Dark mode re-points only
 * the color semantics; structural tokens (spacing, radii, …) are theme-invariant.
 */
export const DEFAULT_TOKENS = {
  surface: { background: '#ffffff', raised: '#f7f7f8', sunken: '#eeeef1', overlay: 'rgba(17,17,20,0.55)' },
  content: { primary: '#17171a', secondary: '#55555f', muted: '#666672', inverse: '#ffffff' },
  border: { default: '#e3e3e8', strong: '#c9c9d1', subtle: '#f0f0f3' },
  accent: { primary: '#4f46e5', hover: '#4338ca', contrast: '#ffffff' },
  focus: { ring: '#6366f1' },
  danger: { surface: '#fef2f2', border: '#fecaca', content: '#b91c1c', solid: '#dc2626' },
  success: { content: '#15803d', solid: '#16a34a' },
  space: { '0': '0', '1': '4px', '2': '8px', '3': '12px', '4': '16px', '5': '24px', '6': '32px', '8': '48px', '10': '64px' },
  radius: { sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  font: {
    sans: 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
  },
  size: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '24px', '2xl': '32px', '3xl': '44px' },
  weight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  leading: { tight: '1.2', normal: '1.5', relaxed: '1.7' },
  shadow: {
    sm: '0 1px 2px rgba(17,17,20,0.08)',
    md: '0 4px 12px rgba(17,17,20,0.1)',
    lg: '0 12px 32px rgba(17,17,20,0.16)',
  },
  z: { base: '0', dropdown: '1000', overlay: '1100', toast: '1200' },
  duration: { fast: '120ms', base: '200ms', slow: '320ms' },
  easing: { standard: 'cubic-bezier(0.2,0,0,1)', emphasized: 'cubic-bezier(0.3,0,0,1)' },
} as const;

const DARK_OVERRIDES = {
  surface: { background: '#0f0f12', raised: '#17171c', sunken: '#0a0a0d', overlay: 'rgba(0,0,0,0.6)' },
  content: { primary: '#f4f4f6', secondary: '#b4b4bf', muted: '#7c7c88', inverse: '#17171a' },
  border: { default: '#2a2a31', strong: '#3a3a44', subtle: '#1e1e24' },
  accent: { primary: '#818cf8', hover: '#a5b4fc', contrast: '#0f0f12' },
  focus: { ring: '#a5b4fc' },
  danger: { surface: '#2a1416', border: '#5b1d1d', content: '#fca5a5', solid: '#ef4444' },
  success: { content: '#4ade80', solid: '#22c55e' },
} as const;

/** The ready-to-use default theme tokens, registered on import. */
export const tokens = createThemeTokens({ light: DEFAULT_TOKENS, dark: DARK_OVERRIDES });
