/**
 * HTTP data source + resource reliability tests.
 *
 * These exercise the production integration path (`createHttpDataSource`) and
 * the reliability guarantees the dashboard depends on: abort propagation,
 * superseded responses never overwriting newer data, error surfacing, retry,
 * and loading/refetching transitions.
 */
import { describe, it, expect, vi } from 'vitest';
import { createClient, type Client, type FetchLike } from 'streetui';
import { createHttpDataSource, configuredApiUrl, isHttpError, API_URL_ENV } from './http-data.js';
import { createMockDataSource, type OverviewData, type Page, type User } from './data.js';
import { createState } from './state.js';

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}): Response {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    statusText: init.statusText ?? 'OK',
    headers: { 'content-type': 'application/json' },
  });
}

function clientWith(fetcher: FetchLike): Client {
  return createClient({ baseUrl: 'https://api.test', fetch: fetcher });
}

const OVERVIEW: OverviewData = {
  metrics: [{ id: 'm-users', label: 'Total users', value: 2, delta: '+1' }],
  activity: [{ id: 'a-1', text: 'Someone did something', at: '1m ago' }],
};

/** Wait for a resource's automatic initial load to settle (createState auto-loads). */
async function settled(resource: { status: { get(): string } }): Promise<void> {
  for (let i = 0; i < 100 && resource.status.get() === 'loading'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const USERS_PAGE: Page<User> = {
  items: [
    { id: 'u-1', name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin', status: 'active', lastActive: '2026-11-01' },
  ],
  total: 1,
  page: 1,
  pageSize: 8,
  pageCount: 1,
};

describe('configuredApiUrl', () => {
  it('is undefined for missing, empty, and whitespace values', () => {
    expect(configuredApiUrl({})).toBeUndefined();
    expect(configuredApiUrl({ [API_URL_ENV]: '' })).toBeUndefined();
    expect(configuredApiUrl({ [API_URL_ENV]: '   ' })).toBeUndefined();
  });

  it('returns the trimmed base URL when configured', () => {
    expect(configuredApiUrl({ [API_URL_ENV]: ' https://api.example.com ' })).toBe('https://api.example.com');
  });
});

describe('createHttpDataSource — requests', () => {
  it('maps each method to its endpoint, query string, and JSON shape', async () => {
    const calls: string[] = [];
    const source = createHttpDataSource({
      baseUrl: 'https://api.test',
      client: clientWith(async (url) => {
        calls.push(url);
        if (url.includes('/overview')) return jsonResponse(OVERVIEW);
        if (url.includes('/users')) return jsonResponse(USERS_PAGE);
        return jsonResponse([]);
      }),
    });

    await expect(source.fetchOverview()).resolves.toEqual(OVERVIEW);
    await expect(source.fetchUsers({ query: 'ada', role: 'admin', page: 2, pageSize: 8 })).resolves.toEqual(USERS_PAGE);
    await expect(source.fetchProjects('at-risk')).resolves.toEqual([]);

    expect(calls[0]).toBe('https://api.test/overview');
    expect(calls[1]).toContain('/users?');
    expect(calls[1]).toContain('query=ada');
    expect(calls[1]).toContain('role=admin');
    expect(calls[1]).toContain('page=2');
    expect(calls[1]).toContain('pageSize=8');
    expect(calls[2]).toBe('https://api.test/projects?status=at-risk');
  });

  it('forwards the abort signal to fetch', async () => {
    let seen: AbortSignal | undefined;
    const source = createHttpDataSource({
      baseUrl: 'https://api.test',
      client: clientWith(async (_url, init) => {
        seen = init?.signal ?? undefined;
        return jsonResponse(OVERVIEW);
      }),
    });
    const controller = new AbortController();
    await source.fetchOverview({ signal: controller.signal });
    expect(seen).toBe(controller.signal);
  });

  it('surfaces non-2xx responses as a typed HttpError', async () => {
    const source = createHttpDataSource({
      baseUrl: 'https://api.test',
      client: clientWith(async () => jsonResponse({ message: 'nope' }, { status: 503, statusText: 'Unavailable' })),
    });
    const error = await source.fetchOverview().catch((e: unknown) => e);
    expect(isHttpError(error)).toBe(true);
    expect(isHttpError(error) && error.status).toBe(503);
  });

  it('rejects malformed payloads with a descriptive error instead of a TypeError', async () => {
    const source = createHttpDataSource({
      baseUrl: 'https://api.test',
      client: clientWith(async () => jsonResponse({ unexpected: true })),
    });
    await expect(source.fetchOverview()).rejects.toThrow(/invalid response from \/overview/);

    const badUsers = createHttpDataSource({
      baseUrl: 'https://api.test',
      client: clientWith(async () => jsonResponse([{ id: 'u-1' }])),
    });
    await expect(badUsers.fetchUsers({ query: '', role: 'all', page: 1, pageSize: 8 })).rejects.toThrow(
      /invalid response from \/users/,
    );

    const badProjects = createHttpDataSource({
      baseUrl: 'https://api.test',
      client: clientWith(async () => jsonResponse({ items: [] })),
    });
    await expect(badProjects.fetchProjects('all')).rejects.toThrow(/invalid response from \/projects/);
  });
});

describe('mock data source — abort semantics', () => {
  it('rejects with an AbortError when the signal fires mid-request', async () => {
    const source = createMockDataSource();
    const controller = new AbortController();
    const pending = source.fetchUsers({ query: '', role: 'all', page: 1, pageSize: 8 }, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const source = createMockDataSource();
    const controller = new AbortController();
    controller.abort();
    await expect(source.fetchOverview({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('resources — reliability through the data source', () => {
  it('reaches success and exposes loading then settled state', async () => {
    const state = createState({ view: 'overview' });
    expect(state.overview.status.get()).toBe('loading');
    await state.overview.refetch();
    expect(state.overview.status.get()).toBe('success');
    expect(state.overview.error.get()).toBeUndefined();
    expect(state.overview.data.get()?.metrics.length).toBeGreaterThan(0);
  });

  it('surfaces an error and recovers on retry', async () => {
    let attempt = 0;
    const source = {
      ...createMockDataSource(),
      fetchOverview: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('network down');
        return OVERVIEW;
      },
    };
    const state = createState({ view: 'overview' }, source);
    // createState auto-loads; the first attempt is the failing one.
    await settled(state.overview);
    expect(state.overview.status.get()).toBe('error');
    expect(String(state.overview.error.get())).toContain('network down');

    await state.overview.refetch();
    expect(state.overview.status.get()).toBe('success');
    expect(state.overview.error.get()).toBeUndefined();
  });

  it('keeps previous data visible while refetching', async () => {
    const state = createState({ view: 'users' });
    await state.users.refetch();
    const first = state.users.data.get();
    expect(first).toBeDefined();

    const pending = state.users.refetch();
    expect(state.users.status.get()).toBe('loading');
    expect(state.users.isRefetching.get()).toBe(true);
    expect(state.users.data.get()).toBe(first);
    await pending;
    expect(state.users.isRefetching.get()).toBe(false);
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    let release: (() => void) | undefined;
    let call = 0;
    const source = {
      ...createMockDataSource(),
      fetchOverview: async () => {
        call += 1;
        if (call === 1) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return { metrics: [], activity: [] };
        }
        return OVERVIEW;
      },
    };
    const state = createState({ view: 'overview' }, source);

    const stale = state.overview.refetch();
    const fresh = state.overview.refetch();
    await fresh;
    expect(state.overview.data.get()).toEqual(OVERVIEW);

    release?.();
    await stale;
    expect(state.overview.data.get()).toEqual(OVERVIEW);
  });

  it('aborts in-flight work when disposed', async () => {
    const seen: AbortSignal[] = [];
    const source = {
      ...createMockDataSource(),
      fetchProjects: async (_status: string, options?: { signal?: AbortSignal }) => {
        if (options?.signal !== undefined) seen.push(options.signal);
        return new Promise<never>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      },
    };
    const state = createState({ view: 'projects' }, source);
    await Promise.resolve();
    expect(seen.length).toBeGreaterThan(0);
    state.projects.dispose();
    expect(seen[0]?.aborted).toBe(true);
  });

  it('uses an injected HTTP client end to end', async () => {
    const urls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes('/overview')) return jsonResponse(OVERVIEW);
      if (url.includes('/users')) return jsonResponse(USERS_PAGE);
      return jsonResponse([]);
    });
    const state = createState({ view: 'overview' }, createHttpDataSource({ baseUrl: 'https://api.test', client: clientWith(fetcher) }));
    await settled(state.overview);
    await Promise.all([state.overview.refetch(), state.users.refetch(), state.projects.refetch()]);
    expect(state.overview.data.get()).toEqual(OVERVIEW);
    expect(state.users.data.get()).toEqual(USERS_PAGE);
    expect(state.projects.data.get()).toEqual([]);
    for (const path of ['/overview', '/users', '/projects']) {
      expect(urls.some((url) => url.includes(path))).toBe(true);
    }
  });
});
