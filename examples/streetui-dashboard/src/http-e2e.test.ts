/**
 * @vitest-environment node
 *
 * End-to-end test of the real HTTP integration path over a live Node socket: a
 * test-only `node:http` server exposes the dashboard endpoints, retry/auth/CRUD/
 * multipart semantics, and `STREETUI_PUBLIC_DASHBOARD_API_URL` selects the HTTP
 * data source so the SSR entry renders real server data (not the mock).
 *
 * Dummy tokens only. Every server and socket is closed in teardown.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { API_URL_ENV } from './http-data.js';
import {
  createDashboardAuthSession,
  createDashboardUsersCrud,
  createServerDataSource,
  createServerHttpClient,
  DASHBOARD_API_TOKEN_ENV,
  uploadDashboardAttachment,
} from './http-patterns.js';
import type { OverviewData, Page, Project, User } from './data.js';

const TOKEN = 'test-token-not-a-secret';

const OVERVIEW: OverviewData = {
  metrics: [{ id: 'm-live', label: 'Live users', value: 4210, delta: 'from the real API' }],
  activity: [{ id: 'a-live', text: 'Deployed through a real HTTP API', at: 'just now' }],
};

const BASE_USER: User = {
  id: 'u-live',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'owner',
  status: 'active',
  lastActive: '2026-11-20',
};

const PROJECTS: readonly Project[] = [
  { id: 'p-live', name: 'Live migration', owner: 'Grace Hopper', status: 'on-track', progress: 88 },
];

interface RequestLog {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: IncomingMessage['headers'];
  readonly body: string;
}

interface TestServer {
  readonly server: Server;
  readonly baseUrl: string;
  readonly requests: RequestLog[];
  /** Reset per-scenario counters and fixtures. */
  reset(): void;
  /** Number of requests received for a path. */
  hits(path: string): number;
  /** Failures remaining for a path (429/500 responses) before succeeding. */
  failNext(path: string, count: number, status: number, headers?: Record<string, string>): void;
  /** Delay every response, for cancellation tests. */
  setDelay(ms: number): void;
}

async function startServer(): Promise<TestServer> {
  const requests: RequestLog[] = [];
  const failures = new Map<string, Array<{ status: number; headers?: Record<string, string> }>>();
  let users: User[] = [{ ...BASE_USER }];
  let unauthorized = false;
  let delayMs = 0;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks).toString('utf8');
      requests.push({ method: req.method ?? 'GET', path: url.pathname, query: url.searchParams, headers: req.headers, body });

      const send = (status: number, payload: unknown, headers: Record<string, string> = {}): void => {
        res.writeHead(status, { 'content-type': 'application/json', ...headers });
        res.end(JSON.stringify(payload));
      };

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (res.destroyed) return;
      }

      if (url.pathname === '/auth/required') {
        if (req.headers.authorization !== `Bearer ${TOKEN}`) {
          send(401, { message: 'unauthorized' });
          return;
        }
        send(200, { ok: true });
        return;
      }

      const pendingFailures = failures.get(url.pathname);
      if (pendingFailures !== undefined && pendingFailures.length > 0) {
        const failure = pendingFailures.shift()!;
        send(failure.status, { message: 'transient' }, failure.headers ?? {});
        return;
      }

      if (url.pathname === '/overview') {
        send(200, OVERVIEW);
        return;
      }
      if (url.pathname === '/users' && (req.method ?? 'GET') === 'GET') {
        const q = url.searchParams.get('query') ?? '';
        const role = url.searchParams.get('role') ?? 'all';
        const page = Number(url.searchParams.get('page') ?? '1');
        const pageSize = Number(url.searchParams.get('pageSize') ?? '8');
        const filtered = users.filter(
          (u) => (q === '' || u.name.toLowerCase().includes(q.toLowerCase())) && (role === 'all' || u.role === role),
        );
        const start = (page - 1) * pageSize;
        const pageOf: Page<User> = {
          items: filtered.slice(start, start + pageSize),
          total: filtered.length,
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
        };
        send(200, pageOf);
        return;
      }
      if (url.pathname === '/users' && req.method === 'POST') {
        const created = JSON.parse(body) as Omit<User, 'id' | 'lastActive'>;
        const user: User = { ...created, id: `u-${String(users.length + 1)}`, lastActive: '2026-11-25' };
        users = [...users, user];
        send(201, user);
        return;
      }
      if (url.pathname === '/users' && req.method === 'PATCH') {
        const patch = JSON.parse(body) as { id: string; changes: Partial<User> };
        const found = users.find((u) => u.id === patch.id);
        if (found === undefined) {
          send(404, { message: 'user not found' });
          return;
        }
        const updated: User = { ...found, ...patch.changes };
        users = users.map((u) => (u.id === patch.id ? updated : u));
        send(200, updated);
        return;
      }
      if (url.pathname === '/users' && req.method === 'DELETE') {
        const { id } = JSON.parse(body) as { id: string };
        const found = users.find((u) => u.id === id);
        if (found === undefined) {
          send(404, { message: 'user not found' });
          return;
        }
        if (found.role === 'owner') {
          send(409, { message: 'cannot delete the owner' });
          return;
        }
        users = users.filter((u) => u.id !== id);
        send(200, { ok: true });
        return;
      }
      if (url.pathname === '/projects') {
        send(200, PROJECTS);
        return;
      }
      if (url.pathname === '/session') {
        send(200, unauthorized ? null : { id: 'u-live', name: 'Grace Hopper', email: 'grace@example.com' });
        return;
      }
      if (url.pathname === '/logout') {
        unauthorized = true;
        send(200, { ok: true });
        return;
      }
      if (url.pathname === '/uploads' && req.method === 'POST') {
        if (!(req.headers['content-type'] ?? '').startsWith('multipart/form-data')) {
          send(400, { message: 'expected multipart/form-data' });
          return;
        }
        send(200, { id: 'f-1', name: 'report.csv', size: body.length });
        return;
      }
      send(404, { message: 'not found' });
    })().catch((error: unknown) => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: String(error) }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;

  return {
    server,
    baseUrl,
    requests,
    reset() {
      requests.length = 0;
      failures.clear();
      users = [{ ...BASE_USER }];
      unauthorized = false;
      delayMs = 0;
    },
    hits(path) {
      return requests.filter((r) => r.path === path).length;
    },
    failNext(path, count, status, headers) {
      const list = failures.get(path) ?? [];
      for (let i = 0; i < count; i += 1) list.push({ status, ...(headers === undefined ? {} : { headers }) });
      failures.set(path, list);
    },
    setDelay(ms: number) {
      delayMs = ms;
    },
  };
}

