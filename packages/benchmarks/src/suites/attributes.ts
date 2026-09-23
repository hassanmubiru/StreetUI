/**
 * DOM attribute/property update micro-benchmarks — exercises the renderer's
 * `applyProp`/`patchProp` decision path for each prop kind (text, attribute,
 * class, style object, DOM property) against a real happy-dom element.
 */

import { bench, type BenchResult } from '../harness.js';
import { applyProp, patchProp } from '@streetui/renderer';
import { BrowserDOMAdapter } from '@streetui/dom';
import { freshContainer } from '../dom-env.js';

interface AttrState {
  el: Element;
  i: number;
}

export function attributesSuite(): BenchResult[] {
  const dom = new BrowserDOMAdapter();
  const results: BenchResult[] = [];

  const setup = (): AttrState => ({ el: dom.createElement('div'), i: 0 });

  results.push(
    bench<AttrState>(
      'attributes/set-attribute (title)',
      (s) => {
        applyProp(dom, s.el, 'title', `t-${s.i++ & 1}`);
      },
      { category: 'attributes', n: null, inner: 500, iterations: 40, setup },
    ),
  );

  results.push(
    bench<AttrState>(
      'attributes/set-class',
      (s) => {
        applyProp(dom, s.el, 'class', (s.i++ & 1) === 0 ? 'a b c' : 'd e f');
      },
      { category: 'attributes', n: null, inner: 500, iterations: 40, setup },
    ),
  );

  results.push(
    bench<AttrState>(
      'attributes/set-style-object',
      (s) => {
        applyProp(dom, s.el, 'style', { color: (s.i++ & 1) === 0 ? 'red' : 'blue', margin: '4px' });
      },
      { category: 'attributes', n: null, inner: 300, iterations: 40, setup },
    ),
  );

  results.push(
    bench<AttrState>(
      'attributes/set-property (value)',
      (s) => {
        const input = dom.createElement('input');
        applyProp(dom, input, 'value', `v-${s.i++ & 1}`);
      },
      { category: 'attributes', n: null, inner: 300, iterations: 40, setup },
    ),
  );

  results.push(
    bench<AttrState>(
      'attributes/set-text-content',
      (s) => {
        dom.setTextContent(s.el, `text ${s.i++ & 1}`);
      },
      { category: 'attributes', n: null, inner: 500, iterations: 40, setup },
    ),
  );

  // patchProp with an unchanged value must short-circuit (Object.is guard).
  results.push(
    bench<AttrState>(
      'attributes/patch-unchanged (noop)',
      (s) => {
        patchProp(dom, s.el, 'title', 'same', 'same');
      },
      { category: 'attributes', n: null, inner: 1000, iterations: 40, setup },
    ),
  );

  return results;
}
