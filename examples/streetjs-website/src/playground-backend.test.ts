import { describe, expect, it, vi } from 'vitest';
import {
  checkMigrations, checkSecretFormats, createPlayground, decodeColumn, decodeRows, DECODER_SAMPLE, MIGRATION_SAMPLE,
} from './playground.js';
import { createBackendPanel, normalizeBaseUrl, PROBE_PATHS, type FetchLike } from './backend.js';

describe('playground — row decoder', () => {
  it('decodes the documented Postgres text forms', () => {
    expect(decodeColumn('boolean', 't')).toEqual({ ok: true, result: 'true' });
    expect(decodeColumn('boolean', 'f')).toEqual({ ok: true, result: 'false' });
    expect(decodeColumn('boolean', 'true').ok).toBe(false);
    expect(decodeColumn('bigint', '9007199254740993')).toEqual({ ok: true, result: '9007199254740993n' });
    expect(decodeColumn('int', '9007199254740993').ok).toBe(false);
    expect(decodeColumn('int', 'abc').ok).toBe(false);
    expect(decodeColumn('timestamp', '2026-01-02 03:04:05.123456+00')).toEqual({ ok: true, result: '2026-01-02T03:04:05.123Z' });
    expect(decodeColumn('timestamp', '2026-01-02T03:04:05Z').ok).toBe(false);
    expect(decodeColumn('jsonb', '{"a": 1}')).toEqual({ ok: true, result: '{"a":1}' });
    expect(decodeColumn('jsonb', '{nope').ok).toBe(false);
    expect(decodeColumn('uuid', 'x').ok).toBe(false);
  });

  it('parses entries separated by ; or newlines, skipping comments', () => {
    const rows = decodeRows('a | int | 1; # skip me\n b | boolean | t ;; bad');
    expect(rows.map((r) => r.column)).toEqual(['a', 'b', 'bad']);
    expect(rows[2]!.ok).toBe(false);
    expect(decodeRows(DECODER_SAMPLE).every((r) => r.ok)).toBe(true);
  });
});

describe('playground — migration order', () => {
  it('accepts the sample (rollbacks ignored) with a single problem-free order', () => {
    const r = checkMigrations(MIGRATION_SAMPLE);
    expect(r.order).toEqual(['001_create_users.sql', '002_create_orders.sql', '010_add_indexes.sql']);
    expect(r.problems).toEqual([]);
  });
  it('flags unpadded prefixes, duplicates, same prefix, bad names and missing prefixes', () => {
    const r = checkMigrations('1_a.sql, 10_b.sql, 2_c.sql, 2_c.sql, 02_d.sql, readme.txt, init.sql');
    expect(r.problems.join('\n')).toMatch(/different widths/);
    expect(r.problems.join('\n')).toMatch(/listed more than once/);
    expect(r.problems.join('\n')).toMatch(/not a valid migration file name/);
    expect(r.problems.join('\n')).toMatch(/no numeric prefix/);
    expect(r.order.indexOf('10_b.sql')).toBeLessThan(r.order.indexOf('2_c.sql'));
  });
});

describe('playground — secret formats', () => {
  it('applies the JwtService ≥32 and SessionManager exactly-64-hex rules', () => {
    expect(checkSecretFormats('short').map((c) => c.ok)).toEqual([false, false]);
    expect(checkSecretFormats('x'.repeat(40)).map((c) => c.ok)).toEqual([true, false]);
    expect(checkSecretFormats('a'.repeat(64)).map((c) => c.ok)).toEqual([true, true]);
    expect(checkSecretFormats('g'.repeat(64)).map((c) => c.ok)).toEqual([true, false]);
  });
});

describe('playground — reactive state', () => {
  it('derived results and summaries follow the inputs', () => {
    const pg = createPlayground();
    expect(pg.decoderSummary.get()).toBe('5 columns, 0 problems');
    pg.decoderInput.set('x | boolean | maybe');
    expect(pg.decoderSummary.get()).toBe('1 column, 1 problem');
    pg.migrationInput.set('1_a.sql, 10_b.sql');
    expect(pg.migrationSummary.get()).toBe('2 forward migrations, 0 problems'.replace('0 problems', '0 problems'));
    pg.migrationInput.set('1_a.sql, 10_b.sql, 02_c.sql');
    expect(pg.migrations.get().problems.length).toBeGreaterThan(0);
    pg.secretInput.set('a'.repeat(64));
    expect(pg.secrets.get().every((s) => s.ok)).toBe(true);
  });
});

const ok = (body = '{"status":"ok"}'): ReturnType<FetchLike> => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body) });
const status = (s: number): ReturnType<FetchLike> => Promise.resolve({ ok: false, status: s, text: () => Promise.resolve('') });

describe('backend panel — only the three framework routes', () => {
  it('normalises URLs and rejects non-http(s) and garbage', () => {
    expect(normalizeBaseUrl('http://localhost:3000/')).toEqual({ ok: true, url: 'http://localhost:3000' });
    expect(normalizeBaseUrl('https://x.test/api/')).toEqual({ ok: true, url: 'https://x.test/api' });
    expect(normalizeBaseUrl('').ok).toBe(false);
    expect(normalizeBaseUrl('nonsense').ok).toBe(false);
    expect(normalizeBaseUrl('ftp://x.test').ok).toBe(false);
    expect(normalizeBaseUrl('javascript:alert(1)').ok).toBe(false);
  });

  it('is idle and makes no request without a URL', async () => {
    const f = vi.fn<FetchLike>();
    const p = createBackendPanel(f);
    expect(p.summary.get()).toMatch(/No backend configured/);
    await p.run();
    expect(f).not.toHaveBeenCalled();
    expect(p.results.get().every((r) => r.state === 'idle')).toBe(true);
  });

  it('requests exactly the three documented paths and reports success', async () => {
    const urls: string[] = [];
    const p = createBackendPanel((u) => { urls.push(u); return ok(); });
    p.baseUrl.set('http://localhost:3000/');
    const run = p.run();
    expect(p.summary.get()).toBe('Probing…');
    expect(p.results.get().every((r) => r.state === 'loading')).toBe(true);
    await run;
    expect(urls.sort()).toEqual(PROBE_PATHS.map((x) => `http://localhost:3000${x}`).sort());
    expect(p.results.get().every((r) => r.state === 'ok')).toBe(true);
    expect(p.summary.get()).toBe('3 of 3 routes answered.');
  });

  it('distinguishes 404 (route not registered), 500, network failure, and timeout', async () => {
    const p = createBackendPanel((u) => {
      if (u.endsWith('/health/live')) return status(404);
      if (u.endsWith('/health/ready')) return status(503);
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    p.baseUrl.set('http://localhost:3000');
    await p.run();
    const [live, ready, jobs] = p.results.get();
    expect(live!.state).toBe('unavailable');
    expect(ready!).toMatchObject({ state: 'error', detail: 'HTTP 503' });
    expect(jobs!.state).toBe('error');
    expect(jobs!.detail).toMatch(/CORS/);
    expect(p.running.get()).toBe(false);

    const slow = createBackendPanel((_u, init) => new Promise((_, rej) => {
      init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }), 20);
    slow.baseUrl.set('http://localhost:3000');
    await slow.run();
    expect(slow.results.get()[0]!.detail).toMatch(/No answer within/);
  });

  it('shows an explicit error for an invalid URL and never fetches', async () => {
    const f = vi.fn<FetchLike>();
    const p = createBackendPanel(f);
    p.baseUrl.set('ftp://x');
    expect(p.urlError.get()).toMatch(/http:/);
    await p.run();
    expect(f).not.toHaveBeenCalled();
  });
});