let fixture: TestServer;

beforeAll(async () => {
  fixture = await startServer();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => fixture.server.close((err) => (err !== undefined ? reject(err) : resolve())));
});

describe('real HTTP integration — data source', () => {
  it('fetches every endpoint over a real socket', async () => {
    const { createHttpDataSource } = await import('./http-data.js');
    const source = createHttpDataSource({ baseUrl: fixture.baseUrl });
    await expect(source.fetchOverview()).resolves.toEqual(OVERVIEW);
    const users = await source.fetchUsers({ query: 'grace', role: 'owner', page: 1, pageSize: 8 });
    expect(users.items[0]?.name).toBe('Grace Hopper');
    await expect(source.fetchProjects('on-track')).resolves.toEqual(PROJECTS);
  });

  it('propagates a real 404 as a typed HttpError', async () => {
    const { createHttpDataSource, isHttpError } = await import('./http-data.js');
    const missing = await createHttpDataSource({ baseUrl: `${fixture.baseUrl}/nope` })
      .fetchOverview()
      .catch((e: unknown) => e);
    expect(isHttpError(missing)).toBe(true);
    expect(isHttpError(missing) && missing.status).toBe(404);
  });

  it('reflected query parameters reach the server', async () => {
    fixture.reset();
    const { createHttpDataSource } = await import('./http-data.js');
    const source = createHttpDataSource({ baseUrl: fixture.baseUrl });
    await source.fetchUsers({ query: 'ada', role: 'admin', page: 2, pageSize: 5 });
    const request = fixture.requests.find((r) => r.path === '/users');
    expect(request?.query.get('query')).toBe('ada');
    expect(request?.query.get('role')).toBe('admin');
    expect(request?.query.get('page')).toBe('2');
    expect(request?.query.get('pageSize')).toBe('5');
  });
});

