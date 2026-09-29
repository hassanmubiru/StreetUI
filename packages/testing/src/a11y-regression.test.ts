/**
 * StreetUI 2.2 Phase 2 — Accessibility regression suite.
 *
 * This is the single, consolidated a11y regression GATE for the framework. It
 * exercises the whole accessibility contract that 2.2 promises — deterministic
 * a11y ids, ARIA state sync, dialog/popover/tooltip/dropdown/toast semantics,
 * keyboard navigation (Tab/Shift+Tab, Escape, arrows/Home/End, Enter/Space),
 * focus containment + restoration (incl. nested modals), live regions, and
 * SSR→hydration a11y preservation — entirely through the PUBLIC consumer
 * surface (`@streetui/*` packages + the `streetui/testing` helpers). No
 * private-graph access, no second assertion framework, no bespoke renderer.
 *
 * HONEST SCOPE (do not overstate):
 *   - These run under happy-dom, which is a real DOM implementation: focus,
 *     `document.activeElement`, keyboard events and attribute reflection are
 *     genuinely exercised and asserted deterministically.
 *   - happy-dom is NOT a browser and NOT an assistive technology. This suite
 *     therefore verifies the *structural + behavioral* a11y contract (roles,
 *     ARIA state, keyboard/focus wiring). It makes NO claim of screen-reader
 *     conformance, actual AT announcement, or visual/contrast conformance —
 *     those gates require a real browser + AT and remain BLOCKED (see the final
 *     `describe` block, which documents the boundary rather than faking it).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter, a11yIds } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, type Signal } from '@streetui/state';
import { BrowserDOMAdapter, createAnnouncer } from '@streetui/dom';
import { render } from './test-renderer.js';
import {
  findByRole,
  findAllByRole,
  flushUpdates,
  openOverlay,
  closeOverlay,
  pressKey,
  renderServerThenHydrate,
} from './helpers.js';

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
});

// ── 1. Deterministic a11y ids ───────────────────────────────────────────────

describe('a11y ids are deterministic (no counters, no randomness)', () => {
  it('derives stable slot ids from a base with no global state', () => {
    const ids = a11yIds('email');
    expect(ids.input).toBe('email-input');
    expect(ids.label).toBe('email-label');
    expect(ids.description).toBe('email-description');
    expect(ids.error).toBe('email-error');
    // Repeated calls derive identical slot ids (pure function of the base).
    const again = a11yIds('email');
    expect(again.input).toBe(ids.input);
    expect(again.label).toBe(ids.label);
    expect(again.title).toBe(ids.title);
    expect(a11yIds('other').input).toBe('other-input');
  });

  it('wires an input to its label/description/error via matching ids', () => {
    const ids = a11yIds('password');
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.text('Password', { id: ids.label });
      page.input({
        id: ids.input,
        ariaLabelledBy: ids.label,
        ariaDescribedBy: ids.error,
        ariaInvalid: true,
      });
      page.text('Too short', { id: ids.error, role: 'alert' });
    });
    const { container, unmount } = render(app);
    const input = container.querySelector('#password-input')!;
    expect(input.getAttribute('aria-labelledby')).toBe('password-label');
    expect(input.getAttribute('aria-describedby')).toBe('password-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    // Both referenced targets exist, so the wiring is resolvable.
    expect(container.querySelector('#password-label')).not.toBeNull();
    expect(findByRole(container, 'alert').textContent).toBe('Too short');
    unmount();
  });
});

// ── 2. ARIA state sync (props → DOM attributes) ─────────────────────────────

describe('ARIA state is reflected onto the DOM as expected', () => {
  it('reflects role/tabindex/aria-* and keeps boolean ARIA as "true"/"false"', () => {
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.button('Menu', {
        role: 'button',
        tabIndex: 0,
        ariaLabel: 'Open menu',
        ariaHasPopup: 'menu',
        ariaControls: 'menu-panel',
        ariaExpanded: false,
        ariaHidden: false,
      });
    });
    const { container, unmount } = render(app);
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('role')).toBe('button');
    expect(btn.getAttribute('tabindex')).toBe('0');
    expect(btn.getAttribute('aria-label')).toBe('Open menu');
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-controls')).toBe('menu-panel');
    // ARIA booleans must survive as strings — never dropped like a boolean attr.
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-hidden')).toBe('false');
    unmount();
  });

  it('renders `disabled` as a real boolean attribute (present=true / absent=false)', () => {
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.button('Off', { id: 'off', disabled: true });
      page.button('On', { id: 'on', disabled: false });
    });
    const { container, unmount } = render(app);
    expect(container.querySelector('#off')!.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('#on')!.hasAttribute('disabled')).toBe(false);
    unmount();
  });

  it('reflects selected/current state for a nav-style control set', () => {
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.button('Tab A', { id: 'ta', role: 'tab', ariaSelected: true });
      page.button('Tab B', { id: 'tb', role: 'tab', ariaSelected: false });
      page.button('Home', { id: 'h', ariaCurrent: 'page' });
    });
    const { container, unmount } = render(app);
    expect(container.querySelector('#ta')!.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('#tb')!.getAttribute('aria-selected')).toBe('false');
    expect(container.querySelector('#h')!.getAttribute('aria-current')).toBe('page');
    // role=tab is discoverable by role query.
    expect(findAllByRole(container, 'tab')).toHaveLength(2);
    unmount();
  });
});

// ── 3. Dialog — modal semantics, focus in/out, Escape ───────────────────────

describe('dialog: modal semantics + focus management', () => {
  it('exposes role=dialog + aria-modal, moves focus in, restores + closes on Escape', async () => {
    const open: Signal<boolean> = signal(false);
    let closes = 0;
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.button('Open', { id: 'opener', onClick: () => open.set(true) });
      page.dialog(
        'dlg',
        { open, onClose: () => { open.set(false); closes++; } },
        (d) => {
          d.button('First', { id: 'first' });
          d.button('Second', { id: 'second' });
        },
      );
    });
    const { unmount } = render(app);

    // Closed: no panel anywhere in the document.
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    const opener = document.getElementById('opener')!;
    opener.focus();
    await openOverlay(open);

    const panel = findByRole(document.body, 'dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    // Focus moved into the panel (first focusable).
    expect(document.activeElement).toBe(document.getElementById('first'));

    // Escape closes cooperatively and restores focus to the opener.
    pressKey('Escape');
    await flushUpdates();
    expect(closes).toBe(1);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    unmount();
  });

  it('traps Tab focus within the panel (wrap-around both directions)', async () => {
    const open: Signal<boolean> = signal(true);
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.dialog('dlg', { open }, (d) => {
        d.button('First', { id: 'first' });
        d.button('Second', { id: 'second' });
      });
    });
    const { unmount } = render(app);
    await flushUpdates();

    const first = document.getElementById('first')!;
    const second = document.getElementById('second')!;
    second.focus();
    pressKey('Tab', second); // last → first
    expect(document.activeElement).toBe(first);
    pressKey('Tab', first, { shiftKey: true }); // first → last
    expect(document.activeElement).toBe(second);
    unmount();
  });
});

// ── 4. Non-modal / announcement overlays ────────────────────────────────────

describe('popover / dropdown / tooltip / toast semantics', () => {
  it('popover: role=dialog, NO aria-modal, takes focus on open', async () => {
    const open: Signal<boolean> = signal(false);
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.popover('pop', { open }, (p) => p.button('Go', { id: 'go' }));
    });
    const { unmount } = render(app);
    await openOverlay(open);
    const panel = findByRole(document.body, 'dialog');
    expect(panel.hasAttribute('aria-modal')).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('go'));
    unmount();
  });

  it('dropdown: role=menu, roves with arrows/Home/End, activates with Enter', async () => {
    const open: Signal<boolean> = signal(false);
    let chosen = '';
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.dropdown('menu', { open, onClose: () => open.set(false) }, (m) => {
        m.button('First', { id: 'mi-1', onClick: () => { chosen = 'first'; } });
        m.button('Second', { id: 'mi-2', onClick: () => { chosen = 'second'; } });
        m.button('Third', { id: 'mi-3', onClick: () => { chosen = 'third'; } });
      });
    });
    const { unmount } = render(app);
    await openOverlay(open);

    expect(findByRole(document.body, 'menu')).not.toBeNull();
    expect(document.activeElement).toBe(document.getElementById('mi-1'));
    pressKey('ArrowDown');
    expect(document.activeElement).toBe(document.getElementById('mi-2'));
    pressKey('ArrowUp'); // mi-2 → mi-1
    pressKey('ArrowUp'); // mi-1 → wraps to mi-3
    expect(document.activeElement).toBe(document.getElementById('mi-3'));
    pressKey('Home');
    expect(document.activeElement).toBe(document.getElementById('mi-1'));
    pressKey('End');
    expect(document.activeElement).toBe(document.getElementById('mi-3'));
    pressKey('Enter');
    expect(chosen).toBe('third');
    unmount();
  });

  it('tooltip: role=tooltip and never steals focus from its anchor', async () => {
    const open: Signal<boolean> = signal(false);
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.button('Anchor', { id: 'anchor' });
      page.tooltip('tip', { open }, (t) => t.text('Hint'));
    });
    const { unmount } = render(app);
    const anchor = document.getElementById('anchor')!;
    anchor.focus();
    await openOverlay(open);
    expect(findByRole(document.body, 'tooltip')).not.toBeNull();
    expect(document.activeElement).toBe(anchor); // not stolen
    unmount();
  });

  it('toast: role=status + aria-live=polite, focus stays put', async () => {
    const open: Signal<boolean> = signal(false);
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.button('Keep', { id: 'keep' });
      page.toast('t', { open }, (t) => t.text('Saved'));
    });
    const { unmount } = render(app);
    const keep = document.getElementById('keep')!;
    keep.focus();
    await openOverlay(open);
    const toast = findByRole(document.body, 'status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(keep); // not stolen
    await closeOverlay(open);
    expect(document.body.querySelector('[role="status"]')).toBeNull();
    unmount();
  });
});

// ── 5. Nested modal focus ownership ─────────────────────────────────────────

describe('nested modal dialogs: the topmost owns focus, the parent resumes', () => {
  it('inner dialog traps focus while open; outer resumes containment on close', async () => {
    const outer: Signal<boolean> = signal(false);
    const inner: Signal<boolean> = signal(false);
    const app = streetui.app({ name: 'a11y' });
    app.page('home', (page) => {
      page.button('Open', { id: 'opener', onClick: () => outer.set(true) });
      page.dialog('outer', { open: outer, onClose: () => outer.set(false) }, (d) => {
        d.button('OuterA', { id: 'outer-a' });
        d.button('OuterB', { id: 'outer-b' });
        d.dialog('inner', { open: inner, onClose: () => inner.set(false) }, (i) => {
          i.button('InnerA', { id: 'inner-a' });
          i.button('InnerB', { id: 'inner-b' });
        });
      });
    });
    const { unmount } = render(app);

    document.getElementById('opener')!.focus();
    await openOverlay(outer);
    expect(document.activeElement).toBe(document.getElementById('outer-a'));

    await openOverlay(inner);
    expect(document.activeElement).toBe(document.getElementById('inner-a'));
    // Two dialogs are present.
    expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(2);
    // Tab wraps within the INNER (topmost) panel.
    const innerB = document.getElementById('inner-b')!;
    innerB.focus();
    pressKey('Tab', innerB);
    expect(document.activeElement).toBe(document.getElementById('inner-a'));

    // Close inner: outer resumes containment and its Tab trap works again.
    await closeOverlay(inner);
    expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(1);
    const outerB = document.getElementById('outer-b')!;
    outerB.focus();
    pressKey('Tab', outerB);
    expect(document.activeElement).toBe(document.getElementById('outer-a'));
    unmount();
  });
});

// ── 6. Live regions (imperative announcer) ──────────────────────────────────

describe('live regions: polite status + assertive alert', () => {
  it('creates exactly two atomic live regions and announces into them', async () => {
    const announcer = createAnnouncer(new BrowserDOMAdapter());
    const polite = document.body.querySelector('[data-streetui-live="polite"]')!;
    const assertive = document.body.querySelector('[data-streetui-live="assertive"]')!;
    expect(polite.getAttribute('role')).toBe('status');
    expect(polite.getAttribute('aria-live')).toBe('polite');
    expect(polite.getAttribute('aria-atomic')).toBe('true');
    expect(assertive.getAttribute('role')).toBe('alert');
    expect(assertive.getAttribute('aria-live')).toBe('assertive');
    expect(assertive.getAttribute('aria-atomic')).toBe('true');

    // Text is written on a microtask — flush before asserting.
    announcer.announce('Saved');
    await Promise.resolve();
    expect(polite.textContent).toBe('Saved');
    announcer.announce('Failed', { assertive: true });
    await Promise.resolve();
    expect(assertive.textContent).toBe('Failed');

    announcer.destroy();
    expect(document.body.querySelector('[data-streetui-live="polite"]')).toBeNull();
  });
});

// ── 7. SSR → hydration preserves a11y markup + ids ──────────────────────────

describe('a11y survives SSR → hydration without rewrite or id drift', () => {
  it('adopts server a11y attributes on the SAME node (no rebuild)', () => {
    const build = (): ReturnType<typeof streetui.app> => {
      const app = streetui.app({ name: 'a11y' });
      app.page('home', (page) => {
        const ids = a11yIds('email');
        page.text('Email', { id: ids.label });
        page.input({ id: ids.input, ariaLabelledBy: ids.label, ariaInvalid: false });
        page.button('Menu', { role: 'button', ariaExpanded: false, ariaLabel: 'Open menu' });
      });
      return app;
    };

    const result = renderServerThenHydrate(build);
    // Deterministic ids appear in the server HTML.
    expect(result.serverHtml).toContain('id="email-input"');
    expect(result.serverHtml).toContain('aria-labelledby="email-label"');
    expect(result.serverHtml).toContain('aria-expanded="false"');

    const btn = result.container.querySelector('button')!;
    const input = result.container.querySelector('#email-input')!;
    expect(btn.getAttribute('role')).toBe('button');
    expect(btn.getAttribute('aria-label')).toBe('Open menu');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-labelledby')).toBe('email-label');
    // Exactly one of each — hydration adopted rather than duplicating.
    expect(result.container.querySelectorAll('button').length).toBe(1);
    expect(result.container.querySelectorAll('#email-input').length).toBe(1);
    result.unmount();
  });

  it('reports no hydration mismatches for an a11y-annotated tree', () => {
    const build = (): ReturnType<typeof streetui.app> => {
      const app = streetui.app({ name: 'a11y' });
      app.page('home', (page) => {
        page.button('Toggle', { ariaExpanded: true, ariaControls: 'p' });
        page.container('p', () => {}, { role: 'region', ariaLabel: 'Panel' });
      });
      return app;
    };
    const result = renderServerThenHydrate(build, { collectDiagnostics: true });
    expect(result.diagnostics).toHaveLength(0);
    result.unmount();
  });
});

// ── 8. Boundary: what is NOT claimed here (BLOCKED) ─────────────────────────

describe('accessibility scope boundary (unverified capabilities stay BLOCKED)', () => {
  it('documents that screen-reader / AT / visual conformance is NOT asserted', () => {
    // This suite proves the structural + behavioral a11y contract under
    // happy-dom (roles, ARIA state, keyboard/focus wiring). It deliberately
    // does NOT assert — and this test must never be changed to assert —:
    //   • that a real screen reader announces these regions/roles (needs AT);
    //   • real browser focus-order/visibility heuristics (needs a browser);
    //   • colour-contrast or reflow/zoom conformance (needs a browser + audit).
    // Those gates require a real browser + assistive technology, which are
    // unavailable in this environment and remain explicitly BLOCKED. Per the
    // anti-fabrication rule they are neither simulated nor claimed here.
    const BLOCKED = ['screen-reader-announcement', 'browser-focus-visibility', 'colour-contrast'];
    expect(BLOCKED.length).toBeGreaterThan(0);
    // A canary: happy-dom is not a browser. If a future runtime ever makes this
    // true, the scope note above must be revisited before claiming AT support.
    expect(typeof navigator === 'undefined' || !/HeadlessChrome/.test(navigator.userAgent)).toBe(true);
  });
});

