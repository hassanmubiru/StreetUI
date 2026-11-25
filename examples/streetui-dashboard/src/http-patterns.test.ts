/**
 * Focused unit tests for the HTTP patterns the dashboard ships:
 * bounded read retries (429/5xx + Retry-After), write pass-through, the
 * server-only Bearer client, CRUD-and-refetch, abort-aware retry waits, and
 * multipart upload. A fake fetch keeps these hermetic.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createDashboardAuthSession,
  createDashboardUsersCrud,
  createReadRetryFetch,
  createServerDataSource,
  createServerHttpClient,
  DASHBOARD_API_TOKEN_ENV,
  uploadDashboardAttachment,
  type ReadRetryOptions,
} from './http-patterns.js';
import { HttpError, type FetchLike } from 'streetui';
import type { Page, User, UserQuery } from './data.js';

function jsonResponse(body: unknown, init: { status?: number; statusText?: string; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

const noWait: ReadRetryOptions['wait'] = async () => undefined;

const USERS: Page<User> = {
  items: [{ id: 'u-1', name: 'Ada', email: 'ada@example.com', role: 'admin', status: 'active', lastActive: '2026-11-01' }],
  total: 1,
  page: 1,
  pageSize: 8,
  pageCount: 1,
};

const QUERY: UserQuery = { query: '', role: 'all', page: 1, pageSize: 8 };

describe('createReadRetryFetch', () => {
  it('retries a 500 response and returns the eventual success', async () => {
    let calls = 0;
    const fetcher: FetchLike = async () => {
      calls += 1;
      return calls < 3 ? jsonResponse({}, { status: 500 }) : jsonResponse({ ok: true });
    };
    const retrying = createReadRetryFetch(fetcher, { maxAttempts: 3, wait: noWait });
    const res = await retrying('/overview');
    expect(calls).toBe(3);
    expect(res.status).toBe(200);
  });

  it('stops at maxAttempts and surfaces the last retryable response', async () => {
    let calls = 0;
    const fetcher: FetchLike = async () => {
      calls += 1;
      return jsonResponse({}, { status: 429 });
    };
    const retrying = createReadRetryFetch(fetcher, { maxAttempts: 2, wait: noWait });
    const res = await retrying('/overview');
    expect(calls).toBe(2);
    expect(res.status).toBe(429);
  });

  it('honours Retry-After seconds for the backoff delay', async () => {
    const delays: number[] = [];
    let calls = 0;
    const fetcher: FetchLike = async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({}, { status: 429, headers: { 'retry-after': '2' } })
        : jsonResponse({ ok: true });
    };
    const retrying = createReadRetryFetch(fetcher, {
      maxAttempts: 2,
      baseDelayMs: 100,
      wait: async (ms) => {
        delays.push(ms);
      },
    });
    await retrying('/overview');
    expect(delays).toEqual([2000]);
  });

  it('falls back to exponential backoff when Retry-After is absent or invalid', async () => {
    const delays: number[] = [];
    let calls = 0;
    const fetcher: FetchLike = async () => {
      calls += 1;
      return calls < 3 ? jsonResponse({}, { status: 503, headers: { 'retry-after': 'not-a-date' } }) : jsonResponse({ ok: true });
    };
    const retrying = createReadRetryFetch(fetcher, {
      maxAttempts: 3,
      baseDelayMs: 50,
      wait: async (ms) => {
        delays.push(ms);
      },
    });
    await retrying('/overview');
    expect(delays).toEqual([50, 100]);
  });

  it('never retries a write: a POST goes out exactly once', async () => {
    let calls = 0;
    const fetcher: FetchLike = async () => {
      calls += 1;
      return jsonResponse({}, { status: 500 });
    };
    const retrying = createReadRetryFetch(fetcher, { maxAttempts: 3, wait: noWait });
    const res = await retrying('/users', { method: 'POST', body: '{}' });
    expect(calls).toBe(1);
    expect(res.status).toBe(500);
  });

  it('does not retry a non-retryable status such as 404', async () => {
    let calls = 0;
    const fetcher: FetchLike = async () => {
      calls += 1;
      return jsonResponse({}, { status: 404 });
    };
    const retrying = createReadRetryFetch(fetcher, { maxAttempts: 3, wait: noWait });
    await retrying('/missing');
    expect(calls).toBe(1);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const fetcher = vi.fn<FetchLike>(async () => jsonResponse({}));
    const controller = new AbortController();
    controller.abort();
    const retrying = createReadRetryFetch(fetcher, { maxAttempts: 3, wait: noWait });
    await expect(retrying('/overview', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('aborts a pending retry delay', async () => {
    const controller = new AbortController();
    let calls = 0;
    const fetcher: FetchLike = async () => {
      calls += 1;
      return jsonResponse({}, { status: 503 });
    };
    const retrying = createReadRetryFetch(fetcher, { maxAttempts: 3, baseDelayMs: 60_000 });
    const pending = retrying('/overview', { signal: controller.signal });
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toBe(1);
  });

  it('validates its options', () => {
    const fetcher: FetchLike = async () => jsonResponse({});
    expect(() => createReadRetryFetch(fetcher, { maxAttempts: 0 })).toThrow(RangeError);
    expect(() => createReadRetryFetch(fetcher, { baseDelayMs: -1 })).toThrow(RangeError);
  });
});

describe('createServerHttpClient', () => {
  it('injects the Bearer token as a server-side header and never in the URL', async () => {
    const seen: Array<[string, RequestInit | undefined]> = [];
    const fetcher: FetchLike = async (url, init) => {
      seen.push([url, init]);
      return jsonResponse(USERS);
    };
    const api = createServerHttpClient({ baseUrl: 'https://api.test', bearerToken: 'server-secret', fetch: fetcher });
    await api.get('/users');
    expect(seen[0]?.[0]).toBe('https://api.test/users');
    const headers = seen[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer server-secret');
  });

  it('omits Authorization when no token is configured', async () => {
    const seen: Array<RequestInit | undefined> = [];
    const fetcher: FetchLike = async (_url, init) => {
      seen.push(init);
      return jsonResponse(USERS);
    };
    const api = createServerHttpClient({ baseUrl: 'https://api.test', fetch: fetcher });
    await api.get('/users');
    const headers = (seen[0]?.headers ?? {}) as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('createServerDataSource', () => {
  it('uses the mock source when no public base URL is configured', () => {
    const source = createServerDataSource({});
    expect(source).toBeDefined();
    // The mock source is local: no network dependency to assert on.
  });

  it('reads the server-only token from a non-public env var', () => {
    expect(DASHBOARD_API_TOKEN_ENV.startsWith('STREETUI_PUBLIC_')).toBe(false);
  });

  it('builds an HTTP source that sends the token when both env vars are set', async () => {
    const originalFetch = globalThis.fetch;
    const seen: Array<Record<string, string>> = [];
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      seen.push((init?.headers ?? {}) as Record<string, string>);
      return jsonResponse(USERS);
    }) as typeof fetch;
    try {
      const source = createServerDataSource({
        STREETUI_PUBLIC_DASHBOARD_API_URL: 'https://api.test',
        [DASHBOARD_API_TOKEN_ENV]: '  server-secret  ',
      });
      await source.fetchUsers(QUERY);
      expect(seen[0]?.['Authorization']).toBe('Bearer server-secret');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('createDashboardUsersCrud', () => {
  it('refetches the list after a successful create', async () => {
    const calls: string[] = [];
    let items: User[] = [];
    const fetcher: FetchLike = async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (init?.method === 'POST') {
        items = [...items, USERS.items[0]!];
        return jsonResponse(items[0]);
      }
      return jsonResponse({ ...USERS, items, total: items.length, pageCount: 1 });
    };
    const api = createServerHttpClient({ baseUrl: 'https://api.test', fetch: fetcher });
    const crud = createDashboardUsersCrud(api, QUERY);
    await crud.list.refetch();
    expect(crud.list.data.get()?.total).toBe(0);

    await crud.create.mutate({ name: 'Ada', email: 'ada@example.com', role: 'admin', status: 'active' });
    expect(crud.list.data.get()?.total).toBe(1);
    expect(calls).toEqual(['GET https://api.test/users?query=&role=all&page=1&pageSize=8', 'POST https://api.test/users', 'GET https://api.test/users?query=&role=all&page=1&pageSize=8']);
    crud.dispose();
  });
});

describe('createDashboardAuthSession', () => {
  it('becomes authenticated when /session returns a user', async () => {
    const fetcher: FetchLike = async () => jsonResponse({ id: 'u-1', name: 'Ada', email: 'ada@example.com' });
    const api = createServerHttpClient({ baseUrl: 'https://api.test', fetch: fetcher });
    const session = createDashboardAuthSession(api);
    await session.refresh();
    expect(session.status.get()).toBe('authenticated');
    expect(session.user.get()?.name).toBe('Ada');
    session.dispose();
  });

  it('becomes unauthenticated when /session returns null', async () => {
    const fetcher: FetchLike = async () => jsonResponse(null);
    const api = createServerHttpClient({ baseUrl: 'https://api.test', fetch: fetcher });
    const session = createDashboardAuthSession(api);
    await session.refresh();
    expect(session.status.get()).toBe('unauthenticated');
    session.dispose();
  });
});

describe('uploadDashboardAttachment', () => {
  it('posts multipart FormData and parses the JSON receipt', async () => {
    let seenInit: RequestInit | undefined;
    const fetcher: FetchLike = async (_url, init) => {
      seenInit = init;
      return jsonResponse({ id: 'f-1', name: 'report.csv', size: 12 });
    };
    const receipt = await uploadDashboardAttachment({
      url: 'https://api.test/uploads',
      file: new Blob(['a,b,c\n1,2,3'], { type: 'text/csv' }),
      filename: 'report.csv',
      fetch: fetcher,
    });
    expect(receipt).toEqual({ id: 'f-1', name: 'report.csv', size: 12 });
    expect(seenInit?.method).toBe('POST');
    expect(seenInit?.body).toBeInstanceOf(FormData);
    const headers = (seenInit?.headers ?? {}) as Record<string, string>;
    // The boundary must come from FormData, never a manual Content-Type.
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('rejects a malformed receipt with a clear error', async () => {
    const fetcher: FetchLike = async () => jsonResponse({ unexpected: true });
    await expect(
      uploadDashboardAttachment({
        url: 'https://api.test/uploads',
        file: new Blob(['x']),
        filename: 'x.txt',
        fetch: fetcher,
      }),
    ).rejects.toThrow(/invalid JSON receipt/);
  });

  it('throws a typed HttpError on a non-2xx upload', async () => {
    const fetcher: FetchLike = async () => jsonResponse({ message: 'too large' }, { status: 413, statusText: 'Payload Too Large' });
    const error = await uploadDashboardAttachment({
      url: 'https://api.test/uploads',
      file: new Blob(['x']),
      filename: 'x.txt',
      fetch: fetcher,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error instanceof HttpError && error.status).toBe(413);
  });
});
