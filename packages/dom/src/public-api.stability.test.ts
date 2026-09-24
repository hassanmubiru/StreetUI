/**
 * v1.0 public API contract — @streetui/dom.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import { escapeHtmlText, escapeHtmlAttr, serverDOMAdapter, browserDOMAdapter } from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'browserDOMAdapter', 'BrowserDOMAdapter', 'escapeHtmlAttr', 'escapeHtmlText',
  'FOCUSABLE_SELECTOR', 'focusById', 'focusFirst', 'serializeChildren',
  'serializeServerNode', 'ServerComment', 'serverDOMAdapter', 'ServerDOMAdapter',
  'ServerElement', 'ServerFragment', 'ServerStyle', 'ServerText',
] as const;

describe('@streetui/dom — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it('HTML escaping is stable and injection-safe', () => {
    expect(escapeHtmlText('<a>&')).toBe('&lt;a&gt;&amp;');
    expect(escapeHtmlAttr('"x"<')).toBe('&quot;x&quot;&lt;');
  });

  it('server and browser DOM adapters are provided as singletons', () => {
    expect(serverDOMAdapter).toBeDefined();
    expect(browserDOMAdapter).toBeDefined();
  });
});
