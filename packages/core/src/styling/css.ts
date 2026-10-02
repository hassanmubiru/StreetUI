/**
 * StreetUI styling — compile-time CSS generation (§7-§10, §15).
 *
 * Turns a `StyleDef` + its stable identity into CSS rule text. All generation is
 * pure and happens at author/compile time; nothing here runs per render. Output
 * is deterministic (properties sorted, fixed media order) so identities and bytes
 * are stable across server and client (§11/§16).
 *
 * Property values that are objects of the shape `{ base, sm, md, lg, xl }` expand
 * to a base declaration plus `@media (min-width: …)` blocks (§7). Pseudo states
 * (`on`) become `.id:hover` etc. (§9). Component states (`when`) become
 * `.id[data-<state>]` selectors driven reactively by a data attribute (§10).
 */

import {
  type StyleDef, type StyleProperties, type CSSValue, type Breakpoint,
  type PseudoState, type ComponentState,
  cssPropName, cssValue,
} from './canonical.js';

/** Default breakpoint minimum widths (px). Mirrors the default token breakpoints. */
export const BREAKPOINTS: Readonly<Record<Exclude<Breakpoint, 'base'>, number>> = {
  sm: 480, md: 768, lg: 1024, xl: 1280,
};

const PSEUDO_SELECTOR: Readonly<Record<PseudoState, string>> = {
  hover: ':hover', focus: ':focus', focusVisible: ':focus-visible',
  focusWithin: ':focus-within', active: ':active', disabled: ':disabled',
  checked: ':checked', firstChild: ':first-child', lastChild: ':last-child',
};

/** `data-<state>` attribute name a component state maps to (§10). */
export function stateAttr(state: ComponentState): string {
  return `data-${state}`;
}

function isResponsiveObject(v: unknown): v is Partial<Record<Breakpoint, CSSValue>> {
  return v !== null && typeof v === 'object';
}

/** Split properties into a base declaration block and per-breakpoint blocks. */
function splitResponsive(props: StyleProperties): {
  base: Array<[string, CSSValue]>;
  media: Record<Exclude<Breakpoint, 'base'>, Array<[string, CSSValue]>>;
} {
  const base: Array<[string, CSSValue]> = [];
  const media = { sm: [], md: [], lg: [], xl: [] } as Record<
    Exclude<Breakpoint, 'base'>, Array<[string, CSSValue]>
  >;
  for (const key of Object.keys(props).sort()) {
    if (key === 'vars') {
      const vars = (props as StyleProperties).vars;
      if (vars) for (const vk of Object.keys(vars).sort()) base.push([vk, vars[vk as `--${string}`]!]);
      continue;
    }
    const raw = (props as Record<string, unknown>)[key];
    if (raw === undefined) continue;
    if (isResponsiveObject(raw)) {
      const r = raw as Partial<Record<Breakpoint, CSSValue>>;
      if (r.base !== undefined) base.push([key, r.base]);
      for (const bp of ['sm', 'md', 'lg', 'xl'] as const) {
        if (r[bp] !== undefined) media[bp].push([key, r[bp]!]);
      }
    } else {
      base.push([key, raw as CSSValue]);
    }
  }
  return { base, media };
}

/** Render a list of [camelProp, value] pairs to a `prop:value;` declaration body. */
function declBody(pairs: Array<[string, CSSValue]>): string {
  let out = '';
  for (const [prop, val] of pairs) out += `${cssPropName(prop)}:${cssValue(prop, val)};`;
  return out;
}

/** Render a flat (non-responsive) properties block for pseudo/state overrides. */
function flatBody(props: StyleProperties): string {
  const pairs: Array<[string, CSSValue]> = [];
  for (const key of Object.keys(props).sort()) {
    if (key === 'vars') {
      const vars = props.vars;
      if (vars) for (const vk of Object.keys(vars).sort()) pairs.push([vk, vars[vk as `--${string}`]!]);
      continue;
    }
    const raw = (props as Record<string, unknown>)[key];
    if (raw === undefined) continue;
    // In override blocks a responsive object collapses to its base value only.
    if (isResponsiveObject(raw)) {
      const b = (raw as Partial<Record<Breakpoint, CSSValue>>).base;
      if (b !== undefined) pairs.push([key, b]);
    } else {
      pairs.push([key, raw as CSSValue]);
    }
  }
  return declBody(pairs);
}

export interface GeneratedCSS {
  /** Base rule + any responsive `@media` blocks. */
  readonly base: string;
  /** Pseudo-state and component-state rules (empty string when none). */
  readonly state: string;
  /** Whether the style declares any responsive values (for registry banding). */
  readonly hasResponsive: boolean;
}

/**
 * Generate the CSS for a style identity. The caller registers `base` under the
 * `base`/`responsive` band and `state` under the `state` band.
 */
export function generateCSS(id: string, def: StyleDef): GeneratedCSS {
  const sel = `.${id}`;
  const { base, media } = splitResponsive(def);

  let baseCss = '';
  const baseBody = declBody(base);
  if (baseBody.length > 0) baseCss += `${sel}{${baseBody}}`;
  let hasResponsive = false;
  for (const bp of ['sm', 'md', 'lg', 'xl'] as const) {
    if (media[bp].length > 0) {
      hasResponsive = true;
      baseCss += `@media (min-width:${BREAKPOINTS[bp]}px){${sel}{${declBody(media[bp])}}}`;
    }
  }

  let stateCss = '';
  if (def.on) {
    for (const ps of Object.keys(def.on).sort() as PseudoState[]) {
      const block = def.on[ps];
      if (!block) continue;
      const body = flatBody(block);
      if (body.length > 0) stateCss += `${sel}${PSEUDO_SELECTOR[ps]}{${body}}`;
    }
  }
  if (def.when) {
    for (const st of Object.keys(def.when).sort() as ComponentState[]) {
      const block = def.when[st];
      if (!block) continue;
      const body = flatBody(block);
      if (body.length > 0) stateCss += `${sel}[${stateAttr(st)}]{${body}}`;
    }
  }

  return { base: baseCss, state: stateCss, hasResponsive };
}
