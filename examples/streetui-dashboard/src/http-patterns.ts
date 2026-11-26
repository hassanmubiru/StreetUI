/**
 * Focused HTTP integration patterns for the dashboard reference app.
 *
 * These functions compose StreetUI's existing client/resource/mutation/auth
 * primitives. They do not add a backend or a runtime dependency. The Bearer
 * token accepted by `createServerHttpClient` is a SERVER-ONLY secret: never put
 * it in STREETUI_PUBLIC_* configuration or pass it to browser code.
 */
import {
  createAuthSession,
  createClient,
  fetchWithSignal,
  HttpError,
  type AuthSession,
  type Client,
  type FetchLike,
  type Mutation,
  type Resource,
} from 'streetui';
import type { DataSource, Page, User, UserQuery } from './data.js';
import { createMockDataSource } from './data.js';
import { configuredApiUrl, createHttpDataSourceFromClient } from './http-data.js';

/**
 * Env var holding the server-only API credential. It is deliberately NOT
 * prefixed `STREETUI_PUBLIC_`: public-prefixed variables are inlined into the
 * browser bundle by the toolchain, which would leak the token. Never read this
 * from client code.
 */
export const DASHBOARD_API_TOKEN_ENV = 'STREETUI_DASHBOARD_API_TOKEN';

/** Just enough of `process.env` to read configuration; injectable in tests. */
export interface ServerEnv {
  readonly [key: string]: string | undefined;
}

/**
 * Server-side data source for SSR and server routes.
 *
 * - No public base URL configured → the in-process mock (unchanged behaviour).
 * - Base URL configured → a real HTTP source whose client injects a Bearer token
 *   when `STREETUI_DASHBOARD_API_TOKEN` is set. The token stays in this process;
 *   the browser bundle only ever sees the public base URL.
 *
 * Prefer an `HttpOnly` session cookie (sent automatically by the browser to the
 * same origin) when the API is first-party; the Bearer path exists for
 * server-to-server tokens and tests.
 */
export function createServerDataSource(env: ServerEnv = process.env as ServerEnv): DataSource {
  const baseUrl = configuredApiUrl(env as Record<string, string | undefined>);
  if (baseUrl === undefined) return createMockDataSource();
  const token = env[DASHBOARD_API_TOKEN_ENV];
  const bearerToken = typeof token === 'string' && token.trim() !== '' ? token.trim() : undefined;
  const client = createServerHttpClient({
    baseUrl,
    ...(bearerToken === undefined ? {} : { bearerToken }),
  });
  return createHttpDataSourceFromClient(client);
}

const globalFetch: FetchLike = (input, init) => {
  if (typeof fetch === 'undefined') throw new Error('HTTP integration: no global fetch; inject { fetch }');
  return fetch(input, init);
};

export interface ReadRetryOptions {
  /** Total attempts, including the initial request. Defaults to 3. */
  readonly maxAttempts?: number;
  /** Initial exponential-backoff delay when Retry-After is absent. Defaults to 100 ms. */
  readonly baseDelayMs?: number;
  /** Test seam for observing delays; production uses an abort-aware timer. */
  readonly wait?: (milliseconds: number, signal: AbortSignal | undefined) => Promise<void>;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function waitForRetry(milliseconds: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted === true) return Promise.reject(abortReason(signal));
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function retryAfterMilliseconds(value: string | null, now = Date.now()): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/**
 * Wrap fetch with bounded retries for idempotent GET/HEAD reads only. HTTP 429
 * and 5xx responses use Retry-After when valid, otherwise exponential backoff.
 * Writes pass through exactly once; retrying a write requires an application
 * idempotency key and server-side idempotency support.
 */
export function createReadRetryFetch(fetcher: FetchLike, options: ReadRetryOptions = {}): FetchLike {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('Read retry maxAttempts must be a positive integer');
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new RangeError('Read retry baseDelayMs must be a non-negative number');
  }
  const wait = options.wait ?? waitForRetry;

  return async (input, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return fetcher(input, init);

    for (let attempt = 1; ; attempt += 1) {
      if (init.signal?.aborted === true) throw abortReason(init.signal);
      const response = await fetcher(input, init);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) return response;
      const delay = retryAfterMilliseconds(response.headers.get('retry-after'))
        ?? baseDelayMs * 2 ** (attempt - 1);
      await wait(delay, init.signal ?? undefined);
    }
  };
}

