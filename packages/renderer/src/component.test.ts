/**
 * Component & Composition platform (§3–§14, §29).
 *
 * A `component()` compiles into the EXISTING pipeline: it materialises the
 * reserved `'component'` GraphNode (rendered as a `<div>` wrapper — preserving
 * the one-node/one-element positional-hydration invariant), runs its `setup`
 * synchronously at build time (like `errorBoundary`), and routes the cleanups
 * the setup registers into the node's `NodeInstance` via a `__component__<id>`
 * handler — so teardown runs, children-first, when the component leaves the
 * graph. No virtual DOM, no second reactive system, no second renderer.
 *
 * These tests assert the contract end to end against the real browser adapter
 * (happy-dom) and the SSR/hydrate paths: identity + wrapper, local state,
 * lifecycle/cleanup, typed props, fine-grained prop reactivity WITHOUT re-setup,
 * native children/slots, components-composing-components, keyed-list rebuild
 * dispose, SSR, and hydration. They are deterministic (synchronous signal
 * fan-out; the one async point is a `flush()` microtask after a signal set).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui, component, type ContainerDSL } from '@streetui/dsl';
import { signal, effect, type Signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
});

function mountApp(build: (page: import('@streetui/dsl').PageDSL) => void) {
  const app = streetui.app({ name: 'component-test' });
  app.page('home', build);
  const compiled = compile(app);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const handle = renderer.mount(compiled, container);
  return { container, handle };
}

describe('component — identity + wrapper (§3/§4)', () => {
  it('renders as a <div> wrapper carrying an inspectable name attribute', () => {
    const Card = component<{ title: string }>((props) => (c) => {
      c.heading(props.title, { level: 3 });
    }, { name: 'Card' });

    const { container } = mountApp((page) => {
      page.component('card-1', Card, { title: 'Hello' });
    });

    const el = container.querySelector('[data-streetui-component="Card"]');
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe('DIV');
    expect(el!.querySelector('h3')?.textContent).toBe('Hello');
  });
});

describe('component — local state via existing reactivity (§8/§13)', () => {
  it('owns local signal state and toggles a child reactively', async () => {
    const Toggle = component((_props, _ctx) => {
      const open = signal(false);
      return (c) => {
        c.button('toggle', { id: 'tgl', onClick: () => open.set(!open.peek()) });
        c.when(open, (b) => b.text('OPEN', { id: 'body' }));
      };
    }, { name: 'Toggle' });

    const { container } = mountApp((page) => page.component('t', Toggle, {}));

    expect(container.querySelector('#body')).toBeNull();
    (container.querySelector('#tgl') as HTMLElement).click();
    await flush();
    expect(container.querySelector('#body')?.textContent).toBe('OPEN');
  });

  it('a Signal prop drives a fine-grained update WITHOUT re-running setup', async () => {
    let setupRuns = 0;
    const Name = component<{ name: Signal<string> }>((props) => {
      setupRuns++;
      return (c) => c.text(props.name, { id: 'n' });
    }, { name: 'Name' });

    const name = signal('Ada');
    const { container } = mountApp((page) => page.component('nm', Name, { name }));

    expect(setupRuns).toBe(1);
    expect(container.querySelector('#n')?.textContent).toBe('Ada');

    name.set('Grace');
    await flush();
    // Text mutated in place; setup did NOT re-run (§13 fine-grained).
    expect(container.querySelector('#n')?.textContent).toBe('Grace');
    expect(setupRuns).toBe(1);
  });
});

describe('component — lifecycle / cleanup (§9)', () => {
  it('runs ctx.onCleanup and disposes ctx.effect when the component unmounts', async () => {
    const cleaned: string[] = [];
    let effectRuns = 0;

    const source = signal(0);
    const Owner = component((_props, ctx) => {
      ctx.onCleanup(() => cleaned.push('explicit'));
      ctx.effect(() => {
        source.get();
        effectRuns++;
        return () => cleaned.push('effect-teardown');
      });
      return (c) => c.text('owner');
    }, { name: 'Owner' });

    const show = signal(true);
    const { handle } = mountApp((page) => {
      page.when(show, (b) => b.component('own', Owner, {}));
    });

    expect(effectRuns).toBe(1);
    // Effect is live: changing the source re-runs it (and its previous teardown).
    source.set(1);
    await flush();
    expect(effectRuns).toBe(2);
    expect(cleaned).toContain('effect-teardown');

    // Unmount the component by flipping the conditional off.
    cleaned.length = 0;
    show.set(false);
    await flush();
    expect(cleaned).toContain('explicit');
    expect(cleaned).toContain('effect-teardown');

    // After unmount the effect is dead — further source changes do nothing.
    const before = effectRuns;
    source.set(2);
    await flush();
    expect(effectRuns).toBe(before);

    handle.unmount();
  });
});

describe('component — children / slots (§6)', () => {
  it('renders caller-supplied children where the component calls ctx.renderChildren', () => {
    const Panel = component<{ heading: string }>((props, ctx) => (c) => {
      c.heading(props.heading, { level: 2 });
      c.container('slot', (slot) => ctx.renderChildren(slot), { id: 'slot' });
    }, { name: 'Panel' });

    const { container } = mountApp((page) => {
      page.component('p', Panel, { heading: 'Title' }, (slot: ContainerDSL) => {
        slot.text('slotted-child', { id: 'child' });
      });
    });

    expect(container.querySelector('h2')?.textContent).toBe('Title');
    const child = container.querySelector('#slot #child');
    expect(child?.textContent).toBe('slotted-child');
  });
});

describe('component — composition (§7)', () => {
  it('a component can render another component', () => {
    const Inner = component<{ label: string }>((props) => (c) => {
      c.text(props.label, { class: 'inner' });
    }, { name: 'Inner' });

    const Outer = component((_props) => (c) => {
      c.component('a', Inner, { label: 'A' });
      c.component('b', Inner, { label: 'B' });
    }, { name: 'Outer' });

    const { container } = mountApp((page) => page.component('o', Outer, {}));

    const inners = container.querySelectorAll('[data-streetui-component="Inner"]');
    expect(inners.length).toBe(2);
    expect(container.querySelectorAll('.inner')[0]?.textContent).toBe('A');
    expect(container.querySelectorAll('.inner')[1]?.textContent).toBe('B');
  });
});

describe('component — keyed lists (§14)', () => {
  it('disposes a removed row-component cleanup and prunes its handler', async () => {
    const disposed: number[] = [];
    const Row = component<{ n: number }>((props, ctx) => {
      ctx.onCleanup(() => disposed.push(props.n));
      return (c) => c.text(String(props.n));
    }, { name: 'Row' });

    const items = signal<Array<{ id: number }>>([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const { container } = mountApp((page) => {
      page.listOf('rows', items, (item, _i, content) => {
        (content as ContainerDSL).component(`row-${item.id}`, Row, { n: item.id });
      });
    });

    expect(container.querySelectorAll('[data-streetui-component="Row"]').length).toBe(3);

    // Drop the middle row → its component must be disposed.
    items.set([{ id: 1 }, { id: 3 }]);
    await flush();
    expect(container.querySelectorAll('[data-streetui-component="Row"]').length).toBe(2);
    expect(disposed).toContain(2);
  });
});

describe('component — SSR + hydration (§10/§11/§12)', () => {
  it('renders inline on the server (component is a plain <div> wrapper)', () => {
    resetIdCounter();
    const Card = component<{ title: string }>((props) => (c) => {
      c.heading(props.title, { level: 3 });
    }, { name: 'Card' });

    const app = streetui.app({ name: 'ssr' });
    app.page('home', (page) => page.component('c', Card, { title: 'Server' }));
    const html = renderToString(compile(app));
    expect(html).toContain('data-streetui-component="Card"');
    expect(html).toContain('<h3>Server</h3>');
  });

  it('hydrates server markup in place and stays reactive, then unmounts cleanly', async () => {
    const cleaned: string[] = [];
    const build = (name: Signal<string>) => {
      const Name = component<{ name: Signal<string> }>((props, ctx) => {
        ctx.onCleanup(() => cleaned.push('bye'));
        return (c) => c.text(props.name, { id: 'n' });
      }, { name: 'Name' });
      const app = streetui.app({ name: 'hydrate' });
      app.page('home', (page) => page.component('nm', Name, { name }));
      return app;
    };

    // Server render.
    resetIdCounter();
    const serverName = signal('Ada');
    const html = renderToString(compile(build(serverName)));
    const container = document.createElement('div');
    container.innerHTML = html;
    const beforeEl = container.querySelector('#n');
    expect(beforeEl?.textContent).toBe('Ada');

    // Client hydrate against that exact DOM — adopt, don't recreate.
    resetIdCounter();
    const clientName = signal('Ada');
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.hydrate(compile(build(clientName)), container);
    expect(container.querySelector('#n')).toBe(beforeEl);

    // Reactive after hydration.
    clientName.set('Grace');
    await flush();
    expect(container.querySelector('#n')?.textContent).toBe('Grace');

    // Cleanup wired through hydration too.
    handle.unmount();
    expect(cleaned).toContain('bye');
  });
});

describe('component — factory (§3)', () => {
  it('produces a branded, reusable, inspectable definition', () => {
    const setup = () => (c: ContainerDSL) => c.text('x');
    const Def = component(setup, { name: 'MyThing' });
    expect(Def.__streetui_component).toBe(true);
    expect(Def.name).toBe('MyThing');
    expect(Def.setup).toBe(setup);
    // A definition builds no graph and runs no setup by itself.
    let ran = 0;
    const Counted = component(() => { ran++; return (c: ContainerDSL) => c.text('y'); });
    void Counted;
    expect(ran).toBe(0);
  });
});

describe('component — interaction platform integration (§29)', () => {
  const FADE = { name: 'fade', duration: 100000 } as const;
  const endTransition = (el: Element): void =>
    void el.dispatchEvent(new Event('transitionend', { bubbles: true }));

  it('a transition composes inside a component and its handler is pruned on dispose', async () => {
    let cleaned = 0;
    // A component that owns a transitioned `when()` panel driven by a prop signal.
    const Panel = component<{ open: Signal<boolean> }>((props, ctx) => {
      ctx.onCleanup(() => cleaned++);
      return (c) =>
        c.when(props.open, (b) => b.text('panel body', { id: 'panel' }), undefined, {
          transition: FADE,
        });
    }, { name: 'Panel' });

    const open: Signal<boolean> = signal(false);
    const mounted: Signal<boolean> = signal(true);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = streetui.app({ name: 'combo' });
    app.page('home', (page) => {
      // Wrap the component in a `when` so we can unmount the whole component.
      page.when(mounted, (c) => (c as ContainerDSL).component('p', Panel, { open }), undefined);
    });
    const handle = createRenderer({ domAdapter: new BrowserDOMAdapter() }).mount(
      compile(app),
      container,
    );

    // Panel wrapper present, body hidden.
    expect(container.querySelector('[data-streetui-component="Panel"]')).not.toBeNull();
    expect(document.getElementById('panel')).toBeNull();

    // Open → the body enters (transition classes applied inside the component).
    open.set(true);
    await flush();
    const entering = container.querySelector('.fade-enter-active')!;
    expect(entering).not.toBeNull();
    expect(document.getElementById('panel')).not.toBeNull();
    endTransition(entering);

    // Close → the body leaves; removal is deferred until the leave ends.
    open.set(false);
    await flush();
    const leaving = container.querySelector('.fade-leave-active')!;
    expect(leaving).not.toBeNull();
    expect(document.getElementById('panel')).not.toBeNull();
    endTransition(leaving);
    expect(document.getElementById('panel')).toBeNull();

    // Unmount the whole component → its cleanup runs (composition teardown).
    open.set(true);
    await flush();
    endTransition(container.querySelector('.fade-enter-active')!);
    mounted.set(false);
    await flush();
    expect(container.querySelector('[data-streetui-component="Panel"]')).toBeNull();
    expect(cleaned).toBe(1);

    handle.unmount();
    if (container.parentNode !== null) container.parentNode.removeChild(container);
  });
});
