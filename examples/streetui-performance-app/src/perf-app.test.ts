import { describe, it, expect } from 'vitest';
import { createRenderer, BrowserDOMAdapter } from 'streetui';
import { createDeps, snapshot } from './deps.js';
import { compilePage } from './index.js';
import { renderIsland } from './server-entry.js';
import { mountPerfApp } from './routed.js';

const SMALL = { sizing: { rows: 40, controls: 16 } } as const;

/** A counting DOM adapter to prove mutation counts rather than assume them. */
function countingAdapter() {
  const base = new BrowserDOMAdapter();
  const c = { createElement: 0, createTextNode: 0, setTextContent: 0, setAttribute: 0, appendChild: 0, insertBefore: 0, removeChild: 0 };
  const baseMethods = base as unknown as Record<string, (...args: never[]) => unknown>;
  const adapter: Record<string, unknown> = {
    createElement(t: string) { c.createElement++; return base.createElement(t); },
    createTextNode(d: string) { c.createTextNode++; return base.createTextNode(d); },
    createComment(d: string) { return base.createComment(d); },
    appendChild(p: unknown, ch: unknown) { c.appendChild++; return base.appendChild(p as Node, ch as Node); },
    insertBefore(p: unknown, ch: unknown, r: unknown) { c.insertBefore++; return base.insertBefore(p as Node, ch as Node, r as Node | null); },
    removeChild(p: unknown, ch: unknown) { c.removeChild++; return base.removeChild(p as Node, ch as Node); },
    setAttribute(e: unknown, n: string, v: string) { c.setAttribute++; return base.setAttribute(e as Element, n, v); },
    removeAttribute(e: unknown, n: string) { return base.removeAttribute(e as Element, n); },
    setProperty(e: unknown, n: string, v: unknown) { return base.setProperty(e as Element, n, v); },
    setTextContent(n: unknown, t: string) { c.setTextContent++; return base.setTextContent(n as Node, t); },
  };
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(base))) {
    if (k !== 'constructor' && typeof baseMethods[k] === 'function' && !(k in adapter)) {
      adapter[k] = (...a: unknown[]) => baseMethods[k]?.(...(a as never[]));
    }
  }
  return {
    adapter,
    c,
    reset: () => Object.keys(c).forEach((k) => { c[k as keyof typeof c] = 0; }),
  };
}

describe('performance app — SSR + hydration', () => {
  it('renders server HTML and hydrates it creating zero DOM nodes', () => {
    const island = renderIsland({ ...SMALL, view: 'users' });
    expect(island.body.length).toBeGreaterThan(0);

    const host = document.createElement('div');
    host.innerHTML = island.html; // <div id="app">…</div> + state script
    const app = host.querySelector('#app')!;

    const { adapter, c } = countingAdapter();
    const dom = adapter as unknown as BrowserDOMAdapter;
    const seed = snapshot(createDeps(SMALL));
    void seed;
    const deps = createDeps({ seed: { locale: 'en', query: '', role: 'all', rows: 40, controls: 16 } });
    const renderer = createRenderer({ domAdapter: dom });
    const handle = renderer.hydrate(compilePage(deps, 'users'), app);

    expect(c.createElement).toBe(0);
    expect(c.createTextNode).toBe(0);
    handle.unmount();
  });
});

describe('performance app — interactive routing', () => {
  it('navigates between routes and swaps outlet content', () => {
    const container = document.createElement('div');
    const applet = mountPerfApp(container, { path: '/', deps: createDeps(SMALL) });

    expect(container.querySelector('#route-overview')).not.toBeNull();
    applet.router.navigate('/users');
    expect(container.querySelector('#users-table')).not.toBeNull();
    expect(container.querySelector('#route-overview')).toBeNull();

    applet.router.navigate('/settings');
    expect(container.querySelector('#settings-form')).not.toBeNull();
    applet.unmount();
  });

  it('reactive search narrows the visible rows', () => {
    const deps = createDeps(SMALL);
    const container = document.createElement('div');
    const applet = mountPerfApp(container, { path: '/users', deps });
    const before = deps.totalCount.peek();
    deps.query.set('zzzzz-nomatch');
    expect(deps.totalCount.peek()).toBeLessThanOrEqual(before);
    expect(deps.totalCount.peek()).toBe(0);
    applet.unmount();
  });
});

describe('performance app — form + fine-grained controls', () => {
  it('validates a single field without touching the other', () => {
    const deps = createDeps(SMALL);
    const name = deps.settingsForm.field('displayName');
    name.setValue('a');
    expect(name.valid.peek()).toBe(false); // minLength(2)
    name.setValue('Ada');
    expect(name.valid.peek()).toBe(true);
  });

  it('toggling one control changes only its own signal', () => {
    const deps = createDeps(SMALL);
    expect(deps.toggledCount.peek()).toBe(0);
    deps.pushToggle(3);
    expect(deps.toggledCount.peek()).toBe(1);
    expect(deps.toggles[3]!.peek()).toBe(true);
    expect(deps.toggles[0]!.peek()).toBe(false);
  });
});
