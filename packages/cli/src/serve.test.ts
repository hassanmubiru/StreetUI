import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { startServer, type RunningServer } from './serve.js';

/**
 * Focused production-server hardening tests (v0.8 §17/§18/§19/§24). A REAL
 * `node:http` server (from serve.ts) answers REAL `fetch` requests. Covers
 * static MIME + security/cache headers, path-traversal containment, malformed
 * input, and the dev-vs-production error-disclosure boundary. Nothing is faked.
 */

function freePort(): Promise<number> {
  return new Promise((res, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => res(port));
    });
  });
}

const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const c of cleanups.splice(0)) await c();
});

/** Spin up a server over a temp clientDir + a tiny render bundle. */
async function makeServer(opts: {
  render: string; // JS source of a module exporting `render`
  devMode?: boolean;
  files?: Record<string, string>;
}): Promise<{ base: string; running: RunningServer }> {
  const root = await mkdtemp(join(tmpdir(), 'streetui-serve-'));
  const clientDir = join(root, 'client');
  await mkdir(clientDir, { recursive: true });
  // A sibling of clientDir whose name shares the clientDir prefix — used to
  // prove the containment check is not a naive `startsWith`.
  await mkdir(`${clientDir}-secret`, { recursive: true });
  await writeFile(`${clientDir}-secret/leak.txt`, 'TOP SECRET');
  for (const [name, body] of Object.entries(opts.files ?? {})) {
    await writeFile(join(clientDir, name), body);
  }
  const serverBundle = join(root, 'server.mjs');
  await writeFile(serverBundle, opts.render);

  const port = await freePort();
  const running = await startServer({
    clientDir,
    serverBundle,
    host: '127.0.0.1',
    port,
    devMode: opts.devMode === true,
  });
  cleanups.push(async () => {
    await running.close();
    await rm(root, { recursive: true, force: true });
  });
  return { base: running.url, running };
}

const OK_RENDER = `export function render(req){return {html:'<!doctype html><body>route:'+req.url+'</body>'};}`;

describe('serve — static assets', () => {
  it('serves a static file with the correct MIME and nosniff header', async () => {
    const { base } = await makeServer({
      render: OK_RENDER,
      files: { 'app.js': 'console.log(1)', 'styles.css': 'body{}' },
    });
    const js = await fetch(`${base}/app.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(js.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await js.text()).toBe('console.log(1)');

    const css = await fetch(`${base}/styles.css`);
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8');
  });

  it('caches immutable output in production but not in dev', async () => {
    const prod = await makeServer({ render: OK_RENDER, files: { 'a.js': 'x' }, devMode: false });
    expect((await fetch(`${prod.base}/a.js`)).headers.get('cache-control')).toBe('public, max-age=3600');

    const dev = await makeServer({ render: OK_RENDER, files: { 'a.js': 'x' }, devMode: true });
    expect((await fetch(`${dev.base}/a.js`)).headers.get('cache-control')).toBe('no-cache');
  });

  it('extensionless routes fall through to the renderer (not static)', async () => {
    const { base } = await makeServer({ render: OK_RENDER });
    const r = await fetch(`${base}/docs/intro`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('route:/docs/intro');
  });
});

describe('serve — path traversal containment', () => {
  it('does not serve a file outside the client root via ../', async () => {
    const { base } = await makeServer({ render: OK_RENDER });
    // Encoded traversal attempt toward the sibling secret dir + etc.
    const r = await fetch(`${base}/..%2f..%2f..%2fetc%2fpasswd`);
    // Falls through to the renderer (no static file matched); never leaks a file.
    expect(await r.text()).not.toContain('root:');
    expect(r.status).toBe(200); // handled by render, not a raw file read
  });

  it('does not treat a prefix-sibling directory as inside the root', async () => {
    // The naive `full.startsWith(clientDir)` bug would serve `<clientDir>-secret`.
    const { base } = await makeServer({ render: OK_RENDER });
    const r = await fetch(`${base}/../client-secret/leak.txt`);
    expect(await r.text()).not.toContain('TOP SECRET');
  });

  it('rejects malformed percent-encoding without crashing (falls through)', async () => {
    const { base } = await makeServer({ render: OK_RENDER });
    const r = await fetch(`${base}/bad%zz.js`);
    // No 500 from a thrown URIError — the request is handled by the renderer.
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('route:');
  });
});

describe('serve — error disclosure boundary', () => {
  const THROWING = `export function render(){throw new Error('BOOM secret detail');}`;

  it('production hides the stack and returns a generic 500', async () => {
    const { base } = await makeServer({ render: THROWING, devMode: false });
    const r = await fetch(`${base}/`);
    expect(r.status).toBe(500);
    const body = await r.text();
    expect(body).toBe('Internal Server Error');
    expect(body).not.toContain('BOOM secret detail');
  });

  it('dev exposes the error detail for debugging', async () => {
    const { base } = await makeServer({ render: THROWING, devMode: true });
    const r = await fetch(`${base}/`);
    expect(r.status).toBe(500);
    expect(await r.text()).toContain('BOOM secret detail');
  });
});
