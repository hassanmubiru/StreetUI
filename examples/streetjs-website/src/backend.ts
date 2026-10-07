/**
 * StreetJS website — backend status panel.
 *
 * The only "backend" this site talks to is one the visitor points it at: a
 * running StreetJS application. It probes the three routes that the framework
 * itself provides when the app registers them:
 *
 *   GET /health/live        (registerHealthRoutes)
 *   GET /health/ready       (registerHealthRoutes)
 *   GET /api/jobs/metrics   (registerJobMetricsRoute)
 *
 * No other endpoint is assumed to exist. The site has no backend of its own,
 * so with no URL entered the panel stays idle; unreachable, blocked-by-CORS and
 * non-2xx answers each get an explicit message.
 */

import { derived, signal, type ReadonlySignal, type Signal } from 'streetui';

export const PROBE_PATHS = ['/health/live', '/health/ready', '/api/jobs/metrics'] as const;
export type ProbeState = 'idle' | 'loading' | 'ok' | 'unavailable' | 'error';

export interface ProbeResult {
  readonly path: string;
  readonly state: ProbeState;
  readonly detail: string;
}

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface BackendPanel {
  readonly baseUrl: Signal<string>;
  readonly results: Signal<ProbeResult[]>;
  readonly running: Signal<boolean>;
  readonly summary: ReadonlySignal<string>;
  readonly urlError: ReadonlySignal<string>;
  run(): Promise<void>;
}

/** Accept only http(s) origins (optionally with a path); return a clean base. */
export function normalizeBaseUrl(input: string): { ok: true; url: string } | { ok: false; reason: string } {
  const raw = input.trim();
  if (raw === '') return { ok: false, reason: 'Enter the base URL of a running StreetJS app.' };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'That is not a valid URL. Example: http://localhost:3000' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: 'Only http: and https: URLs can be probed.' };
  }
  return { ok: true, url: `${u.origin}${u.pathname.replace(/\/+$/, '')}` };
}

const idleResults = (): ProbeResult[] =>
  PROBE_PATHS.map((path) => ({ path, state: 'idle', detail: 'Not probed yet.' }));

export function createBackendPanel(fetchImpl?: FetchLike, timeoutMs = 5000): BackendPanel {
  const baseUrl = signal('');
  const results = signal<ProbeResult[]>(idleResults());
  const running = signal(false);

  const urlError = derived(() => {
    const v = baseUrl.get();
    if (v.trim() === '') return '';
    const r = normalizeBaseUrl(v);
    return r.ok ? '' : r.reason;
  });

  const summary = derived(() => {
    if (running.get()) return 'Probing…';
    const rs = results.get();
    if (rs.every((r) => r.state === 'idle')) return 'No backend configured. Enter a URL to probe a running StreetJS app.';
    const ok = rs.filter((r) => r.state === 'ok').length;
    return `${ok} of ${rs.length} routes answered.`;
  });

  const doFetch = (): FetchLike | undefined =>
    fetchImpl ?? (typeof fetch === 'function' ? (fetch as unknown as FetchLike) : undefined);

  async function probe(base: string, path: string, f: FetchLike): Promise<ProbeResult> {
    const ctl = typeof AbortController === 'function' ? new AbortController() : undefined;
    const timer = ctl !== undefined ? setTimeout(() => ctl.abort(), timeoutMs) : undefined;
    try {
      const res = await f(`${base}${path}`, ctl !== undefined ? { signal: ctl.signal } : undefined);
      if (res.ok) {
        const body = (await res.text()).slice(0, 200).replace(/\s+/g, ' ').trim();
        return { path, state: 'ok', detail: `HTTP ${res.status}${body !== '' ? ` — ${body}` : ''}` };
      }
      if (res.status === 404) {
        return { path, state: 'unavailable', detail: 'HTTP 404 — the app has not registered this route.' };
      }
      return { path, state: 'error', detail: `HTTP ${res.status}` };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        path,
        state: 'error',
        detail: aborted
          ? `No answer within ${timeoutMs / 1000}s.`
          : 'Request failed — the server is unreachable, or the browser blocked it (CORS must allow this site’s origin).',
      };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async function run(): Promise<void> {
    if (running.peek()) return;
    const parsed = normalizeBaseUrl(baseUrl.peek());
    if (!parsed.ok) {
      results.set(idleResults());
      return;
    }
    const f = doFetch();
    if (f === undefined) {
      results.set(PROBE_PATHS.map((path) => ({ path, state: 'error' as const, detail: 'fetch is not available here.' })));
      return;
    }
    running.set(true);
    results.set(PROBE_PATHS.map((path) => ({ path, state: 'loading' as const, detail: 'Waiting for an answer…' })));
    try {
      results.set(await Promise.all(PROBE_PATHS.map((p) => probe(parsed.url, p, f))));
    } finally {
      running.set(false);
    }
  }

  return { baseUrl, results, running, summary, urlError, run };
}
