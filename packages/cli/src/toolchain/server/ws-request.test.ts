import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { WebSocketHub, wsEncodeFrame, wsParseFrames, WS_OP_TEXT, type WebSocketClient } from './ws.js';

interface TestClient {
  readonly id: string;
  readonly socket: net.Socket;
  readonly messages: Record<string, unknown>[];
  waitForMessage(pred: (m: Record<string, unknown>) => boolean, timeoutMs?: number): Promise<Record<string, unknown>>;
}

interface Harness {
  readonly server: Server;
  readonly hub: WebSocketHub;
  readonly clients: WebSocketClient[];
}

async function startHub(): Promise<Harness> {
  const server = createServer();
  const clients: WebSocketClient[] = [];
  const hub = new WebSocketHub({
    server,
    path: '/ws',
    isOriginAllowed: () => true,
    heartbeatMs: 0,
    onMessage: () => {},
    onConnect: (client) => {
      clients.push(client);
    },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, hub, clients };
}

async function connectClient(harness: Harness): Promise<TestClient> {
  const port = (harness.server.address() as AddressInfo).port;
  const socket = net.connect(port, '127.0.0.1');
  await new Promise<void>((resolve) => socket.once('connect', resolve));

  const messages: Record<string, unknown>[] = [];
  const waiters: { pred: (m: Record<string, unknown>) => boolean; resolve: (m: Record<string, unknown>) => void }[] = [];
  let buffer = Buffer.alloc(0);
  let upgraded = false;

  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!upgraded) {
      const idx = buffer.indexOf('\r\n\r\n');
      if (idx === -1) return;
      upgraded = true;
      buffer = buffer.subarray(idx + 4);
    }
    const { frames, rest } = wsParseFrames(buffer);
    buffer = rest;
    for (const frame of frames) {
      if (frame.opcode !== WS_OP_TEXT) continue;
      const message = JSON.parse(frame.payload.toString()) as Record<string, unknown>;
      messages.push(message);
      for (let i = waiters.length - 1; i >= 0; i--) {
        const waiter = waiters[i] as { pred: (m: Record<string, unknown>) => boolean; resolve: (m: Record<string, unknown>) => void };
        if (waiter.pred(message)) {
          waiter.resolve(message);
          waiters.splice(i, 1);
        }
      }
    }
  });

  socket.write(
    'GET /ws HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n',
  );

  const id = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('client never connected')), 2000);
    const check = (): void => {
      const client = harness.clients[0];
      if (client !== undefined) {
        clearTimeout(timer);
        resolve(client.id);
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });

  return {
    id,
    socket,
    messages,
    waitForMessage(pred, timeoutMs = 2000) {
      const found = messages.find(pred);
      if (found !== undefined) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs);
        waiters.push({
          pred,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        });
      });
    },
  };
}

async function teardown(harness: Harness, client: TestClient | undefined): Promise<void> {
  harness.hub.closeAll();
  client?.socket.destroy();
  harness.server.closeAllConnections?.();
  await new Promise<void>((resolve) => harness.server.close(() => resolve()));
}

describe('WebSocketHub request/response', () => {
  it('sends to a specific client and resolves a correlated response', async () => {
    const harness = await startHub();
    let client: TestClient | undefined;
    try {
      client = await connectClient(harness);
      expect(harness.hub.clientIds).toEqual([client.id]);
      expect(harness.hub.sendToClient('missing', { type: 'ping' })).toBe(false);
      expect(harness.hub.sendToClient(client.id, { type: 'ping' })).toBe(true);

      const pending = harness.hub.sendRequest<{ html: string }>(client.id, { type: 'inspect_dom' }, 2000);
      const request = await client.waitForMessage((m) => m['type'] === 'inspect_dom');
      expect(typeof request['requestId']).toBe('string');
      client.socket.write(
        wsEncodeFrame(
          Buffer.from(
            JSON.stringify({ type: 'inspect_dom_response', requestId: request['requestId'], ok: true, payload: { html: '<html/>' } }),
          ),
          WS_OP_TEXT,
        ),
      );
      await expect(pending).resolves.toEqual({ html: '<html/>' });
    } finally {
      await teardown(harness, client);
    }
  });

  it('rejects when the browser reports a failure', async () => {
    const harness = await startHub();
    let client: TestClient | undefined;
    try {
      client = await connectClient(harness);
      const pending = harness.hub.sendRequest(client.id, { type: 'screenshot' }, 2000);
      const request = await client.waitForMessage((m) => m['type'] === 'screenshot');
      client.socket.write(
        wsEncodeFrame(
          Buffer.from(
            JSON.stringify({ type: 'screenshot_response', requestId: request['requestId'], ok: false, error: 'E_UNSUPPORTED' }),
          ),
          WS_OP_TEXT,
        ),
      );
      await expect(pending).rejects.toThrow('E_UNSUPPORTED');
    } finally {
      await teardown(harness, client);
    }
  });

  it('rejects when the request times out', async () => {
    const harness = await startHub();
    let client: TestClient | undefined;
    try {
      client = await connectClient(harness);
      await expect(harness.hub.sendRequest(client.id, { type: 'inspect_dom' }, 50)).rejects.toThrow(/timed out/);
    } finally {
      await teardown(harness, client);
    }
  });

  it('disconnects a single client on request', async () => {
    const harness = await startHub();
    let client: TestClient | undefined;
    try {
      client = await connectClient(harness);
      expect(harness.hub.disconnect('missing')).toBe(false);
      expect(harness.hub.disconnect(client.id)).toBe(true);
      expect(harness.hub.clientIds).toEqual([]);
      expect(harness.hub.sendToClient(client.id, { type: 'ping' })).toBe(false);
      expect(harness.hub.disconnect(client.id)).toBe(false);
    } finally {
      await teardown(harness, client);
    }
  });
});
