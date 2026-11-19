import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPreview } from './preview.js';
import type { Logger } from './logger.js';

const noopLogger: Logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };
const cleanups: Array<() => Promise<void>> = [];
afterAll(async () => {
  for (const c of cleanups.splice(0)) await c();
});

describe('preview server', () => {
  it('serves static files and applies SPA fallback to index.html', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'streetui-preview-'));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    await writeFile(join(dir, 'index.html'), '<!doctype html><body>preview app</body>', 'utf8');
    await mkdir(join(dir, 'assets'), { recursive: true });
    await writeFile(join(dir, 'assets', 'app-a1b2c3d4.js'), 'console.log(1)', 'utf8');

    const running = await startPreview({ clientDir: dir, logger: noopLogger });
    cleanups.push(() => running.stop());

    const root = await fetch(`${running.url}/`);
    expect((await root.text())).toContain('preview app');

    const spa = await fetch(`${running.url}/deep/route`);
    expect(spa.status).toBe(200);
    expect((await spa.text())).toContain('preview app');

    const asset = await fetch(`${running.url}/assets/app-a1b2c3d4.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toContain('immutable');

    const missing = await fetch(`${running.url}/nope.txt`);
    expect(missing.status).toBe(404);
  });
});
