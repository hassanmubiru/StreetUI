/**
 * v1.0 public API contract + subsystem stability — @streetui/renderer.
 *
 * Covers the SSR → hydration contract from the public barrel: server render,
 * DOM adoption with node identity preserved (server node === post-hydration
 * node), and local self-repair with an opt-in diagnostic on a tag mismatch.
 */
import { describe, it, expect } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import * as API from './index.js';
import {
  renderToString, createRenderer, createHydrationDiagnosticCollector,
} from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'applyNodeProps', 'applyProp', 'buttonUpdate', 'consoleHydrationDiagnosticSink',
  'createHydrationDiagnosticCollector', 'createRenderContext', 'createRenderer',
  'formatHydrationDiagnostic', 'headingUpdate', 'hydrateGraph', 'inputUpdate',
  'mountGraph', 'mountNode', 'NodeInstance', 'patchNode', 'patchProp', 'readState',
  'reconcileChildren', 'renderToString', 'resolveTag', 'serializeState',
  'STATE_MARKER_ATTR', 'StreetRendererImpl', 'StreetRenderHandle', 'textUpdate',
  'wireEvents', 'wireReactiveList', 'wireSignalBindings',
] as const;

describe('@streetui/renderer — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});

describe('@streetui/renderer — SSR + hydration stability', () => {
  it('server-renders deterministic HTML', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'app' });
    app.page('home', (page) => page.heading('Server Title'));
    const html = renderToString(compile(app));
    expect(html).toContain('Server Title');
    expect(html).toContain('<h1');
  });

  it('hydration adopts the exact server DOM node (no recreation)', () => {
    resetIdCounter();
    const serverApp = streetui.app({ name: 'app' });
    serverApp.page('home', (page) => page.heading('Reused'));
    const html = renderToString(compile(serverApp));
    const container = document.createElement('div');
    container.innerHTML = html;
    const beforeH1 = container.querySelector('h1');
    expect(beforeH1).not.toBeNull();

    resetIdCounter();
    const clientApp = streetui.app({ name: 'app' });
    clientApp.page('home', (page) => page.heading('Reused'));
    createRenderer({ domAdapter: new BrowserDOMAdapter() }).hydrate(compile(clientApp), container);

    // Same object identity — hydration adopted the element, did not rebuild it.
    expect(container.querySelector('h1')).toBe(beforeH1);
    expect(container.querySelectorAll('h1').length).toBe(1);
  });

  it('self-repairs a locally divergent subtree and reports it (opt-in)', () => {
    const { sink, diagnostics } = createHydrationDiagnosticCollector();

    resetIdCounter();
    const serverApp = streetui.app({ name: 'app' });
    serverApp.page('home', (page) => page.heading('Title'));
    const html = renderToString(compile(serverApp));
    const container = document.createElement('div');
    container.innerHTML = html;

    // Corrupt the markup to force a tag mismatch.
    const h1 = container.querySelector('h1')!;
    const wrong = document.createElement('p');
    wrong.textContent = 'stale';
    h1.replaceWith(wrong);

    resetIdCounter();
    const clientApp = streetui.app({ name: 'app' });
    clientApp.page('home', (page) => page.heading('Title'));
    createRenderer({ domAdapter: new BrowserDOMAdapter(), hydrationDiagnostics: sink })
      .hydrate(compile(clientApp), container);

    // Repair stays local: the offending <p> is gone, correct <h1> is mounted,
    // and the container was never globally destroyed.
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('Title');
    const tag = diagnostics.find((d) => d.type === 'tag-mismatch');
    expect(tag).toBeDefined();
    expect(tag?.expected).toBe('h1');
    expect(tag?.found).toBe('p');
  });
});
