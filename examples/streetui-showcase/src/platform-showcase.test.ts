/**
 * StreetUI 2.0 Platform Showcase — the PRIMARY end-to-end integration test (§21).
 *
 * This drives the whole 2.0 application platform through the real pipeline
 * (DSL → Compiler → Graph → Runtime → Renderer → real DOM, plus SSR + hydration)
 * under happy-dom, using ONLY the public `streetui` package:
 *
 *   • Routing + persistent shell + client navigation + link interception
 *   • Route metadata (`head`) reflected into `document.head`
 *   • Async data via `resource` + `asyncBoundary` (loading → success)
 *   • `errorBoundary` fallback on a failing route (unknown id)
 *   • `createForm` → `mutation` → `onSuccess` refetch → reactive UI + toast
 *   • Overlays (popover / dropdown / modal dialog / toast) portalled to <body>
 *   • A CSS-class transition on a disclosure region (enter + deferred leave)
 *   • i18n reactive locale switch
 *   • a11y roles
 *   • SSR (`renderToString` + `renderHead`) then `renderer.hydrate` (DOM adoption)
 *
 * Nothing is faked at the framework layer: data lives behind async loaders, and
 * every behavior is exercised through the one public renderer.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetIdCounter,
  renderToString,
  renderHead,
  createRenderer,
  BrowserDOMAdapter,
} from 'streetui';
import { createPlatformShowcase, createDashboardBundle } from './platform-showcase.js';

// ── helpers ──────────────────────────────────────────────────────────────────

const txt = (el: Element | null | undefined) => el?.textContent?.trim() ?? '';

/** Flush the microtask chain (resource loaders, mutation onSuccess) and any
 *  pending macrotasks (transition timers) up to `ms`. */
async function flush(ms = 0): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await new Promise<void>((r) => setTimeout(r, ms));
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function click(el: Element | null): void {
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

function setInput(el: Element | null, value: string): void {
  const input = el as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function mountAt(path: string) {
  resetIdCounter();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const showcase = createPlatformShowcase();
  const handle = showcase.mount(container, { path });
  return { showcase, container, handle };
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  resetIdCounter();
});

// 1 ── Routing, shell, metadata, a11y ─────────────────────────────────────────
describe('routing + shell + route metadata', () => {
  it('renders the dashboard at / with an a11y region and reactive title metadata', () => {
    const { container, handle } = mountAt('/');

    // Persistent shell (navigation landmark) is present.
    const nav = container.querySelector('#shell-nav');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('role')).toBe('navigation');

    // Route content + a11y region role.
    const region = container.querySelector('#dashboard');
    expect(region?.getAttribute('role')).toBe('region');
    expect(txt(container.querySelector('#dash-title'))).toBe('Dashboard');

    // Route metadata was applied to <head>.
    expect(txt(document.querySelector('title'))).toBe('Dashboard');

    handle.mounted.unmount();
  });

  it('navigates client-side across all routes while the shell persists', async () => {
    const { container, handle } = mountAt('/');
    const shell = container.querySelector('#shell-nav');

    handle.router.navigate('/settings');
    expect(txt(container.querySelector('#settings-title'))).toBe('Settings');
    expect(container.querySelector('#shell-nav')).toBe(shell); // same shell node reused
    expect(txt(document.querySelector('title'))).toBe('Settings');

    handle.router.navigate('/');
    expect(txt(container.querySelector('#dash-title'))).toBe('Dashboard');

    handle.mounted.unmount();
  });

  it('intercepts internal link clicks to navigate (no full reload)', async () => {
    const { container, handle } = mountAt('/');

    click(container.querySelector('#nav-users'));
    await flush();

    expect(container.querySelector('#users-title')).not.toBeNull();
    expect(container.querySelector('#shell-nav')).not.toBeNull();

    handle.mounted.unmount();
  });

  it('renders the wildcard not-found route for an unknown path', () => {
    const { container, handle } = mountAt('/does-not-exist');
    expect(container.querySelector('#not-found')).not.toBeNull();
    handle.mounted.unmount();
  });
});

// 2 ── Async data: resource + asyncBoundary ───────────────────────────────────
describe('async data (resource + asyncBoundary)', () => {
  it('shows the loading branch, then the loaded user list', async () => {
    const { container, handle } = mountAt('/users');

    // Synchronously after mount the resource is still loading.
    expect(container.querySelector('#users-loading')).not.toBeNull();

    await flush();

    // After the loader settles the success branch renders the seeded users.
    expect(container.querySelector('#users-loading')).toBeNull();
    expect(container.querySelector('#users-list')).not.toBeNull();
    expect(txt(container.querySelector('#user-link-1'))).toBe('Ada Lovelace');
    expect(txt(container.querySelector('#user-link-3'))).toBe('Grace Hopper');

    handle.mounted.unmount();
  });
});

// 3 ── errorBoundary fallback on a failing route ──────────────────────────────
describe('errorBoundary (failing route)', () => {
  it('renders the fallback with a retry control when the detail load rejects', async () => {
    const { container, handle } = mountAt('/users/999');
    await flush();

    expect(container.querySelector('#user-detail-error')).not.toBeNull();
    expect(container.querySelector('#user-detail-retry')).not.toBeNull();

    handle.mounted.unmount();
  });
});

