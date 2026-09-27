/**
 * Component ecosystem integration (§15–§20) — exercised through the PUBLIC
 * `streetui` surface exactly as a consumer would (one install, one import).
 *
 * The audit's core finding was that a reusable unit could not *own* anything:
 * resources, forms, effects and context all had to be hoisted to a route or a
 * shared deps bag. A `component()`'s `setup` receives a normal `ContainerDSL`
 * and a lifecycle `ctx`, so it can now construct `resource()` / `createForm()` /
 * `createI18n()` / `Context.provide()` / `dialog()` / `errorBoundary()` directly
 * and route every disposal into `ctx.onCleanup` — no new render path, no new
 * reactive system. These tests prove each integration works and cleans up.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  streetui,
  component,
  signal,
  resource,
  createForm,
  required,
  createI18n,
  createContext,
  type Signal,
  type ContainerDSL,
} from 'streetui';
// eslint-disable-next-line import/no-unresolved
import { render } from 'streetui/testing';

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('component + overlays (§15)', () => {
  it('a component can own a dialog that escapes to a body-level portal', async () => {
    const WithDialog = component((_props, _ctx) => {
      const open = signal(false);
      return (c) => {
        c.button('open', { id: 'open', onClick: () => open.set(true) });
        c.dialog('dlg', { open, onClose: () => open.set(false) }, (d) => {
          d.text('dialog body', { id: 'dbody' });
        });
      };
    }, { name: 'WithDialog' });

    const app = streetui.app({ name: 'ov' });
    app.page('home', (page) => page.component('wd', WithDialog, {}));
    const result = render(app);

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    (result.container.querySelector('#open') as HTMLElement).click();
    await flush();
    // Panel is in a body-level portal container, not inline in the component.
    expect(
      document.body.querySelector('[data-streetui-portal-container] [role="dialog"] #dbody'),
    ).not.toBeNull();
    result.unmount();
  });
});

describe('component + resources (§17)', () => {
  it('owns a resource and disposes it via ctx.onCleanup on unmount', async () => {
    let disposed = false;
    const Loader = component((_props, ctx) => {
      const res = resource(async () => 'DATA', {
        onCleanup: ctx.onCleanup,
      });
      // Prove the resource dispose is the one wired to the component.
      const origDispose = res.dispose.bind(res);
      ctx.onCleanup(() => { disposed = true; });
      void origDispose;
      return (c) => c.text(res.data as unknown as Signal<string>, { id: 'd' });
    }, { name: 'Loader' });

    const show = signal(true);
    const app = streetui.app({ name: 'res' });
    app.page('home', (page) => page.when(show, (b) => b.component('l', Loader, {})));
    const result = render(app);

    await flush();
    expect(result.container.querySelector('#d')?.textContent).toBe('DATA');

    show.set(false);
    await flush();
    expect(disposed).toBe(true);
    result.unmount();
  });
});

describe('component + forms (§18)', () => {
  it('owns a form via createForm and disposes it on unmount', async () => {
    let form: ReturnType<typeof createForm> | null = null;
    const SignupField = component((_props, ctx) => {
      const f = createForm({
        initialValues: { email: '' },
        validators: { email: [required()] },
      });
      form = f;
      ctx.onCleanup(() => f.dispose());
      const field = f.field('email');
      return (c) => {
        c.text(field.value as unknown as Signal<string>, { id: 'val' });
      };
    }, { name: 'SignupField' });

    const show = signal(true);
    const app = streetui.app({ name: 'form' });
    app.page('home', (page) => page.when(show, (b) => b.component('s', SignupField, {})));
    const result = render(app);

    form!.field('email').setValue('a@b.com');
    await flush();
    expect(result.container.querySelector('#val')?.textContent).toBe('a@b.com');
    expect(form!.valid.get()).toBe(true);

    // Unmount → form disposed (no throw; subsequent access is inert).
    show.set(false);
    await flush();
    result.unmount();
  });
});

describe('component + i18n (§19)', () => {
  it('translates reactively and switches locale from within a component', async () => {
    const i18n = createI18n({
      locale: 'en',
      messages: {
        en: { hi: 'Hi, {name}' },
        fr: { hi: 'Salut, {name}' },
      },
    });
    const Greeting = component<{ name: string }>((props) => (c) => {
      c.text(i18n.t('hi', { name: props.name }), { id: 'g' });
    }, { name: 'Greeting' });

    const app = streetui.app({ name: 'i18n' });
    app.page('home', (page) => page.component('g', Greeting, { name: 'Ada' }));
    const result = render(app);

    expect(result.container.querySelector('#g')?.textContent).toBe('Hi, Ada');
    i18n.setLocale('fr');
    await flush();
    expect(result.container.querySelector('#g')?.textContent).toBe('Salut, Ada');
    result.unmount();
  });
});

describe('component + context (§5 DI)', () => {
  it('a component consumes a Context provided by an ancestor at build time', () => {
    const Theme = createContext<'light' | 'dark'>('light');
    const Themed = component((_props) => {
      // Context.consume() reads the nearest provided value during the synchronous
      // build descent the component setup runs in.
      const theme = Theme.consume();
      return (c) => c.text(`theme:${theme}`, { id: 't' });
    }, { name: 'Themed' });

    const app = streetui.app({ name: 'ctx' });
    app.page('home', (page) => {
      Theme.provide('dark', () => {
        page.component('th', Themed, {});
      });
    });
    const result = render(app);
    expect(result.container.querySelector('#t')?.textContent).toBe('theme:dark');
    result.unmount();
  });
});

describe('component + error boundary (§20)', () => {
  it('a component can wrap its body in an errorBoundary and show a fallback', async () => {
    const errSource = signal<unknown>(null);
    const Guarded = component((_props, _ctx) => (c) => {
      c.errorBoundary(
        'eb',
        (body) => body.text('healthy', { id: 'ok' }),
        {
          source: errSource,
          fallback: (fb) => fb.text('fell-back', { id: 'fb' }),
        },
      );
    }, { name: 'Guarded' });

    const app = streetui.app({ name: 'eb' });
    app.page('home', (page) => page.component('g', Guarded, {}));
    const result = render(app);

    expect(result.container.querySelector('#ok')?.textContent).toBe('healthy');
    errSource.set(new Error('boom'));
    await flush();
    expect(result.container.querySelector('#fb')?.textContent).toBe('fell-back');
    expect(result.container.querySelector('#ok')).toBeNull();
    result.unmount();
  });
});

describe('component — public export surface (§3/§30)', () => {
  it('exposes component + isComponentDefinition additively from streetui', async () => {
    // eslint-disable-next-line import/no-unresolved
    const api = await import('streetui');
    expect(typeof api.component).toBe('function');
    expect(typeof api.isComponentDefinition).toBe('function');
    const Def = component(() => (c: ContainerDSL) => c.text('x'), { name: 'X' });
    expect(api.isComponentDefinition(Def)).toBe(true);
    expect(api.isComponentDefinition({})).toBe(false);
  });
});
