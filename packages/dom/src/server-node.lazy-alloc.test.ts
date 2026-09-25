/**
 * v1.6 §8/§11 — byte-identity + lazy-allocation invariants for ServerElement.
 *
 * The v1.6 SSR optimization makes a ServerElement's `properties` Map and `style`
 * (ServerStyle + its Map) LAZY: they are allocated on first WRITE, not at
 * construction. On the 10k-row /users corpus ~0% of elements use them, so this
 * removed ~240k per-render allocations from the dominant mount phase.
 *
 * These tests guard the two things that make that safe:
 *   1. Serialized output is byte-identical to the eager model across every
 *      category the spec enumerates (text, attributes, nested, special chars,
 *      boolean attrs, void elements, Unicode, large static subtree).
 *   2. Reading an element never forces an allocation; only a real write does.
 */
import { describe, it, expect } from 'vitest';
import {
  ServerElement,
  ServerText,
  serializeServerNode,
  serializeChildren,
} from './server-node.js';

/** Build `<tag attr..>children</tag>` without going through the adapter. */
function el(
  tag: string,
  attrs: Record<string, string> = {},
  children: Array<ServerElement | ServerText> = [],
): ServerElement {
  const e = new ServerElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.attributes.set(k, v);
  for (const c of children) {
    c.parent = e;
    e.children.push(c);
  }
  return e;
}
const t = (s: string) => new ServerText(s);

describe('v1.6 ServerElement lazy allocation — byte identity (§8/§11)', () => {
  it('simple text', () => {
    expect(serializeServerNode(el('p', {}, [t('hello world')]))).toBe('<p>hello world</p>');
  });

  it('attributes (escaped)', () => {
    expect(serializeServerNode(el('a', { href: '/x?a=1&b=2', title: 'a "b" <c>' }))).toBe(
      '<a href="/x?a=1&amp;b=2" title="a &quot;b&quot; &lt;c&gt;"></a>',
    );
  });

  it('nested elements', () => {
    const tree = el('ul', { class: 'list' }, [
      el('li', {}, [t('one')]),
      el('li', {}, [t('two')]),
    ]);
    expect(serializeServerNode(tree)).toBe(
      '<ul class="list"><li>one</li><li>two</li></ul>',
    );
  });

  it('special characters in text', () => {
    expect(serializeServerNode(el('span', {}, [t('a & b < c > d')]))).toBe(
      '<span>a &amp; b &lt; c &gt; d</span>',
    );
  });

  it('boolean-style empty attribute', () => {
    expect(serializeServerNode(el('input', { disabled: '', required: '' }))).toBe(
      '<input disabled required>',
    );
  });

  it('void elements have no closing tag or children', () => {
    expect(serializeServerNode(el('br'))).toBe('<br>');
    expect(serializeServerNode(el('img', { src: 'a.png', alt: 'x' }))).toBe(
      '<img src="a.png" alt="x">',
    );
  });

  it('Unicode is preserved verbatim', () => {
    expect(serializeServerNode(el('p', { 'data-x': 'café — 日本語 — 🚀' }, [
      t('café — 日本語 — 🚀'),
    ]))).toBe('<p data-x="café — 日本語 — 🚀">café — 日本語 — 🚀</p>');
  });

  it('large static subtree serializes identically regardless of alloc strategy', () => {
    // Build 2,000 leaf rows; NONE set properties or style. Compare against a
    // hand-built expected string so the lazy path is verified byte-for-byte.
    const container = new ServerElement('div');
    let expected = '';
    for (let i = 0; i < 2000; i++) {
      const row = el('div', { class: 'row', 'data-i': String(i) }, [t(`node ${i}`)]);
      row.parent = container;
      container.children.push(row);
      expected += `<div class="row" data-i="${i}">node ${i}</div>`;
    }
    expect(serializeChildren(container)).toBe(expected);
  });
});

describe('v1.6 ServerElement lazy allocation — no eager allocation (§5)', () => {
  it('a freshly constructed element allocates neither properties nor style', () => {
    const e = new ServerElement('div');
    expect(e._properties).toBeNull();
    expect(e._style).toBeNull();
  });

  it('serializing an element that uses neither store never allocates them', () => {
    const e = el('div', { class: 'x' }, [t('y')]);
    serializeServerNode(e); // read path only
    expect(e._properties).toBeNull();
    expect(e._style).toBeNull();
  });

  it('writing a property or style allocates only that store, on demand', () => {
    const a = new ServerElement('input');
    a.properties.set('checked', true);
    expect(a._properties).not.toBeNull();
    expect(a._style).toBeNull();
    expect(serializeServerNode(a)).toBe('<input checked>');

    const b = new ServerElement('div');
    b.style.setProperty('color', 'red');
    expect(b._style).not.toBeNull();
    expect(b._properties).toBeNull();
    expect(serializeServerNode(b)).toBe('<div style="color: red"></div>');
  });

  it('an explicit attribute still wins over a serialized property', () => {
    const e = new ServerElement('input');
    e.attributes.set('value', 'fromAttr');
    e.properties.set('value', 'fromProp');
    expect(serializeServerNode(e)).toBe('<input value="fromAttr">');
  });
});
