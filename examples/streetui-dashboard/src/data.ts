/**
 * Demo data + the data-source contract for the dashboard example.
 *
 * The three mock functions below are **demonstration data**, not a real
 * service. The async functions deliberately mimic an HTTP API (latency,
 * filtering, pagination) so the UI exercises realistic loading and error
 * states, and they honour the abort signal exactly like a real request.
 *
 * PRODUCTION INTEGRATION POINT: `./http-data.ts` implements the same
 * `DataSource` contract against a real HTTP/JSON API through
 * `createClient({ baseUrl })`. Set `STREETUI_PUBLIC_DASHBOARD_API_URL` to switch
 * the app from the mock source to the HTTP source — the UI consumes only the
 * returned shapes and does not care where they come from.
 *
 * `STREETUI_PUBLIC_DASHBOARD_API_URL` is a *public* base URL (not a secret): the
 * browser needs it too. Server-only credentials (a Bearer token) are never read
 * here; `./http-patterns.ts` exposes a server client for that, and `./server.ts`
 * injects it into `createState`.
 */

export type UserStatus = 'active' | 'invited' | 'suspended';
export type ProjectStatus = 'on-track' | 'at-risk' | 'done';

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: 'owner' | 'admin' | 'member' | 'viewer';
  readonly status: UserStatus;
  readonly lastActive: string;
}
export interface Project {
  readonly id: string;
  readonly name: string;
  readonly owner: string;
  readonly status: ProjectStatus;
  readonly progress: number;
}
export interface ActivityItem {
  readonly id: string;
  readonly text: string;
  readonly at: string;
}
export interface OverviewData {
  readonly metrics: readonly { readonly id: string; readonly label: string; readonly value: number; readonly delta: string }[];
  readonly activity: readonly ActivityItem[];
}
export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}
export interface UserQuery {
  readonly query: string;
  readonly role: string;
  readonly page: number;
  readonly pageSize: number;
}

/** Per-request options; `signal` cancels the work like a real HTTP request. */
export interface DataRequestOptions {
  readonly signal?: AbortSignal;
}

/** The data contract the UI depends on. Both the mock and HTTP sources implement it. */
export interface DataSource {
  fetchOverview(options?: DataRequestOptions): Promise<OverviewData>;
  fetchUsers(query: UserQuery, options?: DataRequestOptions): Promise<Page<User>>;
  fetchProjects(status: string, options?: DataRequestOptions): Promise<readonly Project[]>;
}

const FIRST = ['Ava', 'Liam', 'Maya', 'Noah', 'Ivy', 'Owen', 'Ella', 'Lucas', 'Nora', 'Felix', 'Zoe', 'Hugo'];
const LAST = ['Chen', 'Patel', 'Garcia', 'Kim', 'Novak', 'Smith', 'Brown', 'Diaz', 'Ito', 'Weber', 'Ali', ' Ross'];
const ROLES: readonly User['role'][] = ['owner', 'admin', 'member', 'viewer'];
const STATUSES: readonly UserStatus[] = ['active', 'invited', 'suspended'];

export const USERS: readonly User[] = Array.from({ length: 24 }, (_, i) => {
  const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`.replace('  ', ' ');
  return {
    id: `u-${i + 1}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
    role: ROLES[i % ROLES.length] ?? 'member',
    status: STATUSES[i % STATUSES.length] ?? 'active',
    lastActive: `2026-11-${String(1 + (i % 18)).padStart(2, '0')}`,
  };
});

export const PROJECTS: readonly Project[] = [
  { id: 'p-1', name: 'Billing migration', owner: 'Ava Chen', status: 'on-track', progress: 72 },
  { id: 'p-2', name: 'Mobile shell', owner: 'Liam Patel', status: 'at-risk', progress: 41 },
  { id: 'p-3', name: 'Data warehouse', owner: 'Maya Garcia', status: 'on-track', progress: 63 },
  { id: 'p-4', name: 'Design tokens v2', owner: 'Noah Kim', status: 'done', progress: 100 },
  { id: 'p-5', name: 'SSO rollout', owner: 'Ivy Novak', status: 'at-risk', progress: 28 },
  { id: 'p-6', name: 'Audit log export', owner: 'Owen Smith', status: 'on-track', progress: 55 },
  { id: 'p-7', name: 'Customer portal', owner: 'Ella Brown', status: 'on-track', progress: 81 },
  { id: 'p-8', name: 'Rate limiting', owner: 'Lucas Diaz', status: 'done', progress: 100 },
  { id: 'p-9', name: 'Notification prefs', owner: 'Nora Ito', status: 'at-risk', progress: 35 },
  { id: 'p-10', name: 'Usage analytics', owner: 'Felix Weber', status: 'on-track', progress: 67 },
  { id: 'p-11', name: 'SCIM provisioning', owner: 'Zoe Ali', status: 'on-track', progress: 49 },
  { id: 'p-12', name: 'Legacy importer', owner: 'Hugo Ross', status: 'done', progress: 100 },
];

export const ACTIVITY: readonly ActivityItem[] = [
  { id: 'a-1', text: 'Ava Chen invited 3 teammates to Billing migration', at: '12m ago' },
  { id: 'a-2', text: 'Liam Patel moved Mobile shell to at-risk', at: '48m ago' },
  { id: 'a-3', text: 'Maya Garcia closed 14 review threads', at: '2h ago' },
  { id: 'a-4', text: 'Noah Kim shipped Design tokens v2', at: '5h ago' },
  { id: 'a-5', text: 'Ivy Novak updated the SSO checklist', at: 'Yesterday' },
  { id: 'a-6', text: 'Owen Smith exported the October audit log', at: 'Yesterday' },
  { id: 'a-7', text: 'Ella Brown enabled the customer portal beta', at: '2 days ago' },
  { id: 'a-8', text: 'Lucas Diaz archived 9 stale projects', at: '3 days ago' },
];

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

/** Latency that rejects with an AbortError when the signal fires (real-request semantics). */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchOverview(options: DataRequestOptions = {}): Promise<OverviewData> {
  await wait(120, options.signal);
  return {
    metrics: [
      { id: 'm-users', label: 'Total users', value: USERS.length, delta: '+3 this week' },
      { id: 'm-active', label: 'Active users', value: USERS.filter((u) => u.status === 'active').length, delta: '67% of total' },
      { id: 'm-projects', label: 'Projects', value: PROJECTS.length, delta: `${PROJECTS.filter((p) => p.status === 'done').length} completed` },
      { id: 'm-risk', label: 'At risk', value: PROJECTS.filter((p) => p.status === 'at-risk').length, delta: 'Needs attention' },
    ],
    activity: ACTIVITY,
  };
}

export async function fetchUsers(query: UserQuery, options: DataRequestOptions = {}): Promise<Page<User>> {
  await wait(150, options.signal);
  const q = query.query.trim().toLowerCase();
  const filtered = USERS.filter((u) => {
    const matchesQuery = q.length === 0 || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = query.role === 'all' || u.role === query.role;
    return matchesQuery && matchesRole;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;
  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function fetchProjects(status: string, options: DataRequestOptions = {}): Promise<readonly Project[]> {
  await wait(150, options.signal);
  return status === 'all' ? PROJECTS : PROJECTS.filter((p) => p.status === status);
}

/** The in-process mock data source used when no API base URL is configured. */
export function createMockDataSource(): DataSource {
  return { fetchOverview, fetchUsers, fetchProjects };
}
