import { describe, it, expect } from 'vitest';
import { createEventLogger, makeEventId } from './events.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('event session identity', () => {
  it('assigns a non-empty sessionId when none is provided', () => {
    const lines: string[] = [];
    const logger = createEventLogger({ write: (line) => lines.push(line) });
    logger.send('build_started', { event: 'build_started' });
    const ev = JSON.parse(lines[0] as string) as { sessionId: string; eventId: string; schemaVersion: number };
    expect(ev.sessionId).toMatch(UUID);
    expect(ev.eventId).toMatch(UUID);
    expect(ev.schemaVersion).toBe(1);
  });

  it('keeps the provided sessionId and generates unique eventIds', () => {
    const lines: string[] = [];
    const logger = createEventLogger({ write: (line) => lines.push(line), sessionId: 'session-test' });
    logger.send('build_started', { event: 'build_started' });
    logger.send('build_started', { event: 'build_started' });
    const a = JSON.parse(lines[0] as string) as { sessionId: string; eventId: string };
    const b = JSON.parse(lines[1] as string) as { sessionId: string; eventId: string };
    expect(a.sessionId).toBe('session-test');
    expect(b.sessionId).toBe('session-test');
    expect(a.eventId).not.toBe(b.eventId);
  });

  it('makeEventId returns UUID-shaped ids', () => {
    expect(makeEventId()).toMatch(UUID);
    expect(makeEventId()).not.toBe(makeEventId());
  });
});
