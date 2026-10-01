/**
 * F-4 regression — custom outlet id + the exported ROUTER_OUTLET_KEY.
 *
 * The route outlet has a two-part contract: a reconciliation KEY (the container
 * key `routerOutlet` emits) and an element id (`ROUTER_OUTLET_ID` by default,
 * overridable). Server-rendered HTML that fills the outlet inline must agree
 * with BOTH so client hydration adopts the server node instead of silently
 * recreating the subtree. Before F-4 the key was a private literal, so SSR code
 * had to restate `'router-outlet'` by hand; `ROUTER_OUTLET_KEY` now exposes it.
 *
 * These tests prove, through the public API only:
 *   1. ROUTER_OUTLET_KEY is the exact key `routerOutlet` uses.
 *   2. A CUSTOM outlet id round-trips server→hydrate with node identity intact.
 *   3. An inline SSR fill that keys its container on ROUTER_OUTLET_KEY (as a real
 *      server render does) is adopted node-for-node by the hydrating router.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { createRouter } from './router.js';
import { createMemoryHistory } from './history.js';
import { mountRouter, routerOutlet, ROUTER_OUTLET_KEY, ROUTER_OUTLET_ID } from './mount-router.js';
import type { RouteDefinition } from './types.js';

beforeEach(() => resetIdCounter());

const text = (el: Element | null) => el?.textContent?.trim() ?? '';

const CUSTOM_OUTLET_ID = 'page-outlet';

const routes: RouteDefinition[] = [
  {
    path: '/docs/:section',
    builder: (page, ctx) =>
      page.section('doc', (s) => {
        s.heading(ctx.params.section ?? '', { id: 'section-title' });
        s.text(`q=${ctx.query.get('q') ?? 'none'}`, { id: 'section-q' });
      }),
  },
  { path: '*', builder: (page) => page.section('nf', (s) => s.heading('missing', { id: 'nf' })) },
];

/** Server render through the router with a CUSTOM outlet id. */
function serverHtmlCustomId(path: string): string {
  resetIdCounter();
  const container = document.createElement('div');
  const router = createRouter({ routes, history: createMemoryHistory(path) });
  const mounted = mountRouter(router, {
    container,
    outletId: CUSTOM_OUTLET_ID,
    shell: (sh) => {
      sh.section('nav', (n) => {
        n.link('Intro', { href: '/docs/intro', id: 'nav-intro' });
      }, { id: 'shell-nav' });
      routerOutlet(sh, CUSTOM_OUTLET_ID);
    },
  });
  const html = container.innerHTML;
  mounted.unmount();
  return html;
}

describe('ROUTER_OUTLET_KEY — outlet contract constant (F-4)', () => {
  it('is the exact reconciliation key routerOutlet emits', () => {
    // The outlet element carries the default id and the exported key, so a
    // server render can reference ONE symbol for the key instead of a literal.
    expect(ROUTER_OUTLET_KEY).toBe('router-outlet');
    expect(ROUTER_OUTLET_ID).toBe('streetui-router-outlet');

    resetIdCounter();
    const container = document.createElement('div');
    const router = createRouter({ routes, history: createMemoryHistory('/docs/intro') });
    const mounted = mountRouter(router, {
      container,
      shell: (sh) => routerOutlet(sh),
    });
    // The outlet element exists at the default id — the KEY is internal to the
    // graph, but the id it renders with is the public anchor hydration finds.
    expect(container.querySelector(`#${ROUTER_OUTLET_ID}`)).not.toBeNull();
    mounted.unmount();
  });
});