describe('real HTTP integration — auth', () => {
  it('succeeds with the Bearer token and returns 401 without it', async () => {
    const authorized = createServerHttpClient({ baseUrl: fixture.baseUrl, bearerToken: TOKEN });
    const ok = await authorized.get<{ message?: string }>('/auth/required').catch((e: unknown) => e);
    expect(ok).not.toBeInstanceOf(Error);

    const anonymous = createServerHttpClient({ baseUrl: fixture.baseUrl });
    const denied = await anonymous.get('/auth/required').catch((e: unknown) => e);
    expect(denied).toBeInstanceOf(Error);
    expect((denied as { status?: number }).status).toBe(401);
  });

  it('drives the auth session to authenticated, then unauthenticated after logout', async () => {
    fixture.reset();
    const api = createServerHttpClient({ baseUrl: fixture.baseUrl, bearerToken: TOKEN });
    const session = createDashboardAuthSession(api);
    await session.refresh();
    expect(session.status.get()).toBe('authenticated');
    await session.logout();
    expect(session.status.get()).toBe('unauthenticated');
    session.dispose();
  });
});

describe('real HTTP integration — retries', () => {
  it('retries bounded 429s and then succeeds', async () => {
    fixture.reset();
    fixture.failNext('/overview', 2, 429, { 'retry-after': '0' });
    const api = createServerHttpClient({
      baseUrl: fixture.baseUrl,
      retry: { maxAttempts: 3, wait: async () => undefined },
    });
    const overview = await api.get<OverviewData>('/overview');
    expect(overview).toEqual(OVERVIEW);
    expect(fixture.hits('/overview')).toBe(3);
  });

  it('retries a 500 once and succeeds', async () => {
    fixture.reset();
    fixture.failNext('/overview', 1, 500);
    const api = createServerHttpClient({
      baseUrl: fixture.baseUrl,
      retry: { maxAttempts: 2, wait: async () => undefined },
    });
    await expect(api.get('/overview')).resolves.toEqual(OVERVIEW);
    expect(fixture.hits('/overview')).toBe(2);
  });

  it('gives up after maxAttempts and surfaces the last status', async () => {
    fixture.reset();
    fixture.failNext('/overview', 5, 503);
    const api = createServerHttpClient({
      baseUrl: fixture.baseUrl,
      retry: { maxAttempts: 2, wait: async () => undefined },
    });
    const error = await api.get('/overview').catch((e: unknown) => e);
    expect((error as { status?: number }).status).toBe(503);
    expect(fixture.hits('/overview')).toBe(2);
  });

  it('does not retry writes', async () => {
    fixture.reset();
    fixture.failNext('/users', 1, 500);
    const api = createServerHttpClient({
      baseUrl: fixture.baseUrl,
      retry: { maxAttempts: 3, wait: async () => undefined },
    });
    const error = await api.post('/users', { name: 'X', email: 'x@example.com', role: 'member', status: 'active' })
      .catch((e: unknown) => e);
    expect((error as { status?: number }).status).toBe(500);
    expect(fixture.hits('/users')).toBe(1);
  });
});

