/**
 * Real HTTP data source for the dashboard example.
 *
 * This is the production path described in `./data.ts`: the same
 * `DataSource` contract, implemented over `createClient({ baseUrl })` so the
 * app talks to any HTTP/JSON backend instead of the in-process mock.
 *
 * Enabled by setting `STREETUI_PUBLIC_DASHBOARD_API_URL` (for example
 * `https://api.example.com`). The variable carries the public prefix because a
 * base URL is not a secret and the browser needs it too; authentication
 * credentials never go here — pass them as headers to `createClient` from a
 * server-only integration point.
 *
 * Expected endpoints (all `GET`, JSON):
 *   GET {base}/overview
 *   GET {base}/users?query=&role=&page=&pageSize=
 *   GET {base}/projects?status=
 */
import { createClient, HttpError, type Client } from 'streetui';
import type { DataRequestOptions, DataSource, OverviewData, Page, Project, User, UserQuery } from './data.js';

export const API_URL_ENV = 'STREETUI_PUBLIC_DASHBOARD_API_URL';

/** Read the configured API base URL, or `undefined` when the mock source is active. */
export function configuredApiUrl(env: Record<string, string | undefined> = readEnv()): string | undefined {
  const value = env[API_URL_ENV];
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? undefined : trimmed;
}

/**
 * `process.env` when it exists. The toolchain replaces the literal
 * `process.env.STREETUI_PUBLIC_DASHBOARD_API_URL` member access with a string
 * constant in the client bundle (and `undefined` when unset), so this reads
 * the same value on the server and in the browser without exposing any other
 * variable.
 */
function readEnv(): Record<string, string | undefined> {
  const inline = process.env.STREETUI_PUBLIC_DASHBOARD_API_URL;
  return inline === undefined ? {} : { [API_URL_ENV]: inline };
}

export interface HttpDataSourceOptions {
  readonly baseUrl: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  readonly client?: Client;
}

/**
 * Build the HTTP data source from an existing {@link Client} — the seam used by
 * the server to inject a server-only authenticated client (Bearer header) while
 * the browser keeps the plain, public client created from the base URL.
 */
export function createHttpDataSourceFromClient(client: Client): DataSource {
  return {
    fetchOverview: async (request: DataRequestOptions = {}): Promise<OverviewData> => {
      const data = await client.get<OverviewData>('/overview', signalConfig(request));
      return assertOverview(data);
    },
    fetchUsers: async (query: UserQuery, request: DataRequestOptions = {}): Promise<Page<User>> => {
      const data = await client.get<Page<User>>('/users', {
        ...signalConfig(request),
        query: { query: query.query, role: query.role, page: query.page, pageSize: query.pageSize },
      });
      return assertPage(data);
    },
    fetchProjects: async (status: string, request: DataRequestOptions = {}): Promise<readonly Project[]> => {
      const data = await client.get<readonly Project[]>('/projects', {
        ...signalConfig(request),
        query: { status },
      });
      return assertProjects(data);
    },
  };
}

export function createHttpDataSource(options: HttpDataSourceOptions): DataSource {
  const api =
    options.client ??
    createClient({
      baseUrl: options.baseUrl,
      headers: { Accept: 'application/json' },
    });
  return createHttpDataSourceFromClient(api);
}

function signalConfig(request: DataRequestOptions): { signal?: AbortSignal } {
  return request.signal === undefined ? {} : { signal: request.signal };
}

/**
 * Minimal response validation. A real backend can fail in ways HTTP status
 * codes do not express (an HTML error page with status 200, a truncated JSON
 * payload), so shapes the UI dereferences are checked and reported as a clear
 * error instead of a `TypeError` deep in the renderer.
 */
function invalidResponse(path: string, detail: string): Error {
  return new Error(`Dashboard API: invalid response from ${path} (${detail})`);
}

function assertOverview(value: unknown): OverviewData {
  if (!isRecord(value) || !Array.isArray(value.metrics) || !Array.isArray(value.activity)) {
    throw invalidResponse('/overview', 'expected { metrics, activity }');
  }
  return value as unknown as OverviewData;
}

function assertPage(value: unknown): Page<User> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    typeof value.total !== 'number' ||
    typeof value.page !== 'number' ||
    typeof value.pageSize !== 'number' ||
    typeof value.pageCount !== 'number'
  ) {
    throw invalidResponse('/users', 'expected { items, total, page, pageSize, pageCount }');
  }
  return value as unknown as Page<User>;
}

function assertProjects(value: unknown): readonly Project[] {
  if (!Array.isArray(value)) throw invalidResponse('/projects', 'expected an array of projects');
  return value as readonly Project[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** True when a resource error came from an HTTP status the UI should surface as-is. */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
