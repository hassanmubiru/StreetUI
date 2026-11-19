import { describe, it, expect } from 'vitest';
import { wsEncodeFrame, wsParseFrames, WS_OP_TEXT, WS_OP_PING } from './ws.js';

describe('WebSocket frame codec', () => {
  it('encodes and decodes a short text frame', () => {
    const payload = Buffer.from('hello');
    const frame = wsEncodeFrame(payload, WS_OP_TEXT);
    const { frames } = wsParseFrames(frame);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.opcode).toBe(WS_OP_TEXT);
    expect(frames[0]?.payload.toString()).toBe('hello');
  });

  it('decodes a masked client frame', () => {
    // A client frame is masked. Build one manually.
    const payload = Buffer.from('hi');
    const mask = Buffer.from([1, 2, 3, 4]);
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) masked[i] = (payload[i] as number) ^ (mask[i % 4] as number);
    const header = Buffer.from([0x81, 0x80 | payload.length]);
    const frame = Buffer.concat([header, mask, masked]);
    const { frames } = wsParseFrames(frame);
    expect(frames[0]?.payload.toString()).toBe('hi');
  });

  it('decodes multiple frames in one buffer', () => {
    const a = wsEncodeFrame(Buffer.from('a'), WS_OP_TEXT);
    const b = wsEncodeFrame(Buffer.from('b'), WS_OP_TEXT);
    const { frames } = wsParseFrames(Buffer.concat([a, b]));
    expect(frames.map((f) => f.payload.toString())).toEqual(['a', 'b']);
  });

  it('parses a ping frame', () => {
    const frame = wsEncodeFrame(Buffer.alloc(0), WS_OP_PING);
    const { frames } = wsParseFrames(frame);
    expect(frames[0]?.opcode).toBe(WS_OP_PING);
  });

  it('handles a 16-bit length payload', () => {
    const payload = Buffer.alloc(300);
    payload.fill(0x61);
    const frame = wsEncodeFrame(payload, WS_OP_TEXT);
    const { frames } = wsParseFrames(frame);
    expect(frames[0]?.payload.length).toBe(300);
  });
});
