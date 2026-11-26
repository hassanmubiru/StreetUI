/**
 * M12.5 — Representative public API experience tests for external TypeScript
 * developers: signals, DSL compile/render, components, resources, forms, and
 * styling. These intentionally use only the public `streetui` barrel (plus the
 * documented `streetui/server` subpath), not internal modules.
 */
import { describe, it, expect } from 'vitest';
import {
  streetui, compile, signal, derived, effect, batch, component, resource,
  createForm, required, email, minLength, style, cx,
} from './index.js';
import { renderToString } from './server.js';

describe('public API experience (M12.5)', () => {
  it('signals support derived values, effects, and batched updates', () => {
    const count = signal(1);
    const doubled = derived(() => count.get() * 2);
    const seen: number[] = [];
    const dispose = effect(() => {
      seen.push(doubled.get());
    });
    batch(() => {
      count.set(2);
      count.set(3);
    });
    dispose();
    expect(doubled.get()).toBe(6);
    expect(seen.at(-1)).toBe(6);
    expect(seen.length).toBeLessThanOrEqual(3);
  });

  it('DSL compile + SSR render produces semantic HTML with ids', () => {
    const app = streetui.app({ name: 'ApiCheck' });
    app.page('home', (page) => {
      page.heading('Hello API', { id: 'title', level: 1 });
      page.button('Click me', { id: 'cta', onClick: () => undefined });
      page.text('Plain text', { id: 'note' });
    });
    const html = renderToString(compile(app));
    expect(html).toContain('id="title"');
    expect(html).toContain('Hello API');
    expect(html).toContain('id="cta"');
    expect(html).toContain('Plain text');
  });

  it('components mount with typed props and reactive text', () => {
    const Card = component<{ title: ReturnType<typeof signal<string>> }>(
      (props) => (scope) => {
        scope.heading(props.title, { level: 2 });
        scope.text('Body content');
      },
      { name: 'Card' },
    );
    const app = streetui.app({ name: 'ComponentCheck' });
    app.page('home', (page) => {
      page.component('card-1', Card, { title: signal('Typed title') });
    });
    const html = renderToString(compile(app));
    expect(html).toContain('Typed title');
    expect(html).toContain('Body content');
    expect(html).toContain('data-streetui-component="Card"');
  });

  it('resources expose loading and data states for SSR branches', async () => {
    const users = resource<string[]>(({ signal: abort }) => {
      expect(typeof abort.aborted).toBe('boolean');
      return Promise.resolve(['ada', 'grace']);
    });
    expect(users.loading.get()).toBe(true);
    await users.refetch();
    expect(users.data.get()).toEqual(['ada', 'grace']);
    expect(users.loading.get()).toBe(false);
    expect(users.error.get()).toBeUndefined();
  });

  it('createForm validates and submits with real validators', async () => {
    const form = createForm<{ email: string; password: string }>({
      initialValues: { email: '', password: '' },
      validators: {
        email: [required(), email()],
        password: [required(), minLength(8)],
      },
      onSubmit: async (values) => values,
    });
    await form.submit();
    expect(form.errors.get().email).toBeDefined();
    expect(form.errors.get().password).toBeDefined();

    form.field('email').value.set('dev@example.com');
    form.field('password').value.set('long-enough');
    await form.submit();
    expect(Object.keys(form.errors.get()).length).toBe(0);
  });

  it('style and cx produce deduped class tokens', () => {
    const a = style({ color: 'red' });
    const b = style({ display: 'flex' });
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(cx(a, b)).toBe(`${a} ${b}`);
  });
});
