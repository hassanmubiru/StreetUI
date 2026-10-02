/**
 * StreetUI styling — the public authoring API: `style()` and `styleVariants()`.
 *
 * `style(def)` canonicalizes a definition, registers its deduplicated CSS once,
 * and returns the stable class token (a plain string) to spread onto an element's
 * `class` (§2/§5/§18). Being a plain string makes it trivially composable and
 * tree-shakeable with no runtime dependency. A *static* `style()` call opens no
 * signal, no subscription and no effect (§3) — it is pure compile-time data.
 *
 * `styleVariants(cfg)` builds a type-safe family of styles. Variant group keys and
 * values are mapped types, so selecting an unknown group or value is a TypeScript
 * error (§11/§23) — no stringly-typed variant names. The returned function yields
 * the merged, deduped class list for a selection.
 */

import { type StyleDef, identityOf } from './canonical.js';
import { generateCSS } from './css.js';
import { styleRegistry } from './registry.js';

/**
 * Register a style definition and return its class token. Idempotent: the same
 * definition always maps to the same token and a single shared CSS rule.
 */
export function style(def: StyleDef): string {
  const { id } = identityOf(def);
  if (!styleRegistry.has(id)) {
    const gen = generateCSS(id, def);
    styleRegistry.register(id, gen.hasResponsive ? 'responsive' : 'base', gen.base);
    if (gen.state.length > 0) {
      // State/pseudo rules share the identity but register under the state band so
      // they always serialize after base/responsive rules (deterministic cascade).
      styleRegistry.register(`${id}~state`, 'state', gen.state);
    }
  }
  return id;
}

/** Join class tokens/strings, dropping falsy entries. `cx('a', cond && 'b')`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  let out = '';
  for (const p of parts) {
    if (!p) continue;
    out = out.length === 0 ? p : `${out} ${p}`;
  }
  return out;
}

// ── Variants ──────────────────────────────────────────────────────────────────

export type VariantGroups = Record<string, Record<string, StyleDef>>;

export interface VariantConfig<V extends VariantGroups> {
  /** Shared declarations applied to every variant combination. */
  readonly base?: StyleDef;
  /** Named variant groups; each maps a value name to its own `StyleDef`. */
  readonly variants: V;
  /** Default selection used when a group is omitted at call time. */
  readonly defaultVariants?: { readonly [K in keyof V]?: keyof V[K] };
}

/** A selection object: for each group, an optional value from that group. */
export type VariantSelection<V extends VariantGroups> = {
  readonly [K in keyof V]?: keyof V[K];
};

/** The callable produced by `styleVariants` — `button({ intent:'danger' })`. */
export type VariantFn<V extends VariantGroups> = (selection?: VariantSelection<V>) => string;

/**
 * Build a type-safe variant family. All base and variant-value styles are
 * registered up front (each as its own deduped identity), so calling the returned
 * function only *selects* among precompiled classes — no runtime style work (§11).
 */
export function styleVariants<V extends VariantGroups>(cfg: VariantConfig<V>): VariantFn<V> {
  const baseClass = cfg.base ? style(cfg.base) : '';
  // Precompute every group's value → class token.
  const groupClasses: Record<string, Record<string, string>> = {};
  for (const group of Object.keys(cfg.variants)) {
    const values = cfg.variants[group]!;
    const map: Record<string, string> = {};
    for (const value of Object.keys(values)) map[value] = style(values[value]!);
    groupClasses[group] = map;
  }

  const defaults = cfg.defaultVariants ?? {};

  return (selection?: VariantSelection<V>) => {
    const parts: string[] = [];
    if (baseClass) parts.push(baseClass);
    for (const group of Object.keys(groupClasses)) {
      const chosen = (selection?.[group as keyof V] ?? defaults[group as keyof V]) as
        | string | undefined;
      if (chosen === undefined) continue;
      const cls = groupClasses[group]![chosen];
      if (cls) parts.push(cls);
    }
    return cx(...parts);
  };
}
