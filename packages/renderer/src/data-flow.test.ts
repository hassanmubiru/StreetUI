/**
 * Data-flow integration (2.0 §18): the full write path a real app uses —
 * `createForm` → `mutation` (the request) → `onSuccess` invalidation via a
 * `resource.refetch()` → reactive UI update — exercised end-to-end through the
 * pipeline (DSL → compiler → graph → renderer → DOM).
 *
 * This proves the pieces compose with NO second data system and NO global cache:
 * invalidation is explicit and local (the mutation says which read it refreshes),
 * and the UI updates purely through the existing reactive text binding. A second
 * case drives the same flow through the optional HTTP `createClient` with an
 * injected fetch, showing the StreetJS/HTTP integration path (§17) end-to-end.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui, type ContainerDSL } from '@streetui/dsl';
import { derived, resource, mutation, createClient } from '@streetui/state';
import { createForm, required } from '@streetui/forms';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';

beforeEach(() => resetIdCounter());

const txt = (el: Element | null) => el?.textContent?.trim() ?? '';
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function mountApp(build: (page: ContainerDSL) => void) {
  resetIdCounter();
  const app = streetui.app({ name: 'test' });
  app.page('home', (p) => build(p));
  const compiled = compile(app);
  const container = document.createElement('div');
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  renderer.mount(compiled, container);
  return { container };
}

describe('form → mutation → invalidate → UI (§18)', () => {
  it('submitting a form runs a mutation whose onSuccess refetches a resource, updating the UI', async () => {
    const server: string[] = [];
    const list = resource<string[]>(() => Promise.resolve([...server]), { immediate: false });
    await list.refetch();

    const addItem = mutation<string, void>(
      (name) => {
        server.push(name);
      },
      { onSuccess: () => list.refetch() },
    );

    const form = createForm<{ name: string }>({
      initialValues: { name: '' },
      validators: { name: required('Name is required') },
      onSubmit: (values) => addItem.mutate(values.name),
    });

    const count = derived(() => `count: ${list.data.get()?.length ?? 0}`);
    const { container } = mountApp((p) => {
      p.text(count, { id: 'count' });
      p.text(addItem.pending, { id: 'pending' });
    });

    expect(txt(container.querySelector('#count'))).toBe('count: 0');

    form.field('name').setValue('apple');
    await form.submit();
    await tick();

    expect(server).toEqual(['apple']);
    expect(txt(container.querySelector('#count'))).toBe('count: 1');

    // A second submit invalidates again → UI grows.
    form.field('name').setValue('banana');
    await form.submit();
    await tick();
    expect(txt(container.querySelector('#count'))).toBe('count: 2');
  });

  it('blocks the mutation when the form is invalid (no request is made)', async () => {
    const mutate = vi.fn(async () => void 0);
    const m = mutation<string, void>(mutate);
    const form = createForm<{ name: string }>({
      initialValues: { name: '' },
      validators: { name: required('required') },
      onSubmit: (v) => m.mutate(v.name),
    });

    await form.submit(); // name empty → invalid
    expect(mutate).not.toHaveBeenCalled();
    expect(m.status.get()).toBe('idle');
    expect(form.field('name').error.get()).toBe('required');
  });

  it('drives the same flow through the optional HTTP client (§17)', async () => {
    const store: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        store.push(JSON.parse(String(init.body)).name);
        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([...store]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const api = createClient({ baseUrl: '/api', fetch: fetchMock });
    const list = api.resource<string[]>('/items', { immediate: false });
    await list.refetch();

    const add = api.mutation<{ name: string }, { ok: boolean }>('POST', '/items', {
      onSuccess: () => list.refetch(),
    });

    const count = derived(() => `n=${list.data.get()?.length ?? 0}`);
    const { container } = mountApp((p) => p.text(count, { id: 'n' }));
    expect(txt(container.querySelector('#n'))).toBe('n=0');

    await add.mutate({ name: 'apple' });
    await tick();
    expect(store).toEqual(['apple']);
    expect(txt(container.querySelector('#n'))).toBe('n=1');
  });
});
