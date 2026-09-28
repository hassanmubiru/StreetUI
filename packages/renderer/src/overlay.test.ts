/**
 * Overlay system (v1.9 §5/§6).
 *
 * Every overlay (dialog/popover/tooltip/dropdown/toast) is the same composition:
 * a portal + a `when(open, …)` panel + focus/keyboard behavior wired from an
 * `__overlay__<portalId>` descriptor. These tests assert the *structural* and
 * *focus* contract each kind promises — role/modality, focus movement, escape,
 * and restore — using the real browser adapter against happy-dom. They are
 * deterministic (no timings): every effect here is synchronous signal fan-out.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, type Signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
});

/** Dispatch a bubbling keydown from `target` (mirrors focus.test.ts). */
function keydown(target: Element, key: string, opts: { shiftKey?: boolean } = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }),
  );
}

function mountApp(build: (page: import('@streetui/dsl').PageDSL) => void) {
  const app = streetui.app({ name: 'overlay' });
  app.page('home', build);
  const compiled = compile(app);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const handle = renderer.mount(compiled, container);
  return { container, handle };
}

describe('dialog — modal semantics', () => {
  it('renders role=dialog + aria-modal, takes focus on open, restores + closes on Escape', () => {
    const open: Signal<boolean> = signal(false);
    let closes = 0;
    mountApp((page) => {
      page.button('Open', { id: 'opener', onClick: () => open.set(true) });
      page.dialog('dlg', { open, onClose: () => { open.set(false); closes++; } }, (d) => {
        d.button('First', { id: 'first' });
        d.button('Second', { id: 'second' });
      });
    });

    // Closed initially — no panel anywhere.
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    // Focus the opener, then open the dialog.
    const opener = document.getElementById('opener')!;
    opener.focus();
    expect(document.activeElement).toBe(opener);
    open.set(true);

    const panel = document.body.querySelector('[role="dialog"]')!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('aria-modal')).toBe('true');
    // Panel lives in a body-level portal container, not inline.
    expect(document.body.querySelector('[data-streetui-portal-container] [role="dialog"]'))
      .not.toBeNull();
    // Focus moved into the panel (first focusable).
    expect(document.activeElement).toBe(document.getElementById('first'));

    // Escape closes cooperatively (onClose flips `open`) and restores focus.
    keydown(document.activeElement!, 'Escape');
    expect(closes).toBe(1);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('traps Tab focus within the panel (wrap-around)', () => {
    const open: Signal<boolean> = signal(true);
    mountApp((page) => {
      page.dialog('dlg', { open }, (d) => {
        d.button('First', { id: 'first' });
        d.button('Second', { id: 'second' });
      });
    });

    const first = document.getElementById('first')!;
    const second = document.getElementById('second')!;
    // From the last item, Tab wraps to the first.
    second.focus();
    keydown(second, 'Tab');
    expect(document.activeElement).toBe(first);
    // From the first item, Shift+Tab wraps to the last.
    keydown(first, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(second);
  });
});

describe('non-modal overlays take focus without modality', () => {
  it('popover: role=dialog, no aria-modal, focuses the panel on open', () => {
    const open: Signal<boolean> = signal(false);
    mountApp((page) => {
      page.popover('pop', { open }, (p) => {
        p.button('Go', { id: 'go' });
      });
    });
    open.set(true);
    const panel = document.body.querySelector('[role="dialog"]')!;
    expect(panel).not.toBeNull();
    expect(panel.hasAttribute('aria-modal')).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('go'));
  });

  it('dropdown: role=menu, focuses the menu on open', () => {
    const open: Signal<boolean> = signal(false);
    mountApp((page) => {
      page.dropdown('menu', { open }, (m) => {
        m.button('Item', { id: 'item' });
      });
    });
    open.set(true);
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.activeElement).toBe(document.getElementById('item'));
  });
});