export interface ServerHttpClientOptions {
  readonly baseUrl: string;
  /** SERVER-ONLY credential. The tests use a dummy token, never a real secret. */
  readonly bearerToken?: string;
  readonly fetch?: FetchLike;
  readonly retry?: ReadRetryOptions;
}

/** Create a server-side JSON client with optional Bearer injection and read retry. */
export function createServerHttpClient(options: ServerHttpClientOptions): Client {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.bearerToken !== undefined) headers['Authorization'] = `Bearer ${options.bearerToken}`;
  return createClient({
    baseUrl: options.baseUrl,
    headers,
    fetch: createReadRetryFetch(options.fetch ?? globalFetch, options.retry ?? {}),
  });
}

export interface DashboardSessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** Compose the existing auth-session primitive with a real /session endpoint. */
export function createDashboardAuthSession(api: Client): AuthSession<DashboardSessionUser> {
  return createAuthSession<DashboardSessionUser>({
    immediate: false,
    loadUser: ({ signal }) => api.get<DashboardSessionUser | null>('/session', { signal }),
    logout: async () => {
      await api.post<void>('/logout', {});
    },
  });
}

export interface UserWrite {
  readonly name: string;
  readonly email: string;
  readonly role: User['role'];
  readonly status: User['status'];
}

export interface UserPatch {
  readonly id: string;
  readonly changes: Partial<UserWrite>;
}

export interface UserDelete {
  readonly id: string;
}

export interface DashboardUsersCrud {
  readonly list: Resource<Page<User>>;
  readonly create: Mutation<UserWrite, User>;
  readonly update: Mutation<UserPatch, User>;
  readonly remove: Mutation<UserDelete, void>;
  dispose(): void;
}

/**
 * CRUD mutations explicitly refetch one query-aware resource after every write.
 * Fixed /users endpoints keep the example small; the JSON body carries the id
 * for PATCH/DELETE, matching the test API and the integration guide.
 */
export function createDashboardUsersCrud(api: Client, query: UserQuery): DashboardUsersCrud {
  const list = api.resource<Page<User>>('/users', {
    immediate: false,
    query: {
      query: query.query,
      role: query.role,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
  const onSuccess = (): Promise<void> => list.refetch();
  const create = api.mutation<UserWrite, User>('POST', '/users', { onSuccess });
  const update = api.mutation<UserPatch, User>('PATCH', '/users', { onSuccess });
  const remove = api.mutation<UserDelete, void>('DELETE', '/users', { onSuccess });

  return {
    list,
    create,
    update,
    remove,
    dispose: () => {
      create.dispose();
      update.dispose();
      remove.dispose();
      list.dispose();
    },
  };
}

export interface UploadReceipt {
  readonly id: string;
  readonly name: string;
  readonly size: number;
}

export interface UploadAttachmentOptions {
  readonly url: string;
  readonly file: Blob;
  readonly filename: string;
  readonly fetch?: FetchLike;
  /** Optional server-injected headers, such as Authorization. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

/**
 * Multipart upload via fetchWithSignal. FormData supplies the multipart boundary;
 * do not set Content-Type manually. createClient JSON-stringifies bodies and is
 * deliberately not used as an upload API.
 */
export async function uploadDashboardAttachment(options: UploadAttachmentOptions): Promise<UploadReceipt> {
  const body = new FormData();
  body.append('file', options.file, options.filename);
  const init: RequestInit = { method: 'POST', body };
  if (options.headers !== undefined) init.headers = { ...options.headers };
  const response = await fetchWithSignal(
    options.fetch ?? globalFetch,
    options.url,
    init,
    options.signal,
  );
  const parsed = await parseResponseBody(response);
  if (!response.ok) throw new HttpError(response.status, response.statusText, options.url, parsed);
  if (!isUploadReceipt(parsed)) throw new Error('Dashboard upload: invalid JSON receipt');
  return parsed;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  if ((response.headers.get('content-type') ?? '').includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

function isUploadReceipt(value: unknown): value is UploadReceipt {
  if (typeof value !== 'object' || value === null) return false;
  const receipt = value as Record<string, unknown>;
  return typeof receipt['id'] === 'string'
    && typeof receipt['name'] === 'string'
    && typeof receipt['size'] === 'number';
}