// 4 ── Data mutation flow: form → mutation → refetch → UI + toast ─────────────
describe('user details: edit form → mutation → refetch → toast', () => {
  it('drives the full write path and updates the UI reactively', async () => {
    const { container, handle } = mountAt('/users/1');
    await flush();

    expect(txt(container.querySelector('#user-name'))).toBe('Ada Lovelace');
    expect(txt(container.querySelector('#user-email'))).toBe('ada@example.com');

    // Open the focus-trapped edit dialog (portalled to <body>).
    click(container.querySelector('#user-edit-btn'));
    await flush();
    const dialogForm = document.querySelector('#edit-form');
    expect(dialogForm).not.toBeNull();
    // Prefilled from the loaded user.
    expect((document.querySelector('#edit-name') as HTMLInputElement).value).toBe('Ada Lovelace');

    // Edit the name and submit → mutation runs, server updates, refetch fires.
    setInput(document.querySelector('#edit-name'), 'Ada Byron');
    dialogForm!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    // UI reflects the refetched value; dialog closed; toast raised.
    expect(txt(container.querySelector('#user-name'))).toBe('Ada Byron');
    expect(document.querySelector('#edit-form')).toBeNull(); // dialog closed
    expect(txt(document.querySelector('#toast-text'))).toBe('Settings saved.');

    handle.mounted.unmount();
  });

  it('blocks submit when the form is invalid (name too short)', async () => {
    const { container, handle } = mountAt('/users/1');
    await flush();

    click(container.querySelector('#user-edit-btn'));
    await flush();

    setInput(document.querySelector('#edit-name'), 'A'); // minLength(2) fails
    document.querySelector('#edit-form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await flush();

    // Name unchanged, an error is shown, dialog stays open.
    expect(txt(container.querySelector('#user-name'))).toBe('Ada Lovelace');
    expect(txt(document.querySelector('#edit-name-error'))).not.toBe('');
    expect(document.querySelector('#edit-form')).not.toBeNull();

    handle.mounted.unmount();
  });
});

// 5 ── Overlays portalled to <body> ───────────────────────────────────────────
describe('overlays (popover + dropdown)', () => {
  it('opens and closes the dashboard info popover', async () => {
    const { showcase, container, handle } = mountAt('/');

    expect(document.querySelector('#dash-info-text')).toBeNull();
    click(container.querySelector('#dash-info-btn'));
    await flush();
    expect(document.querySelector('#dash-info-text')).not.toBeNull();

    // Cooperative close: flip the signal the app owns.
    showcase.ui.infoOpen.set(false);
    await flush();
    expect(document.querySelector('#dash-info-text')).toBeNull();

    handle.mounted.unmount();
  });

  it('opens the shell language dropdown', async () => {
    const { container, handle } = mountAt('/');

    expect(document.querySelector('#menu-fr')).toBeNull();
    click(container.querySelector('#menu-btn'));
    await flush();
    expect(document.querySelector('#menu-en')).not.toBeNull();
    expect(document.querySelector('#menu-fr')).not.toBeNull();

    handle.mounted.unmount();
  });
});

// 6 ── Transition disclosure (enter + deferred leave) ─────────────────────────
describe('transition disclosure', () => {
  it('mounts on toggle and defers removal until the leave transition completes', async () => {
    const { container, handle } = mountAt('/');

    expect(container.querySelector('#dash-details')).toBeNull();

    click(container.querySelector('#dash-toggle')); // open
    await flush();
    expect(container.querySelector('#dash-details')).not.toBeNull();

    click(container.querySelector('#dash-toggle')); // close (leave deferred ~15ms)
    await flush(40);
    expect(container.querySelector('#dash-details')).toBeNull();

    handle.mounted.unmount();
  });
});

// 7 ── i18n reactive locale switch ────────────────────────────────────────────
describe('i18n locale switch', () => {
  it('reactively re-translates shell nav and route headings', () => {
    const { showcase, container, handle } = mountAt('/');

    expect(txt(container.querySelector('#nav-dashboard'))).toBe('Dashboard');
    expect(txt(container.querySelector('#dash-title'))).toBe('Dashboard');

    showcase.i18n.setLocale('fr');

    expect(txt(container.querySelector('#nav-dashboard'))).toBe('Tableau de bord');
    expect(txt(container.querySelector('#dash-title'))).toBe('Tableau de bord');

    handle.mounted.unmount();
  });
});

// 8 ── SSR + hydration (standalone dashboard bundle) ──────────────────────────
describe('SSR + hydration', () => {
  it('server-renders head + body, then hydrates by adopting the server DOM', async () => {
    resetIdCounter();
    const { compiled, ui } = createDashboardBundle();

    const bodyHtml = renderToString(compiled);
    const headHtml = renderHead(compiled);

    // Head metadata emitted as a string on the server.
    expect(headHtml).toContain('<title');
    expect(headHtml).toContain('Dashboard');
    // Body carries the dashboard heading.
    expect(bodyHtml).toContain('Dashboard');

    // Plant the server HTML and hydrate.
    resetIdCounter();
    document.body.innerHTML = `<div id="app">${bodyHtml}</div>`;
    const appEl = document.getElementById('app')!;
    const serverTitle = appEl.querySelector('#dash-title');
    expect(serverTitle).not.toBeNull();

    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.hydrate(compiled, appEl);

    // Adopted, not recreated — same node object.
    expect(appEl.querySelector('#dash-title')).toBe(serverTitle);

    // Reactive after hydration: toggling the disclosure signal mounts the branch.
    expect(appEl.querySelector('#dash-details')).toBeNull();
    ui.detailsOpen.set(true);
    await flush();
    expect(appEl.querySelector('#dash-details')).not.toBeNull();

    handle.unmount();
  });
});
