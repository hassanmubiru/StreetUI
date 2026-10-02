/**
 * StreetUI styling — public surface of the unified styling system.
 *
 * Everything here is pure, DOM-free and reactivity-free: the authoring API
 * (`style`, `styleVariants`, `cx`), the design-token system (`createThemeTokens`,
 * `tokens`), the canonical model + identity, the deduplicated rule registry, and
 * the compile-time CSS generator. The reactive theme *controller* (`createTheme`)
 * lives in the renderer layer because it writes to the DOM; it consumes the
 * `tokens` exported here.
 */

export {
  type CSSValue, type Breakpoint, type ResponsiveValue, type PseudoState,
  type ComponentState, type StyleProperties, type StyleDef, type CanonicalStyle,
  cssPropName, cssValue, canonicalize, hashIdentity, identityOf,
} from './canonical.js';

export {
  type StyleBand, StyleRegistry, styleRegistry,
} from './registry.js';

export {
  type GeneratedCSS, BREAKPOINTS, stateAttr, generateCSS,
} from './css.js';

export {
  type TokenLeaf, type TokenTree, type TokenRefs, type ThemeTokenDef,
  type DeepPartial, type ThemeTokens, createThemeTokens, DEFAULT_TOKENS, tokens,
} from './tokens.js';

export {
  type VariantGroups, type VariantConfig, type VariantSelection, type VariantFn,
  style, cx, styleVariants,
} from './style.js';
