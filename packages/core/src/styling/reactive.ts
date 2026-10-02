/**
 * StreetUI styling — reactive scalar styles (§4).
 *
 * A reactive scalar style value (a signal) must update **one** property on **one**
 * element with no class churn and no DOM reconstruction. The mechanism rides the
 * existing reactive seam exactly: the appearance is a *static*, deduped rule that
 * reads a **CSS custom property**, and the signal drives only that custom
 * property via the renderer's existing `style.<prop>` binding path
 * (`applyProp` → `el.style.setProperty`). One signal → one `setProperty`.
 *
 * `styleWithVars(staticDef, reactiveProps)` returns:
 *   • `class` — the static class token for a `StyleDef` whose reactive properties
 *     are rewritten to `var(--s-<prop>)` (so the rule itself never changes), and
 *   • `vars`  — the custom-property name per reactive prop (`width` → `--s-width`),
 *     and the `style.<custom-prop>` binding key to attach the signal to.
 *
 * This introduces no second reactive system and no runtime style framework: the
 * returned `class` is a plain string (deduped like any other `style()`), and the
 * reactive binding is a single `StateRef { propKey: 'style.--s-<prop>' }` wired by
 * the existing `wireSignalBindings`/`applyProp` pipeline. Core stays free of any
 * `@streetui/state` dependency — the caller supplies the signal at the DSL layer.
 */

import { type CSSValue, type StyleDef, cssPropName, cssValue } from './canonical.js';
import { style } from './style.js';

/** The reactive binding surface for one `styleWithVars` call. */
export interface ReactiveStyle<K extends string> {
  /** Static, deduped class token; reactive props read `var(--s-<prop>)`. */
  readonly class: string;
  /** Per reactive prop: its CSS custom-property name, e.g. `width` → `--s-width`. */
  readonly vars: Readonly<Record<K, string>>;
  /** Per reactive prop: the renderer binding key, e.g. `width` → `style.--s-width`. */
  readonly bind: Readonly<Record<K, string>>;
}

/** The CSS custom-property name a reactive prop compiles to (`width` → `--s-width`). */
export function reactiveVarName(prop: string): string {
  return `--s-${cssPropName(prop)}`;
}

/**
 * Compile a style whose listed properties are driven by signals at runtime. The
 * rule is static and deduped (reads `var(--s-<prop>)`); the caller binds each
 * `bind[prop]` key to a signal so one change is one `setProperty` (§4).
 */
export function styleWithVars<K extends string>(
  staticDef: StyleDef,
  reactiveProps: readonly K[],
): ReactiveStyle<K> {
  const vars = {} as Record<K, string>;
  const bind = {} as Record<K, string>;
  const dynamic: Record<string, CSSValue> = {};
  for (const prop of reactiveProps) {
    const varName = reactiveVarName(prop);
    vars[prop] = varName;
    bind[prop] = `style.${varName}`;
    // The static rule only ever references the custom property, so it is stable
    // and deduped — the signal updates the property, never the rule or the class.
    dynamic[prop] = `var(${varName})`;
  }
  const merged = { ...staticDef, ...dynamic } as StyleDef;
  return { class: style(merged), vars, bind };
}

/**
 * Format a reactive scalar for assignment to its custom property, applying the
 * same unit rule as static values (unitless numbers on length props get `px`).
 * Use this in the signal/derived that feeds a `styleWithVars` binding so that
 * `widthSignal.set(240)` yields `--s-width: 240px`.
 */
export function reactiveVarValue(prop: string, value: CSSValue): string {
  return cssValue(prop, value);
}
