/**
 * StreetUI styling — canonical style model + stable identity.
 *
 * A *style* is pure, serializable data describing appearance (§1 Q1). This module
 * defines the authoring type model and the compile-time canonicalization that
 * turns any `StyleDef` into (a) a deterministic, order-independent canonical form
 * and (b) a stable class identity `s-<hash>`. Identical styles → identical
 * canonical form → identical identity → one shared CSS rule (§18 dedup).
 *
 * This file is pure and DOM-free: it never touches the graph, a signal, or the
 * renderer. It is the foundation the registry (`registry.ts`), CSS generator
 * (`css.ts`) and authoring API (`style.ts`) build on.
 */

/** A raw CSS value: a string (`'1px solid'`) or a number (lengths → px). */
export type CSSValue = string | number;

/** The responsive breakpoint keys, smallest → largest. `base` is unconditional. */
export type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl';

/** A value that may vary by breakpoint. A bare value means "all breakpoints". */
export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;

/** Native CSS pseudo-states the browser owns (styled via CSS, never JS). */
export type PseudoState =
  | 'hover' | 'focus' | 'focusVisible' | 'focusWithin'
  | 'active' | 'disabled' | 'checked' | 'firstChild' | 'lastChild';

/** Reactive component/application states (distinct from native pseudo states). */
export type ComponentState =
  | 'open' | 'closed' | 'active' | 'selected' | 'expanded' | 'collapsed'
  | 'loading' | 'error' | 'disabled' | 'invalid' | 'busy' | 'current';

/**
 * A set of CSS declarations. Keys are camelCase CSS property names; values may be
 * responsive. The curated property surface gives autocomplete and rejects unknown
 * keys under strict object-literal checking (§23) without pulling an external
 * `csstype` dependency. Unlisted-but-valid CSS can still be set via the inline
 * `style` prop escape hatch on an element (precedence §5).
 */
export interface StyleProperties {
  readonly display?: ResponsiveValue<CSSValue>;
  readonly position?: ResponsiveValue<CSSValue>;
  readonly inset?: ResponsiveValue<CSSValue>;
  readonly top?: ResponsiveValue<CSSValue>;
  readonly right?: ResponsiveValue<CSSValue>;
  readonly bottom?: ResponsiveValue<CSSValue>;
  readonly left?: ResponsiveValue<CSSValue>;
  readonly zIndex?: ResponsiveValue<CSSValue>;
  readonly width?: ResponsiveValue<CSSValue>;
  readonly minWidth?: ResponsiveValue<CSSValue>;
  readonly maxWidth?: ResponsiveValue<CSSValue>;
  readonly height?: ResponsiveValue<CSSValue>;
  readonly minHeight?: ResponsiveValue<CSSValue>;
  readonly maxHeight?: ResponsiveValue<CSSValue>;
  readonly margin?: ResponsiveValue<CSSValue>;
  readonly marginTop?: ResponsiveValue<CSSValue>;
  readonly marginRight?: ResponsiveValue<CSSValue>;
  readonly marginBottom?: ResponsiveValue<CSSValue>;
  readonly marginLeft?: ResponsiveValue<CSSValue>;
  readonly padding?: ResponsiveValue<CSSValue>;
  readonly paddingTop?: ResponsiveValue<CSSValue>;
  readonly paddingRight?: ResponsiveValue<CSSValue>;
  readonly paddingBottom?: ResponsiveValue<CSSValue>;
  readonly paddingLeft?: ResponsiveValue<CSSValue>;
  readonly gap?: ResponsiveValue<CSSValue>;
  readonly rowGap?: ResponsiveValue<CSSValue>;
  readonly columnGap?: ResponsiveValue<CSSValue>;
  readonly flex?: ResponsiveValue<CSSValue>;
  readonly flexDirection?: ResponsiveValue<CSSValue>;
  readonly flexWrap?: ResponsiveValue<CSSValue>;
  readonly flexGrow?: ResponsiveValue<CSSValue>;
  readonly flexShrink?: ResponsiveValue<CSSValue>;
  readonly flexBasis?: ResponsiveValue<CSSValue>;
  readonly alignItems?: ResponsiveValue<CSSValue>;
  readonly alignSelf?: ResponsiveValue<CSSValue>;
  readonly justifyContent?: ResponsiveValue<CSSValue>;
  readonly justifySelf?: ResponsiveValue<CSSValue>;
  readonly gridTemplateColumns?: ResponsiveValue<CSSValue>;
  readonly gridTemplateRows?: ResponsiveValue<CSSValue>;
  readonly gridColumn?: ResponsiveValue<CSSValue>;
  readonly gridRow?: ResponsiveValue<CSSValue>;
  readonly placeItems?: ResponsiveValue<CSSValue>;
  readonly color?: ResponsiveValue<CSSValue>;
  readonly background?: ResponsiveValue<CSSValue>;
  readonly backgroundColor?: ResponsiveValue<CSSValue>;
  readonly borderColor?: ResponsiveValue<CSSValue>;
  readonly border?: ResponsiveValue<CSSValue>;
  readonly borderWidth?: ResponsiveValue<CSSValue>;
  readonly borderStyle?: ResponsiveValue<CSSValue>;
  readonly borderRadius?: ResponsiveValue<CSSValue>;
  readonly boxShadow?: ResponsiveValue<CSSValue>;
  readonly outline?: ResponsiveValue<CSSValue>;
  readonly opacity?: ResponsiveValue<CSSValue>;
  readonly fontFamily?: ResponsiveValue<CSSValue>;
  readonly fontSize?: ResponsiveValue<CSSValue>;
  readonly fontWeight?: ResponsiveValue<CSSValue>;
  readonly lineHeight?: ResponsiveValue<CSSValue>;
  readonly letterSpacing?: ResponsiveValue<CSSValue>;
  readonly textAlign?: ResponsiveValue<CSSValue>;
  readonly textDecoration?: ResponsiveValue<CSSValue>;
  readonly textTransform?: ResponsiveValue<CSSValue>;
  readonly whiteSpace?: ResponsiveValue<CSSValue>;
  readonly overflow?: ResponsiveValue<CSSValue>;
  readonly overflowX?: ResponsiveValue<CSSValue>;
  readonly overflowY?: ResponsiveValue<CSSValue>;
  readonly cursor?: ResponsiveValue<CSSValue>;
  readonly transition?: ResponsiveValue<CSSValue>;
  readonly transform?: ResponsiveValue<CSSValue>;
  readonly appearance?: ResponsiveValue<CSSValue>;
  readonly userSelect?: ResponsiveValue<CSSValue>;
  readonly pointerEvents?: ResponsiveValue<CSSValue>;
  /** Reactive CSS custom properties (`--name`) — the signal-driven channel (§6). */
  readonly vars?: Readonly<Record<`--${string}`, CSSValue>>;
}