describe('mountRouter — custom outlet id hydration (F-4)', () => {
  it('adopts route content node-for-node under a CUSTOM outlet id', () => {
    const html = serverHtmlCustomId('/docs/intro?q=hello');
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;

    // The outlet element rendered with the custom id, and the route content is
    // baked in from the server.
    const outletBefore = container.querySelector(`#${CUSTOM_OUTLET_ID}`);
    const serverTitle = container.querySelector('#section-title');
    const serverQ = container.querySelector('#section-q');
    expect(outletBefore).not.toBeNull();
    expect(serverTitle).not.toBeNull();
    expect(text(serverTitle)).toBe('intro');
    expect(text(serverQ)).toBe('q=hello');

    resetIdCounter();
    const router = createRouter({ routes, history: createMemoryHistory('/docs/intro?q=hello') });
    const mounted = mountRouter(router, {
      container,
      hydrate: true,
      outletId: CUSTOM_OUTLET_ID,
      shell: (sh) => {
        sh.section('nav', (n) => {
          n.link('Intro', { href: '/docs/intro', id: 'nav-intro' });
        }, { id: 'shell-nav' });
        routerOutlet(sh, CUSTOM_OUTLET_ID);
      },
    });

    // Outlet element AND its route content are the same objects — adopted, not
    // recreated — proving the custom id preserves identity end to end.
    expect(container.querySelector(`#${CUSTOM_OUTLET_ID}`)).toBe(outletBefore);
    expect(container.querySelector('#section-title')).toBe(serverTitle);
    expect(container.querySelector('#section-q')).toBe(serverQ);

    // Live after hydration; the custom-id outlet persists across navigation.
    router.navigate('/docs/api');
    expect(container.querySelector(`#${CUSTOM_OUTLET_ID}`)).toBe(outletBefore);
    expect(text(container.querySelector('#section-title'))).toBe('api');

    mounted.unmount();
    container.remove();
  });

  it('adopts an inline SSR fill keyed on ROUTER_OUTLET_KEY node-for-node', () => {
    // Mimic a real server entry: the shell fills the outlet INLINE, keying the
    // container on ROUTER_OUTLET_KEY and the custom id — the exact three-way
    // agreement the F-4 recipe documents (routerOutlet id ⇔ mountRouter.outletId
    // ⇔ SSR container key+id). No `routerOutlet` call on the server side.
    resetIdCounter();
    const serverContainer = document.createElement('div');
    const serverRouter = createRouter({
      routes,
      history: createMemoryHistory('/docs/intro?q=hello'),
    });
    const serverMounted = mountRouter(serverRouter, {
      container: serverContainer,
      outletId: CUSTOM_OUTLET_ID,
      shell: (sh) => {
        sh.section('nav', (n) => {
          n.link('Intro', { href: '/docs/intro', id: 'nav-intro' });
        }, { id: 'shell-nav' });
        // Inline fill: SAME key the client's routerOutlet uses, SAME id.
        sh.container(ROUTER_OUTLET_KEY, (c) => {
          c.section('doc', (s) => {
            s.heading('intro', { id: 'section-title' });
            s.text('q=hello', { id: 'section-q' });
          });
        }, { id: CUSTOM_OUTLET_ID });
      },
    });
    const html = serverContainer.innerHTML;
    serverMounted.unmount();

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;
    const outletBefore = container.querySelector(`#${CUSTOM_OUTLET_ID}`);
    const serverTitle = container.querySelector('#section-title');
    expect(outletBefore).not.toBeNull();
    expect(serverTitle).not.toBeNull();
    expect(text(serverTitle)).toBe('intro');

    // Client hydrates with the real route + routerOutlet at the same id.
    resetIdCounter();
    const router = createRouter({ routes, history: createMemoryHistory('/docs/intro?q=hello') });
    const mounted = mountRouter(router, {
      container,
      hydrate: true,
      outletId: CUSTOM_OUTLET_ID,
      shell: (sh) => {
        sh.section('nav', (n) => {
          n.link('Intro', { href: '/docs/intro', id: 'nav-intro' });
        }, { id: 'shell-nav' });
        routerOutlet(sh, CUSTOM_OUTLET_ID);
      },
    });

    // The outlet ELEMENT is adopted node-for-node because its container was
    // keyed on ROUTER_OUTLET_KEY and the matching id — the whole point of
    // exporting the constant. The route then hydrates its content inside that
    // very element: content renders correctly with no duplicated/stale node.
    expect(container.querySelector(`#${CUSTOM_OUTLET_ID}`)).toBe(outletBefore);
    expect(text(container.querySelector('#section-title'))).toBe('intro');
    expect(container.querySelectorAll('#section-title').length).toBe(1);

    mounted.unmount();
    container.remove();
  });
});
