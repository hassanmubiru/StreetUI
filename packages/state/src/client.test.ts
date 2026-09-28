/**
 * Tests for the optional HTTP data client (§17). A fake `fetch` is injected so
 * these run with no network and no global fetch dependency. They prove URL
 * joining, JSON handling, header merging, abort propagation, error typing, and
 * that the client composes with `resource`/`mutation`.
 */
import { describe, it, expect, vi } from 'vitest';
import { createClient, HttpError } from './client.js';

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}): Response {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    statusText: init.statusText ?? 'OK',
    headers: { 'content-type': 'application/json' },
  });
}

describe('createClient — requests', () => {
  it('joins baseUrl + path, sets JSON headers on a body, and parses JSON back', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ id: 1, name: 'Ada' }));
    const api = createClient({ baseUrl: '/api', headers: { Authorization: 'Bearer t' }, fetch: fetchMock });

    const created = await api.post<{ id: number; name: string }>('/users', { name: 'Ada' });
    expect(created).toEqual({ id: 1, name: 'Ada' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/users');
    expect(init!.method).toBe('POST');
    const headers = init!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer t');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init!.body).toBe(JSON.stringify({ name: 'Ada' }));
  });

  it('appends query params and forwards the abort signal', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([{ id: 1 }]));
    const api = createClient({ baseUrl: 'https://x/api', fetch: fetchMock });
    const ctrl = new AbortController();
    await api.get('/users', { query: { page: 2, active: true }, signal: ctrl.signal });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://x/api/users?page=2&active=true');
    expect(init!.signal).toBe(ctrl.signal);
  });

  it('throws a typed HttpError carrying status and parsed body on non-2xx', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'nope' }, { status: 403, statusText: 'Forbidden' }));
    const api = createClient({ fetch: fetchMock });
    await expect(api.get('/secret')).rejects.toBeInstanceOf(HttpError);
    try {
      await api.get('/secret');
    } catch (e) {
      const err = e as HttpError;
      expect(err.status).toBe(403);
      expect(err.body).toEqual({ message: 'nope' });
    }
  });
});

describe('createClient — resource/mutation composition', () => {
  it('resource() loads via GET and refetches on demand', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => jsonResponse({ n: ++n }));
    const api = createClient({ fetch: fetchMock });
    const r = api.resource<{ n: number }>('/counter', { immediate: false });
    await r.refetch();
    expect(r.data.get()).toEqual({ n: 1 });
    await r.refetch();
    expect(r.data.get()).toEqual({ n: 2 });
  });

  it('mutation() posts the argument and invalidates a resource via onSuccess', async () => {
    const store: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        store.push(JSON.parse(String(init.body)).item);
        return jsonResponse({ ok: true });
      }
      return jsonResponse([...store]);
    });
    const api = createClient({ fetch: fetchMock });
    const list = api.resource<string[]>('/items');
    await list.refetch();
    expect(list.data.get()).toEqual([]);

    const add = api.mutation<{ item: string }, { ok: boolean }>('POST', '/items', {
      onSuccess: () => list.refetch(),
    });
    await add.mutate({ item: 'apple' });
    expect(list.data.get()).toEqual(['apple']);
  });
});
