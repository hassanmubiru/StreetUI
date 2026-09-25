/**
 * Consolidated public-API tests for the unified `streetui` package.
 *
 * These tests import **only** from `streetui` (and its `streetui/server` and
 * `streetui/testing` subpaths) — never from any internal `@streetui/*` package —
 * exactly as a real consumer would. They exercise the shipped, bundled artifact
 * (resolved through the package `exports` map) to prove the one-install /
 * one-import experience actually works: reactivity, the semantic DSL + compiler,
 * SSR, hydration, the router, forms, i18n and context are all reachable and
 * functional from the single public surface.
 */
import { describe, it, expect } from 'vitest';
import {
  VERSION,
  // reactivity
  signal,
  derived,
  effect,
  batch,
  resource,
  type Signal,
  // dsl + compiler + renderer
  streetui,
  compile,
  createRenderer,
  BrowserDOMAdapter,
  ServerDOMAdapter,
  resetIdCounter,
  // ssr
  renderToString,
  serializeState,
  readState,
  // subsystems
  createRouter,
  createMemoryHistory,
  createForm,
  required,
  email,
  createI18n,
  createContext,
  createDevTools,
  defineConfig,
} from 'streetui';

// eslint-disable-next-line import/no-unresolved
import { renderToString as serverRenderToString, serializeState as serverSerializeState, ServerDOMAdapter as ServerAdapterFromServer } from 'streetui/server';
// eslint-disable-next-line import/no-unresolved
import { render, findByRole, waitFor } from 'streetui/testing';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('streetui — single import surface', () => {
  it('exposes the framework version', () => {
    expect(VERSION).toBe('1.4.0');
  });

  it('exposes every headline API from one import (no @streetui/* needed)', () => {
    for (const fn of [
      signal, derived, effect, batch, resource,
      compile, createRenderer, createRouter, createForm,
      createI18n, createContext, createDevTools, renderToString,
      serializeState, readState, defineConfig, createMemoryHistory,
    ]) {
      expect(typeof fn).toBe('function');
    }
    expect(typeof streetui.app).toBe('function');
    expect(typeof BrowserDOMAdapter).toBe('function');
    expect(typeof ServerDOMAdapter).toBe('function');
  });
});

describe('streetui — reactivity', () => {
  it('signal/derived/effect/batch work through the public entry', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = derived(() => a.get() + b.get());
    const seen: number[] = [];
    const dispose = effect(() => {
      seen.push(sum.get());
    });
    expect(sum.get()).toBe(3);
    batch(() => {
      a.set(10);
      b.set(20);
    });
    expect(sum.get()).toBe(30);
    dispose();
  });
});

describe('streetui — DSL + compiler + SSR', () => {
  it('builds, compiles and renders an app to HTML with reactive initial values', () => {
    resetIdCounter();
    const count = signal(2);
    const app = streetui.app({ name: 'ssr-app' });
    app.page('home', (page) => {
      page.heading('Hello', { level: 1 });
      page.section('main', (s) => {
        s.text(derived(() => `Count: ${count.get()}`), { id: 'count' });
      }, { id: 'main' });
    });
    const html = renderToString(compile(app));
    expect(typeof html).toBe('string');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('Count: 2');
  });

  it('serializeState produces a serialized state payload; readState is exposed', () => {
    const serialized = serializeState({ app: { count: 7 } });
    expect(typeof serialized).toBe('string');
    expect(serialized).toContain('7');
    // Full marker round-trip is covered in the renderer suite; here we only
    // assert the SSR state helpers are wired and callable from the public entry.
    expect(typeof readState).toBe('function');
  });
});

describe('streetui — hydration (SSR markup adopted, then reactive)', () => {
  it('hydrates server HTML in place and stays reactive', async () => {
    const build = (count: Signal<number>) => {
      const app = streetui.app({ name: 'hydrate-app' });
      app.page('home', (page) => {
        page.section('main', (s) => {
          s.text(derived(() => `Count: ${count.get()}`), { id: 'count' });
        }, { id: 'main' });
      });
      return app;
    };

    // Server render with the same build.
    resetIdCounter();
    const serverCount = signal(0);
    const html = renderToString(compile(build(serverCount)));
    const container = document.createElement('div');
    container.innerHTML = html;
    const beforeSpan = container.querySelector('#count');
    expect(beforeSpan?.textContent).toBe('Count: 0');

    // Client hydrate against that exact DOM.
    resetIdCounter();
    const clientCount = signal(0);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.hydrate(compile(build(clientCount)), container);
    // Adopted, not recreated.
    expect(container.querySelector('#count')).toBe(beforeSpan);

    // Live after hydration.
    clientCount.set(5);
    await flush();
    expect(container.querySelector('#count')?.textContent).toBe('Count: 5');
    handle.unmount();
  });
});

