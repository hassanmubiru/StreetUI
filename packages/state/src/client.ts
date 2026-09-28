/**
 * Optional HTTP data client (2.0 §17) — the integration path between StreetUI's
 * transport-agnostic `resource`/`mutation` primitives and a real backend (a
 * StreetJS server, or any HTTP/JSON API).
 *
 * This is deliberately OPTIONAL and dependency-free: it imports nothing from
 * StreetJS (or any server framework), so StreetUI's core stays independent — an
 * app that never calls `createClient` never pays for it, and StreetUI does not
 * take on a backend dependency. It is a thin, honest convenience over the
 * standard `fetch`: URL joining, JSON encode/decode, header merging, abort
 * propagation, and a typed error. All state still flows through the existing
 * `resource`/`mutation` signals — there is no cache and no second data system.
 *
 * ```ts
 * const api = createClient({ baseUrl: '/api' });
 * const users = api.resource<User[]>('/users');            // a read
 * const create = api.mutation<NewUser, User>('POST', '/users', {
 *   onSuccess: () => users.refetch(),                      // explicit invalidation
 * });
 * ```
 */

import { resource, type Resource, type ResourceOptions } from './resource.js';
import { mutation, type Mutation, type MutationOptions } from './mutation.js';

/** A `fetch`-compatible function. Injectable for tests / non-browser runtimes. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientConfig {
  /** Prefix joined to every request path (e.g. `/api` or `https://x/api`). */
  readonly baseUrl?: string;
  /** Headers merged into every request (per-request headers win). */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * The fetch implementation to use. Defaults to the global `fetch`. Injecting
   * one keeps the client testable and usable where no global fetch exists.
   */
  readonly fetch?: FetchLike;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestConfig {
  /** Extra headers for this request (merged over the client's). */
  readonly headers?: Readonly<Record<string, string>>;
  /** Abort signal — pass a resource/mutation loader's `ctx.signal` for cancellation. */
  readonly signal?: AbortSignal;
  /** Query parameters appended to the URL. */
  readonly query?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * A failed HTTP response (non-2xx). Carries the status and the parsed body when
 * one was returned. NOTE: the body may contain server-supplied detail; the §7
 * error reporter never enumerates an error's own-properties, so `HttpError.body`
 * never leaks into a diagnostics report unless an app deliberately reads it.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly body: unknown;

  constructor(status: number, statusText: string, url: string, body: unknown) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.body = body;
  }
}

export interface Client {
  /** Issue a request and return the parsed JSON body (throws `HttpError` on non-2xx). */
  request<T>(method: HttpMethod, path: string, body?: unknown, config?: RequestConfig): Promise<T>;
  get<T>(path: string, config?: RequestConfig): Promise<T>;
  post<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T>;
  put<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T>;
  patch<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T>;
  del<T>(path: string, config?: RequestConfig): Promise<T>;
  /**
   * A GET-backed {@link Resource}. The loader forwards the resource's abort
   * signal, so `dispose()`/supersede cancels the request.
   */
  resource<T>(path: string, options?: ResourceOptions<T> & { readonly query?: RequestConfig['query'] }): Resource<T>;
  /**
   * A {@link Mutation} that issues `method path` with the mutate() argument as
   * the JSON body. Pair with `onSuccess` to refetch affected resources.
   */
  mutation<TArgs, TResult>(
    method: HttpMethod,
    path: string,
    options?: MutationOptions<TArgs, TResult>,
  ): Mutation<TArgs, TResult>;
}

function joinUrl(baseUrl: string | undefined, path: string): string {
  if (baseUrl === undefined || baseUrl === '') return path;
  const b = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function withQuery(url: string, query: RequestConfig['query']): string {
  if (query === undefined) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) params.set(k, String(v));
  const qs = params.toString();
  if (qs === '') return url;
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}

/** Create an optional HTTP data client. Uses global `fetch` unless one is injected. */
export function createClient(config: ClientConfig = {}): Client {
  const doFetch: FetchLike =
    config.fetch ??
    ((input, init) => {
      if (typeof fetch === 'undefined') {
        throw new Error('createClient: no global fetch; pass { fetch } explicitly');
      }
      return fetch(input, init);
    });

  async function request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    reqConfig: RequestConfig = {},
  ): Promise<T> {
    const url = withQuery(joinUrl(config.baseUrl, path), reqConfig.query);
    const headers: Record<string, string> = { ...config.headers, ...reqConfig.headers };
    const init: RequestInit = { method, headers };
    if (reqConfig.signal !== undefined) init.signal = reqConfig.signal;
    if (body !== undefined) {
      if (headers['Content-Type'] === undefined) headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const response = await doFetch(url, init);
    const parsed = await parseBody(response);
    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, url, parsed);
    }
    return parsed as T;
  }

  return {
    request,
    get: (path, c) => request('GET', path, undefined, c),
    post: (path, b, c) => request('POST', path, b, c),
    put: (path, b, c) => request('PUT', path, b, c),
    patch: (path, b, c) => request('PATCH', path, b, c),
    del: (path, c) => request('DELETE', path, undefined, c),
    resource: <T>(path: string, options: (ResourceOptions<T> & { query?: RequestConfig['query'] }) = {}) => {
      const { query, ...resourceOptions } = options;
      return resource<T>(
        (ctx) => request<T>('GET', path, undefined, { signal: ctx.signal, ...(query !== undefined ? { query } : {}) }),
        resourceOptions,
      );
    },
    mutation: <TArgs, TResult>(method: HttpMethod, path: string, options?: MutationOptions<TArgs, TResult>) =>
      mutation<TArgs, TResult>((args) => request<TResult>(method, path, args), options ?? {}),
  };
}

/** Parse a response as JSON when it declares JSON, else as text; empty → undefined. */
async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}
