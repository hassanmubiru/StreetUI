import { describe, it, expect, afterAll } from 'vitest';
import { createServer as createNetServer, connect } from 'node:net';
import { mkdtemp, rm, mkdir, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createProject } from './create.js';
import { resolveProject } from './project.js';
import { createDevServer } from './toolchain/server/dev-server.js';
import type { Logger } from './logger.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const PACKAGES = ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler', 'cli'];

const noopLogger: Logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };
const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const c of cleanups.splice(0)) await c();
});

async function wireDependencies(projectRoot: string): Promise<void> {
  const scoped = join(projectRoot, 'node_modules', '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of PACKAGES) {
    await symlink(join(repoRoot, 'packages', pkg), join(scoped, pkg), 'dir');
  }
}

async function makeServer(port: number) {
  const base = await mkdtemp(join(tmpdir(), 'streetui-sec-'));
  cleanups.push(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'app');
  await createProject({ targetDir: root, template: 'ssr', frameworkVersion: '3.0.2', logger: noopLogger });
  await wireDependencies(root);
  const project = await resolveProject(root, { requireEntry: true });
  const server = await createDevServer({ project, logger: noopLogger, port, strictPort: true });
  cleanups.push(() => server.stop());
  return { server, root };
}

/** Minimal raw HTTP/1.1 request helper (no connection reuse). */
function rawRequest(port: number, path: string, options: { method?: string; headers?: Record<string, string> } = {}): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const socket = connect(port, '127.0.0.1');
    let data = '';
    socket.on('connect', () => {
      const head = `${options.method ?? 'GET'} ${path} HTTP/1.1\r\nHost: localhost:${port}\r\nConnection: close\r\n`;
      const headerStr = Object.entries(options.headers ?? {})
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('');
      socket.write(head + headerStr + '\r\n');
    });
    socket.on('data', (chunk) => {
      data += chunk.toString('latin1');
    });
    socket.on('end', () => resolvePromise(data));
    socket.on('error', reject);
    setTimeout(() => socket.destroy(), 8000);
  });
}

/** Open a raw TCP connection, send a WebSocket handshake, and return the raw socket + first response chunk. */
function rawWebSocket(port: number, path: string, origin: string | undefined): Promise<{ socket: import('node:net').Socket; first: string }> {
  return new Promise((resolvePromise, reject) => {
    const socket = connect(port, '127.0.0.1');
    let first = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('ws handshake timeout'));
    }, 8000);
    socket.on('connect', () => {
      const key = Buffer.from('abcdefghijklmnopqrstuvwxyz').toString('base64');
      const lines = [
        `GET ${path} HTTP/1.1`,
        'Host: localhost:' + port,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
      ];
      if (origin !== undefined) lines.push(`Origin: ${origin}`);
      socket.write(lines.join('\r\n') + '\r\n\r\n');
    });
    socket.on('data', (chunk) => {
      first += chunk.toString('latin1');
      if (first.includes('\r\n\r\n')) {
        clearTimeout(timer);
        resolvePromise({ socket, first });
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

describe('dev server security', () => {
  it('blocks plain path traversal', async () => {
    const { server } = await makeServer(3100);
    for (const path of ['/../../etc/passwd', '/../secret', '/a/../../etc/passwd']) {
      const raw = await rawRequest(server.port, path);
      expect(raw).not.toContain('root:');
      expect(raw).not.toContain('password');
    }
  });

  it('blocks encoded path traversal', async () => {
    const { server } = await makeServer(3101);
    const path = '/%2e%2e/%2e%2e/etc/passwd';
    const raw = await rawRequest(server.port, path);
    expect(raw).not.toContain('root:');
  });

  it('never serves files outside the project', async () => {
    const { server } = await makeServer(3102);
    const res = await fetch(`http://127.0.0.1:${server.port}/@streetui/pkg/..%2f..%2f..%2fetc/passwd`);
    const body = await res.text();
    expect(body).not.toContain('root:');
  });

  it('tolerates unusual HTTP methods', async () => {
    const { server } = await makeServer(3103);
    const raw = await rawRequest(server.port, '/', { method: 'FROB' });
    expect(raw).toMatch(/HTTP\/1\.1 4\d\d|HTTP\/1\.1 5\d\d/);
  });

  it('rejects WebSocket upgrades from a disallowed origin', async () => {
    const { server } = await makeServer(3104);
    const { socket, first } = await rawWebSocket(server.port, '/__streetui_hmr', 'http://evil.example');
    expect(first).toContain('403');
    socket.destroy();
  });

  it('accepts a same-host WebSocket origin, then disconnects on malformed frames', async () => {
    const { server } = await makeServer(3105);
    const { socket, first } = await rawWebSocket(server.port, '/__streetui_hmr', `http://localhost:${server.port}`);
    expect(first).toContain('101');
    // A 64-bit payload length over the 1 MiB cap must be rejected and the
    // connection torn down — never a crash.
    const huge = Buffer.alloc(10);
    huge[0] = 0x81;
    huge[1] = 0x7f;
    huge.writeBigUInt64BE(BigInt(0x200000), 2); // 2 MiB
    socket.write(huge);
    await new Promise((r) => setTimeout(r, 500));
    expect(socket.destroyed || socket.readableEnded).toBe(true);
    socket.destroy();
  });

  it('fails to bind an already-in-use port in strict mode', async () => {
    await makeServer(3106); // occupies 3106
    const base = await mkdtemp(join(tmpdir(), 'streetui-sec-'));
    cleanups.push(() => rm(base, { recursive: true, force: true }));
    const root = join(base, 'app');
    await createProject({ targetDir: root, template: 'ssr', frameworkVersion: '3.0.2', logger: noopLogger });
    await wireDependencies(root);
    const project = await resolveProject(root, { requireEntry: true });
    await expect(
      createDevServer({ project, logger: noopLogger, port: 3106, strictPort: true }),
    ).rejects.toThrow();
  });
});
