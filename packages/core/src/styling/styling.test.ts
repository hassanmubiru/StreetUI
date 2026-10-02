/**
 * StreetUI styling — core model unit tests (§3/§7/§11/§15/§18).
 *
 * These exercise the pure, DOM-free parts of the styling system: identity
 * determinism and deduplication (§15/§18), static-produces-no-reactivity (§3),
 * dark-override token emission (§7), type-safe variant selection (§11), and
 * deterministic CSS generation incl. responsive/pseudo/state (§8/§9/§10).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  identityOf, canonicalize, cssPropName, cssValue,
  styleRegistry, generateCSS, stateAttr, BREAKPOINTS,
  style, cx, styleVariants, createThemeTokens, type StyleDef,
} from './index.js';

beforeEach(() => styleRegistry.reset());

describe('canonical identity', () => {
  it('is deterministic and order-independent', () => {
    const a = identityOf({ color: 'red', display: 'flex' });
    const b = identityOf({ display: 'flex', color: 'red' });
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^s-[0-9a-z]+$/);
  });

  it('drops undefined and distinguishes real differences', () => {
    const withUndef: Record<string, unknown> = { color: 'red', margin: undefined };
    const a = identityOf(withUndef as StyleDef);
    const b = identityOf({ color: 'red' });
    const c = identityOf({ color: 'blue' });
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it('canonical form sorts nested blocks', () => {
    const canon = canonicalize({ on: { hover: { color: 'red' }, focus: { color: 'blue' } } });
    expect(canon.indexOf('focus')).toBeLessThan(canon.indexOf('hover'));
  });
});

describe('cssPropName / cssValue', () => {
  it('camelCases to kebab and leaves custom props untouched', () => {
    expect(cssPropName('backgroundColor')).toBe('background-color');
    expect(cssPropName('--my-var')).toBe('--my-var');
  });
  it('appends px to length props but not unitless', () => {
    expect(cssValue('margin', 8)).toBe('8px');
    expect(cssValue('margin', 0)).toBe('0');
    expect(cssValue('lineHeight', 1.5)).toBe('1.5');
    expect(cssValue('zIndex', 10)).toBe('10');
  });
});

describe('style() registration and dedup (§15/§18)', () => {
  it('N identical styles register exactly one rule', () => {
    const defs: StyleDef = { color: 'red', padding: 8 };
    const first = style(defs);
    for (let i = 0; i < 10_000; i++) style({ color: 'red', padding: 8 });
    expect(styleRegistry.size).toBe(1);
    expect(style(defs)).toBe(first);
  });

  it('serializes a stable, non-empty rule and empty when reset', () => {
    style({ color: 'red' });
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('color:red');
    styleRegistry.reset();
    expect(styleRegistry.serializeCSS()).toBe('');
  });

  it('is a pure string — opens no reactive subscription (§3)', () => {
    const token = style({ color: 'red' });
    expect(typeof token).toBe('string');
    // No signal/effect machinery is touched: the return is a plain class token.
    expect(token.startsWith('s-')).toBe(true);
  });
});

describe('generateCSS (§8/§9/§10)', () => {
  it('emits base, @media, pseudo and component-state rules deterministically', () => {
    const { id } = identityOf({});
    const gen = generateCSS(id, {
      color: 'red',
      padding: { base: 4, md: 8 },
      on: { hover: { color: 'blue' } },
      when: { open: { color: 'green' } },
    });
    expect(gen.base).toContain(`.${id}{`);
    expect(gen.base).toContain(`@media (min-width:${BREAKPOINTS.md}px)`);
    expect(gen.hasResponsive).toBe(true);
    expect(gen.state).toContain(`.${id}:hover{`);
    expect(gen.state).toContain(`.${id}[${stateAttr('open')}]{`);
  });
});

describe('cx', () => {
  it('joins truthy parts and drops falsy', () => {
    expect(cx('a', false, 'b', null, undefined, 'c')).toBe('a b c');
    expect(cx()).toBe('');
  });
});

describe('styleVariants (§11)', () => {
  const button = styleVariants({
    base: { display: 'inline-flex' },
    variants: {
      intent: { primary: { color: 'white' }, danger: { color: 'red' } },
      size: { sm: { padding: 4 }, lg: { padding: 12 } },
    },
    defaultVariants: { intent: 'primary', size: 'sm' },
  });

  it('applies defaults and selection', () => {
    const def = button();
    const danger = button({ intent: 'danger', size: 'lg' });
    expect(def.split(' ').length).toBe(3); // base + intent + size
    expect(danger).not.toBe(def);
  });

  it('precompiles every variant class up front (selection does no style work)', () => {
    const before = styleRegistry.size;
    button({ intent: 'danger' });
    button({ intent: 'primary' });
    expect(styleRegistry.size).toBe(before); // nothing new registered at call time
  });
});

describe('createThemeTokens (§6/§7)', () => {
  it('emits :root vars and a dark block that only re-points colors', () => {
    const t = createThemeTokens({
      light: { color: { bg: '#fff' }, space: { sm: '4px' } },
      dark: { color: { bg: '#000' } },
    });
    expect(t.ref.color.bg).toBe('var(--color-bg)');
    expect(t.css).toContain(':root{');
    expect(t.css).toContain('--color-bg:#fff');
    expect(t.css).toContain('[data-theme="dark"]{--color-bg:#000;}');
    // dark does NOT duplicate the whole definition — space is absent from dark.
    expect(t.css.split('[data-theme="dark"]')[1]).not.toContain('--space-sm');
  });

  it('is idempotent by content identity', () => {
    styleRegistry.reset();
    createThemeTokens({ light: { a: '1' } });
    const size = styleRegistry.size;
    createThemeTokens({ light: { a: '1' } });
    expect(styleRegistry.size).toBe(size);
  });
});
