import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeManifest, readManifest } from './manifest.js';
import { createEventLogger } from '../json/events.js';

describe('build manifest', () => {
  it('round-trips a manifest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'streetui-manifest-'));
    try {
      const manifest = {
        schemaVersion: 1 as const,
        framework: 'streetui' as const,
        entry: { js: '/assets/app-abc.js', css: '/assets/styles-abc.css' },
        modules: { '/src/main.ts': '/assets/app-abc.js' },
        assets: {},
        dynamicImports: {},
      };
      await writeManifest(dir, manifest);
      await expect(readManifest(dir)).resolves.toEqual(manifest);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns undefined when missing', async () => {
    await expect(readManifest('/nonexistent')).resolves.toBeUndefined();
  });
});

describe('JSON events', () => {
  it('emits a preview_ready event with the stable envelope', () => {
    const lines: string[] = [];
    const events = createEventLogger({ write: (l) => lines.push(l), now: () => new Date('2024-01-01T00:00:00Z') });
    events.emit({
      event: 'preview_ready',
      eventId: 'test-event-id',
      sessionId: 'test-session-id',
      schemaVersion: 1,
      framework: 'streetui',
      timestamp: '2024-01-01T00:00:00.000Z',
      url: 'http://localhost:3000/',
      port: 3000,
      status: 'ready',
      version: '3.0.2',
    });
    const parsed = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(parsed.event).toBe('preview_ready');
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.framework).toBe('streetui');
    expect(parsed.url).toBe('http://localhost:3000/');
    expect(parsed.version).toBe('3.0.2');
  });
});
