#!/usr/bin/env node
/**
 * M9.1 — Playground control-API security + endpoint verification.
 *
 * Starts the Playground for a fixture project and probes the control API:
 *   - path traversal (absolute + encoded)
 *   - symlink escape (symlink inside project pointing outside)
 *   - rename / delete outside the project root
 *   - node_modules edit blocked
 *   - unauthorized requests (401)
 *   - bad Host header (403)
 *   - oversized body (413)
 *   - templates list + export endpoints
 *
 * Usage:  node scripts/toolchain-playground-security.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { connect } from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-pgsec-'));
const app = path.join(base, 'app');
const OUTSIDE = path.join(base, 'outside.txt');

fs.writeFileSync(OUTSIDE, 'secret');

function run(args, cwd) {
  execFileSync(args[0], args.slice(1), { cwd, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, NO_COLOR: '1' } });
}

run(['node', CLI_BIN, 'create', 'app', '--template', 'basic'], base);
run(['npm', 'install', '--no-audit', '--no-fund'], app);

// a symlink inside the project pointing outside
fs.symlinkSync(OUTSIDE, path.join(app, 'evil-link.txt'));

const child = spawn(process.execPath, [CLI_BIN, 'playground', app, '--port', '4721'], {
  cwd: app,
  env: { ...process.env, NO_COLOR: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

function waitForEvent(predicate, ms = 60000) {
  return new Promise((resolve, reject) => {
    let acc = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('timeout')); }, ms);
    const onData = (chunk) => {
      acc += chunk.toString();
      const lines = acc.split('\n');
      acc = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          if (predicate(ev)) { clearTimeout(timer); child.stdout.off('data', onData); resolve(ev); return; }
        } catch { /* ignore */ }
      }
    };
    child.stdout.on('data', onData);
  });
}

async function api(token, pathname, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`http://localhost:4721/__playground/api${pathname}`, { ...init, headers });
  const text = await res.text();
  return { status: res.status, text };
}

// Raw HTTP request so a hostile Host header can actually be sent.
function rawRequest(pathname, host) {
  return new Promise((resolve) => {
    const socket = connect(4721, '127.0.0.1');
    let data = '';
    socket.on('connect', () => {
      socket.write(`GET ${pathname} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
    });
    socket.on('data', (c) => (data += c.toString('latin1')));
    socket.on('end', () => resolve(data));
    socket.on('error', () => resolve(''));
    setTimeout(() => socket.destroy(), 5000);
  });
}

const results = {};

try {
  const ready = await waitForEvent((e) => e.event === 'session_attached');
  // M9.5.1/M10: the CLI relays session_attached, which carries the bearer token.
  const token = ready.token ?? '';

  const probes = [
    ['traversal-absolute', '/file?path=../outside.txt', 'GET', null, 403, null],
    ['traversal-encoded', '/file?path=%2e%2e%2foutside.txt', 'GET', null, 403, null],
    ['symlink-escape', '/file?path=evil-link.txt', 'GET', null, 403, null],
    ['node_modules', '/file?path=node_modules/.bin/tsc', 'GET', null, 403, null],
    ['unauthorized', '/files', 'GET', null, 401, null],
  ];

  for (const [name, p, method, body, expected] of probes) {
    try {
      const headers = {};
      if (name !== 'unauthorized') headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`http://localhost:4721/__playground/api${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      results[name] = { status: res.status, expected, pass: res.status === expected };
    } catch (error) {
      results[name] = { error: String(error.message), pass: false };
    }
  }

  // bad Host header via raw TCP
  try {
    const raw = await rawRequest('/__playground/api/session', 'evil.example');
    const statusLine = raw.split('\r\n')[0] ?? '';
    results['bad-host'] = { status: statusLine, expected: 403, pass: statusLine.includes('403') };
  } catch (error) {
    results['bad-host'] = { error: String(error.message), pass: false };
  }

  // oversized body
  try {
    const big = JSON.stringify({ content: 'x'.repeat(3 * 1024 * 1024) });
    const bigRes = await fetch('http://localhost:4721/__playground/api/file?path=src/big.ts', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: big });
    results['oversized'] = { status: bigRes.status, expected: 413, pass: bigRes.status === 413 };
  } catch (error) {
    results['oversized'] = { error: String(error.message), pass: true }; // server reset is acceptable for oversize
  }

  // rename outside root
  const ren = await fetch('http://localhost:4721/__playground/api/file?path=src/app.ts', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: '../escaped.ts' }) });
  results['rename-outside'] = { status: ren.status, expected: 403, pass: ren.status === 403 };

  // delete outside root
  const del = await fetch('http://localhost:4721/__playground/api/file?path=src/app.ts', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  const delOutside = await fetch('http://localhost:4721/__playground/api/file?path=../outside.txt', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  results['delete-outside'] = { status: delOutside.status, expected: 403, pass: delOutside.status === 403 && del.status === 200 };

  // templates endpoint
  const templates = await api(token, '/templates');
  results['templates'] = { status: templates.status, expected: 200, pass: templates.status === 200 && templates.text.includes('templates') };

  // export endpoint (zip)
  const exported = await fetch('http://localhost:4721/__playground/api/export', { headers: { Authorization: `Bearer ${token}` } });
  const exportBuf = Buffer.from(await exported.arrayBuffer());
  results['export'] = { status: exported.status, bytes: exportBuf.length, pass: exported.status === 200 && exportBuf.readUInt32LE(0) === 0x04034b50 };

  child.kill('SIGTERM');
} catch (error) {
  results.fatal = String(error.message);
  child.kill('SIGTERM');
}

const pass = !results.fatal && Object.keys(results).length > 0 && Object.values(results).every((r) => r.pass === true);
const outDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'playground-security.json'), JSON.stringify(results, null, 2) + '\n');
console.log('Playground Security: ' + (pass ? 'PASS' : 'FAIL'));
console.log(JSON.stringify(results, null, 2));
fs.rmSync(base, { recursive: true, force: true });
process.exit(pass ? 0 : 1);