describe('announcement overlays never steal focus', () => {
  it('toast: role=status + aria-live=polite, focus stays put', () => {
    const open: Signal<boolean> = signal(false);
    mountApp((page) => {
      page.button('Keep', { id: 'keep' });
      page.toast('t', { open }, (t) => {
        t.text('Saved');
      });
    });
    const keep = document.getElementById('keep')!;
    keep.focus();
    open.set(true);
    const toast = document.body.querySelector('[role="status"]')!;
    expect(toast).not.toBeNull();
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(keep); // not stolen
  });

  it('tooltip: role=tooltip, focus stays put', () => {
    const open: Signal<boolean> = signal(false);
    mountApp((page) => {
      page.button('Anchor', { id: 'anchor' });
      page.tooltip('tip', { open }, (t) => {
        t.text('Hint');
      });
    });
    const anchor = document.getElementById('anchor')!;
    anchor.focus();
    open.set(true);
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull();
    expect(document.activeElement).toBe(anchor); // not stolen
  });
});

describe('overlay reactivity + cleanup', () => {
  it('mounts and unmounts the panel as `open` toggles, and cleans up on unmount', () => {
    const open: Signal<boolean> = signal(false);
    const { handle } = mountApp((page) => {
      page.dialog('dlg', { open }, (d) => {
        d.button('OK', { id: 'ok' });
      });
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    open.set(true);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    open.set(false);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    // Open again, then unmount the whole app — no orphaned body container.
    open.set(true);
    expect(document.body.querySelector('[data-streetui-portal-container]')).not.toBeNull();
    handle.unmount();
    expect(document.body.querySelector('[data-streetui-portal-container]')).toBeNull();
  });
});

describe('dialog — SSR renders inline, hydration wires focus', () => {
  function buildOpenDialog() {
    const open: Signal<boolean> = signal(true);
    const app = streetui.app({ name: 'overlay-ssr' });
    app.page('home', (page) => {
      page.dialog('dlg', { open }, (d) => {
        d.button('First', { id: 'first' });
        d.button('Second', { id: 'second' });
      });
    });
    return compile(app);
  }

  it('server emits the panel inline; hydration relocates it to body and focuses it', () => {
    const compiled = buildOpenDialog();
    const html = renderToString(compiled);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-streetui-portal');
    // Body relocation is browser-only.
    expect(html).not.toContain('data-streetui-portal-container');

    resetIdCounter();
    const compiled2 = buildOpenDialog();
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.hydrate(compiled2, container);

    // Panel now lives in a body-level container …
    expect(document.body.querySelector('[data-streetui-portal-container] [role="dialog"]'))
      .not.toBeNull();
    // … and the anchor left inline is empty.
    expect(container.querySelector('[data-streetui-portal]')!.textContent).toBe('');
    // Overlay wired on hydrate (open peeked true) → focus moved into the panel.
    expect(document.activeElement).toBe(document.getElementById('first'));

    handle.unmount();
    expect(document.body.querySelector('[data-streetui-portal-container]')).toBeNull();
  });
});

describe('overlay transitions + focus restore timing (§10)', () => {
  const FADE = { name: 'fade', duration: 100000 } as const;
  const endTransition = (el: Element): void => {
    el.dispatchEvent(new Event('transitionend', { bubbles: true }));
  };

  it('enters the panel on open, and on close restores focus immediately while the panel leaves', () => {
    const open: Signal<boolean> = signal(false);
    mountApp((page) => {
      page.button('Open', { id: 'opener', onClick: () => open.set(true) });
      page.dialog(
        'dlg',
        { open, onClose: () => open.set(false), transition: FADE },
        (d) => {
          d.button('First', { id: 'first' });
        },
      );
    });

    const opener = document.getElementById('opener')!;
    opener.focus();
    open.set(true);

    // Panel present; its host branch is playing the enter animation.
    const portal = document.body.querySelector('[data-streetui-portal-container]')!;
    const panel = portal.querySelector('[role="dialog"]')!;
    expect(panel).not.toBeNull();
    expect(portal.querySelector('.fade-enter-active')).not.toBeNull();
    // Focus moved into the panel.
    expect(document.activeElement).toBe(document.getElementById('first'));
    // Settle the enter.
    endTransition(portal.querySelector('.fade-enter-active')!);

    // Close: focus MUST be restored to the opener at once — a departing panel
    // must not keep focus — even though the panel is still animating out (§10).
    open.set(false);
    expect(document.activeElement).toBe(opener); // restored immediately
    const leaving = portal.querySelector('.fade-leave-active');
    expect(leaving).not.toBeNull(); // panel still in the DOM, animating out
    expect(portal.querySelector('[role="dialog"]')).not.toBeNull();

    // Leave completes → panel removed from the DOM.
    endTransition(leaving!);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('SSR of an overlay with a transition emits no transition classes (§21)', () => {
    const open = signal(true);
    const app = streetui.app({ name: 'overlay-ssr' });
    app.page('home', (page) => {
      page.dialog('dlg', { open, transition: FADE }, (d) => d.text('hi'));
    });
    const html = renderToString(compile(app));
    expect(html).not.toContain('fade-enter');
    expect(html).not.toContain('fade-leave');
  });
});

describe('dropdown — menu keyboard navigation (§13)', () => {
  it('roves with arrows/Home/End and activates items with Enter/Space', () => {
    const open: Signal<boolean> = signal(false);
    let chosen = '';
    mountApp((page) => {
      page.dropdown('menu', { open, onClose: () => open.set(false) }, (m) => {
        m.button('First', { id: 'mi-1', onClick: () => { chosen = 'first'; } });
        m.button('Second', { id: 'mi-2', onClick: () => { chosen = 'second'; } });
        m.button('Third', { id: 'mi-3', onClick: () => { chosen = 'third'; } });
      });
    });

    open.set(true);
    const menu = document.body.querySelector('[role="menu"]')!;
    expect(menu).not.toBeNull();
    // takesFocus moved focus onto the first item.
    expect(document.activeElement).toBe(document.getElementById('mi-1'));

    // ArrowDown advances; ArrowUp from the top wraps to the last.
    keydown(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(document.getElementById('mi-2'));
    keydown(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(document.getElementById('mi-1'));
    keydown(document.activeElement!, 'ArrowUp');
    expect(document.activeElement).toBe(document.getElementById('mi-3'));
    keydown(document.activeElement!, 'End');
    expect(document.activeElement).toBe(document.getElementById('mi-3'));

    // Enter activates the focused item (fires its onClick).
    keydown(document.activeElement!, 'Enter');
    expect(chosen).toBe('third');
  });
});

describe('nested modal dialogs — focus ownership (§12/§16)', () => {
  it('the inner dialog owns focus while open; the outer resumes containment after it closes', () => {
    const outer: Signal<boolean> = signal(false);
    const inner: Signal<boolean> = signal(false);
    mountApp((page) => {
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

    document.getElementById('opener')!.focus();
    outer.set(true);
    // Outer took focus.
    expect(document.activeElement).toBe(document.getElementById('outer-a'));

    // Open the inner dialog: focus moves into it and the inner panel owns
    // containment — a focus attempt landing outside is pulled into the INNER
    // panel, not the outer one.
    inner.set(true);
    expect(document.activeElement).toBe(document.getElementById('inner-a'));

    // Simulate focus escaping to the body: only the topmost (inner) container
    // enforces containment, so focus is redirected back into the inner panel.
    document.body.focus();
    expect(document.getElementById('inner-a')).not.toBeNull();
    // Tab from the inner's last item wraps within the INNER panel.
    const innerB = document.getElementById('inner-b')!;
    innerB.focus();
    keydown(innerB, 'Tab');
    expect(document.activeElement).toBe(document.getElementById('inner-a'));

    // Close the inner dialog. Focus restores and the OUTER dialog resumes
    // containment (its listeners were never removed, but were dormant while the
    // inner one was the top owner).
    inner.set(false);
    expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(1);
    // Outer now traps Tab again: from the outer's last item, Tab wraps to first.
    const outerB = document.getElementById('outer-b')!;
    outerB.focus();
    keydown(outerB, 'Tab');
    expect(document.activeElement).toBe(document.getElementById('outer-a'));
  });
});