describe('real HTTP integration — cancellation', () => {
  it('aborts a delayed request and stops waiting', async () => {
    fixture.reset();
    fixture.setDelay(1500);
    const api = createServerHttpClient({ baseUrl: fixture.baseUrl });
    const controller = new AbortController();
    const pending = api.get('/overview', { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    const started = Date.now();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('real HTTP integration — CRUD', () => {
  it('creates, patches, and deletes a user, refetching the list each time', async () => {
    fixture.reset();
    const api = createServerHttpClient({ baseUrl: fixture.baseUrl });
    const crud = createDashboardUsersCrud(api, { query: '', role: 'all', page: 1, pageSize: 8 });
    await crud.list.refetch();
    expect(crud.list.data.get()?.total).toBe(1);

    const created = await crud.create.mutate({ name: 'Ada', email: 'ada@example.com', role: 'admin', status: 'active' });
    expect(created.name).toBe('Ada');
    expect(crud.list.data.get()?.total).toBe(2);

    const updated = await crud.update.mutate({ id: created.id, changes: { name: 'Ada Lovelace' } });
    expect(updated.name).toBe('Ada Lovelace');
    expect(crud.list.data.get()?.items.some((u) => u.name === 'Ada Lovelace')).toBe(true);

    await crud.remove.mutate({ id: created.id });
    expect(crud.list.data.get()?.total).toBe(1);
    crud.dispose();
  });

  it('maps a missing user to a 404 and an owner delete to a 409', async () => {
    fixture.reset();
    const api = createServerHttpClient({ baseUrl: fixture.baseUrl });
    const crud = createDashboardUsersCrud(api, { query: '', role: 'all', page: 1, pageSize: 8 });
    const notFound = await crud.update.mutate({ id: 'u-missing', changes: { name: 'X' } }).catch((e: unknown) => e);
    expect((notFound as { status?: number }).status).toBe(404);
    // The write failed, so the failure lives on the mutation (the list was never refetched).
    expect(crud.update.status.get()).toBe('error');
    expect(crud.list.status.get()).toBe('idle');

    const conflict = await crud.remove.mutate({ id: 'u-live' }).catch((e: unknown) => e);
    expect((conflict as { status?: number }).status).toBe(409);
    crud.dispose();
  });
});

describe('real HTTP integration — upload', () => {
  it('posts a real multipart body and parses the receipt', async () => {
    fixture.reset();
    const receipt = await uploadDashboardAttachment({
      url: `${fixture.baseUrl}/uploads`,
      file: new Blob(['a,b,c\n1,2,3'], { type: 'text/csv' }),
      filename: 'report.csv',
    });
    expect(receipt.name).toBe('report.csv');
    const request = fixture.requests.find((r) => r.path === '/uploads');
    expect(request?.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  });
});

describe('real HTTP integration — SSR', () => {
  it('renders SSR markup from the live API when the env var is set', async () => {
    const previous = process.env[API_URL_ENV];
    process.env[API_URL_ENV] = fixture.baseUrl;
    try {
      const { render } = await import('./server.js');
      const result = await render({ url: '/' });
      expect(result.html).toContain('Live users');
      expect(result.html).toContain('4210');
      expect(result.html).toContain('Deployed through a real HTTP API');
    } finally {
      if (previous === undefined) delete process.env[API_URL_ENV];
      else process.env[API_URL_ENV] = previous;
    }
  });

  it('renders users and projects from the live API', async () => {
    const previous = process.env[API_URL_ENV];
    process.env[API_URL_ENV] = fixture.baseUrl;
    try {
      const { render } = await import('./server.js');
      const users = await render({ url: '/users' });
      expect(users.html).toContain('Grace Hopper');
      expect(users.html).toContain('of 1 users');

      const projects = await render({ url: '/projects' });
      expect(projects.html).toContain('Live migration');
      expect(projects.html).toContain('Progress: 88%');
    } finally {
      if (previous === undefined) delete process.env[API_URL_ENV];
      else process.env[API_URL_ENV] = previous;
    }
  });

  it('injects the server-only token during SSR and never serializes it', async () => {
    fixture.reset();
    const previousUrl = process.env[API_URL_ENV];
    const previousToken = process.env[DASHBOARD_API_TOKEN_ENV];
    process.env[API_URL_ENV] = fixture.baseUrl;
    process.env[DASHBOARD_API_TOKEN_ENV] = TOKEN;
    try {
      const { render } = await import('./server.js');
      const result = await render({ url: '/auth/required' });
      // The protected endpoint was reached (200 content rendered, not a 401 error page).
      expect(result.html).not.toContain('unauthorized');
      expect(result.html).not.toContain(TOKEN);
      expect(result.html).not.toContain('Bearer');
    } finally {
      if (previousUrl === undefined) delete process.env[API_URL_ENV];
      else process.env[API_URL_ENV] = previousUrl;
      if (previousToken === undefined) delete process.env[DASHBOARD_API_TOKEN_ENV];
      else process.env[DASHBOARD_API_TOKEN_ENV] = previousToken;
    }
  });

  it('falls back to the mock source when the env var is unset', async () => {
    const previous = process.env[API_URL_ENV];
    delete process.env[API_URL_ENV];
    try {
      const { render } = await import('./server.js');
      const result = await render({ url: '/' });
      expect(result.html).toContain('Total users');
      expect(result.html).toContain('Billing migration');
    } finally {
      if (previous !== undefined) process.env[API_URL_ENV] = previous;
    }
  });
});

describe('createServerDataSource', () => {
  it('returns the mock source when unconfigured and an HTTP source when configured', async () => {
    const mock = createServerDataSource({});
    await expect(mock.fetchOverview()).resolves.toBeDefined();

    const http = createServerDataSource({
      [API_URL_ENV]: fixture.baseUrl,
      [DASHBOARD_API_TOKEN_ENV]: TOKEN,
    });
    await expect(http.fetchOverview()).resolves.toEqual(OVERVIEW);
  });
});
