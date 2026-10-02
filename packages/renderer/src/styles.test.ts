/**
 * StreetUI styling — SSR stylesheet emission + hydration adoption tests (§15–§17).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ServerDOMAdapter } from '@streetui/dom';
import { style, styleRegistry, createThemeTokens } from '@streetui/core';
import { renderStyles, adoptServerStyles } from './styles.js';

beforeEach(() => styleRegistry.reset());

describe('renderStyles (§16 empty-registry guarantee)', () => {
  it('returns "" when nothing is registered (SSR byte-identity preserved)', () => {
    expect(renderStyles()).toBe('');
  });

  it('emits a single marked block carrying all rules + identity keys', () => {
    const a = style({ color: 'red' });
    const b = style({ display: 'flex', padding: 8 });
    const out = renderStyles();
    expect(out.startsWith('<style data-streetui-css data-streetui-css-keys="')).toBe(true);
    expect(out.endsWith('</style>')).toBe(true);
    expect(out).toContain('color:red');
    expect(out).toContain('display:flex');
    // Both identities are listed for hydration adoption.
    expect(out).toContain(a);
    expect(out).toContain(b);
  });

  it('places token rules first (deterministic band order)', () => {
    const t = createThemeTokens({ light: { color: { bg: '#fff' } } });
    style({ color: 'red' });
    const out = renderStyles();
    expect(out.indexOf(':root{')).toBeLessThan(out.indexOf('color:red'));
    expect(out).toContain(t.id);
  });

  it('is deterministic across identical registration order', () => {
    style({ color: 'red' });
    style({ color: 'blue' });
    const first = renderStyles();
    styleRegistry.reset();
    style({ color: 'red' });
    style({ color: 'blue' });
    expect(renderStyles()).toBe(first);
  });
});

describe('adoptServerStyles (§17 no duplicate rules on hydrate)', () => {
  function buildServerDoc(cssBlockHtml: string) {
    const dom = new ServerDOMAdapter();
    const head = dom.createElement('head');
    if (cssBlockHtml.length > 0) {
      // Reconstruct the emitted block as a real element tree for adoption.
      const style = dom.createElement('style');
      dom.setAttribute(style, 'data-streetui-css', '');
      const keys = /data-streetui-css-keys="([^"]*)"/.exec(cssBlockHtml)?.[1] ?? '';
      dom.setAttribute(style, 'data-streetui-css-keys', keys);
      dom.appendChild(head, style);
    }
    return { dom, head };
  }

  it('seeds the registry from server identity keys so client style() re-registers nothing', () => {
    // Server pass: register + serialize.
    const id = style({ color: 'red' });
    const block = renderStyles();
    const serverSize = styleRegistry.size;
    expect(serverSize).toBeGreaterThan(0);

    // Simulate a fresh client registry.
    styleRegistry.reset();
    const { dom, head } = buildServerDoc(block);
    const adopted = adoptServerStyles(dom, head);
    expect(adopted).toBeGreaterThan(0);
    expect(styleRegistry.has(id)).toBe(true);
    expect(styleRegistry.adopted).toBe(true);

    // Client re-declares the same style → no new rule, same token.
    const before = styleRegistry.size;
    expect(style({ color: 'red' })).toBe(id);
    expect(styleRegistry.size).toBe(before);
  });

  it('is a no-op when no server block exists', () => {
    const dom = new ServerDOMAdapter();
    const head = dom.createElement('head');
    expect(adoptServerStyles(dom, head)).toBe(0);
  });
});