describe('streetui — router', () => {
  it('matches routes, captures params and query, and navigates', () => {
    const router = createRouter({
      routes: [
        { path: '/', builder: () => {} },
        { path: '/users/:id', builder: () => {} },
      ],
      history: createMemoryHistory('/'),
    });
    expect(router.currentRoute.get().pattern).toBe('/');
    router.navigate('/users/42?tab=posts');
    const m = router.currentRoute.get();
    expect(m.pattern).toBe('/users/:id');
    expect(m.params.id).toBe('42');
    expect(m.query.get('tab')).toBe('posts');
    router.destroy();
  });
});

describe('streetui — forms', () => {
  it('validates fields with built-in validators (reactively)', () => {
    const form = createForm({
      initialValues: { emailAddr: '' },
      validators: { emailAddr: [required(), email()] },
    });
    const emailField = form.field('emailAddr');
    emailField.setValue('');
    expect(emailField.valid.get()).toBe(false);
    emailField.setValue('user@example.com');
    expect(emailField.valid.get()).toBe(true);
    expect(form.valid.get()).toBe(true);
    form.dispose();
  });
});

describe('streetui — i18n', () => {
  it('translates reactively and switches locale', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: {
        en: { hello: 'Hello, {name}' },
        fr: { hello: 'Bonjour, {name}' },
      },
    });
    const greeting = i18n.t('hello', { name: 'Ada' });
    expect(greeting.get()).toBe('Hello, Ada');
    i18n.setLocale('fr');
    expect(greeting.get()).toBe('Bonjour, Ada');
  });
});

describe('streetui — context', () => {
  it('provides and consumes the nearest value', () => {
    const Theme = createContext<'light' | 'dark'>('light');
    expect(Theme.consume()).toBe('light');
    const inner = Theme.provide('dark', () => Theme.consume());
    expect(inner).toBe('dark');
    expect(Theme.consume()).toBe('light');
  });
});

describe('streetui/server — curated SSR subset', () => {
  it('renders to a string from the server subpath', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'srv' });
    app.page('home', (page) => page.heading('From server', { level: 2 }));
    const html = serverRenderToString(compile(app), { domAdapter: new ServerAdapterFromServer() });
    expect(html).toContain('<h2>From server</h2>');
    expect(typeof serverSerializeState({ x: { n: 1 } })).toBe('string');
  });
});

describe('streetui/testing — testing helpers', () => {
  it('renders an app and finds elements by role', async () => {
    const app = streetui.app({ name: 'test-app' });
    app.page('home', (page) => {
      page.section('main', (s) => {
        s.button('Click me', { id: 'btn' });
      }, { id: 'main' });
    });
    const result = render(app);
    const btn = await waitFor(() => findByRole(result.container, 'button'));
    expect(btn.textContent).toContain('Click me');
    result.unmount();
  });
});

describe('streetui/testing — compiler diagnostics (v1.2 §14)', () => {
  it('inspects a compiled graph through the public testing subpath', async () => {
    // The diagnostic inspection API is a DEV tool: it is reachable from the
    // `streetui/testing` subpath but deliberately kept OFF the runtime barrel
    // so it tree-shakes out of shipped apps.
    const { inspectCompilation, formatInspection, analyzeGraph } = await import(
      // eslint-disable-next-line import/no-unresolved
      'streetui/testing'
    );
    const label = signal('tick');
    const app = streetui.app({ name: 'diag-demo', version: '3.4.0' });
    app.page('home', (p) =>
      p.section('main', (s) => {
        s.text('static', { class: 'a' });
        s.text(label, { class: 'live' });
        s.button('go', { id: 'b' });
      }),
    );
    const { graph } = compile(app);

    const insp = inspectCompilation(graph);
    expect(insp.name).toBe('diag-demo');
    expect(insp.version).toBe('3.4.0');
    expect(insp.summary.staticRatio).toBeGreaterThan(0);
    expect(insp.summary.staticRatio).toBeLessThanOrEqual(1);
    // exactly one dynamic-text node, and it asks for dynamic hydration.
    const dynText = insp.nodes.filter((n) => n.dynamicText);
    expect(dynText).toHaveLength(1);
    expect(dynText[0]!.hydration).toBe('verify-dynamic');

    const report = formatInspection(insp);
    expect(report).toContain('compiler inspection — diag-demo v3.4.0');
    expect(report).toContain('{text}');

    // analyzeGraph is the lower-level primitive, also exposed for diagnostics.
    const analysis = analyzeGraph(graph);
    expect(analysis.summary.totalNodes).toBe(insp.nodes.length);
  });

  it('keeps diagnostics OFF the runtime barrel (tree-shakeable)', async () => {
    // eslint-disable-next-line import/no-unresolved
    const runtime = await import('streetui');
    expect('inspectCompilation' in runtime).toBe(false);
    expect('analyzeGraph' in runtime).toBe(false);
    expect('formatInspection' in runtime).toBe(false);
  });
});