/**
 * A full style definition: base declarations plus optional pseudo-state,
 * component-state and a11y-state overrides. Each override block is itself a set
 * of (non-responsive) declarations.
 */
export interface StyleDef extends StyleProperties {
  /** Native pseudo-state overrides (`:hover`, `:focus-visible`, …) — §9. */
  readonly on?: Partial<Record<PseudoState, StyleProperties>>;
  /** Component-state overrides → `[data-<state>]` selectors — §10. */
  readonly when?: Partial<Record<ComponentState, StyleProperties>>;
}

/** A canonical, order-independent, JSON-serializable form of a `StyleDef`. */
export type CanonicalStyle = string;

const LENGTH_PROPS = new Set<string>([
  'inset', 'top', 'right', 'bottom', 'left', 'width', 'minWidth', 'maxWidth',
  'height', 'minHeight', 'maxHeight', 'margin', 'marginTop', 'marginRight',
  'marginBottom', 'marginLeft', 'padding', 'paddingTop', 'paddingRight',
  'paddingBottom', 'paddingLeft', 'gap', 'rowGap', 'columnGap', 'flexBasis',
  'borderWidth', 'borderRadius', 'fontSize', 'letterSpacing',
]);

/** camelCase → kebab-case CSS property name (`backgroundColor` → `background-color`). */
export function cssPropName(camel: string): string {
  if (camel.startsWith('--')) return camel; // custom property: untouched
  return camel.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Format a CSS value: unitless numbers on length props get `px`; others pass through. */
export function cssValue(prop: string, value: CSSValue): string {
  if (typeof value === 'number') {
    if (value === 0) return '0';
    return LENGTH_PROPS.has(prop) ? `${value}px` : String(value);
  }
  return value;
}

/** Recursively sort object keys so equal content always stringifies identically. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue; // exactOptionalPropertyTypes: drop absent keys
      out[key] = sortDeep(v);
    }
    return out;
  }
  return value;
}

/** Produce the canonical form of a style definition (stable across key order). */
export function canonicalize(def: StyleDef): CanonicalStyle {
  return JSON.stringify(sortDeep(def));
}

/**
 * FNV-1a (two seeds) → a stable, dependency-free class identity. Two 32-bit
 * passes are concatenated in base36 to make collisions between distinct styles
 * astronomically unlikely for realistic app style counts. Deterministic: the
 * same canonical form always yields the same id on server and client (§11/§12).
 */
export function hashIdentity(canonical: CanonicalStyle): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193 ^ canonical.length;
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  const a = (h1 >>> 0).toString(36);
  const b = (h2 >>> 0).toString(36);
  return `s-${a}${b}`;
}

/** Convenience: canonical form + identity in one call. */
export function identityOf(def: StyleDef): { canonical: CanonicalStyle; id: string } {
  const canonical = canonicalize(def);
  return { canonical, id: hashIdentity(canonical) };
}
