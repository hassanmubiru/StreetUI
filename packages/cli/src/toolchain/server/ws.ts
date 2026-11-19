/**
 * A minimal RFC 6455 WebSocket server for StreetUI HMR.
 *
 * Implements only what the dev server needs: text frames, continuation frames,
 * ping/pong, and close, with a 1 MiB payload cap. The browser side uses the
 * native WebSocket API, so no client library is required.
 *
 * The server speaks StreetUI's own HMR protocol (see `hmr/protocol.ts`); it is
 * not a general-purpose WebSocket framework.
 */

import { createHash } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 1024 * 1024;

const OP_CONTINUATION = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

interface RawFrame {
  readonly fin: boolean;
  readonly opcode: number;
  readonly payload: Buffer;
}

function encodeFrame(payload: Buffer, opcode: number): Buffer {
  const length = payload.length;
  let header: Buffer;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, payload]);
}

function parseFrames(buffer: Buffer): { frames: RawFrame[]; rest: Buffer } {
  const frames: RawFrame[] = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset] as number;
    const second = buffer[offset + 1] as number;
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let cursor = offset + 2;

    if (length === 126) {
      if (cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > buffer.length) break;
      const big = buffer.readBigUInt64BE(cursor);
      if (big > BigInt(MAX_PAYLOAD)) throw new Error('WebSocket frame exceeds the payload limit');
      length = Number(big);
      cursor += 8;
    }

    if (length > MAX_PAYLOAD) throw new Error('WebSocket frame exceeds the payload limit');

    let maskKey: Buffer | undefined;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      maskKey = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }

    if (cursor + length > buffer.length) break;
    let payload = buffer.subarray(cursor, cursor + length);
    if (maskKey !== undefined) {
      const unmasked = Buffer.allocUnsafe(payload.length);
      for (let i = 0; i < payload.length; i++) unmasked[i] = (payload[i] as number) ^ (maskKey[i % 4] as number);
      payload = unmasked;
    }
    frames.push({ fin, opcode, payload });
    offset = cursor + length;
  }

  return { frames, rest: buffer.subarray(offset) };
}

export interface WebSocketClient {
  readonly id: string;
  send(data: string): void;
  close(): void;
}

export interface WebSocketHubOptions {
  readonly server: Server;
  /** Pathname (without query) the hub listens on. */
  readonly path: string;
  /** Validate the Origin header; called for every upgrade. */
  readonly isOriginAllowed: (origin: string | undefined) => boolean;
  /** Heartbeat interval; 0 disables. Default 30s. */
  readonly heartbeatMs?: number;
  /** Called with every complete text message. */
  readonly onMessage: (message: string, client: WebSocketClient) => void;
  /** Called when a client connects. */
  readonly onConnect?: (client: WebSocketClient) => void;
  /** Called when a client disconnects. */
  readonly onDisconnect?: (client: WebSocketClient) => void;
}

interface ClientRecord {
  readonly id: string;
  readonly socket: Duplex;
  alive: boolean;
  buffer: Buffer;
  fragments: Buffer[];
  fragmentOpcode: number | undefined;
}

export class WebSocketHub {
  private readonly clients = new Map<string, ClientRecord>();
  private readonly heartbeat: ReturnType<typeof setInterval> | undefined;
  private nextId = 1;
  private readonly pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  private static readonly REQUEST_TIMEOUT_MS = 30000;

  constructor(private readonly options: WebSocketHubOptions) {
    options.server.on('upgrade', (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    });

    const heartbeatMs = options.heartbeatMs ?? 30000;
    if (heartbeatMs > 0) {
      this.heartbeat = setInterval(() => this.pingAll(), heartbeatMs);
      this.heartbeat.unref?.();
    }
  }

  get size(): number {
    return this.clients.size;
  }

  get clientIds(): string[] {
    return [...this.clients.keys()];
  }

  sendToClient(clientId: string, data: unknown): boolean {
    const record = this.clients.get(clientId);
    if (!record) return false;
    this.sendText(record, JSON.stringify(data));
    return true;
  }

  /** Politely close one client (used to expire stale preview clients). */
  disconnect(clientId: string): boolean {
    const record = this.clients.get(clientId);
    if (!record) return false;
    this.sendRaw(record, Buffer.alloc(0), OP_CLOSE);
    record.socket.end();
    this.remove(record);
    return true;
  }

  sendRequest<T>(clientId: string, data: unknown, timeoutMs = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const record = this.clients.get(clientId);
      if (!record) { reject(new Error(`Client ${clientId} not found`)); return; }
      const requestId = `r${Date.now()}${Math.random().toString(36).slice(2)}`;
      const payload = { ...(data as object), requestId };
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out`));
      }, timeoutMs);
      this.pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timeout });
      this.sendText(record, JSON.stringify(payload));
    });
  }

  broadcast(message: unknown): void {
    const text = JSON.stringify(message);
    for (const client of this.clients.values()) this.sendText(client, text);
  }

  closeAll(): void {
    if (this.heartbeat !== undefined) clearInterval(this.heartbeat);
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('WebSocket hub closed'));
    }
    this.pendingRequests.clear();
    for (const client of [...this.clients.values()]) {
      try {
        if (!client.socket.destroyed) client.socket.write(encodeFrame(Buffer.alloc(0), OP_CLOSE));
      } catch {
        /* ignore */
      }
      client.socket.end();
      this.clients.delete(client.id);
    }
  }

  private handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = request.url ?? '/';
    const path = url.split('?')[0] ?? url;
    if (path !== this.options.path) {
      socket.destroy();
      return;
    }
    if (!this.options.isOriginAllowed(request.headers.origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }

    const key = request.headers['sec-websocket-key'];
    if (typeof key !== 'string' || key.length === 0) {
      socket.destroy();
      return;
    }

    const accept = createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '\r\n',
      ].join('\r\n'),
    );

    const record: ClientRecord = {
      id: `c${this.nextId++}`,
      socket,
      alive: true,
      buffer: Buffer.alloc(0),
      fragments: [],
      fragmentOpcode: undefined,
    };
    this.clients.set(record.id, record);
    this.options.onConnect?.(this.publicClient(record));

    socket.on('data', (chunk: Buffer) => this.handleData(record, chunk));
    socket.on('close', () => this.remove(record));
    socket.on('error', () => this.remove(record));

    if (head.length > 0) this.handleData(record, head);
  }

  private handleData(record: ClientRecord, chunk: Buffer): void {
    record.buffer = Buffer.concat([record.buffer, chunk]);
    try {
      const { frames, rest } = parseFrames(record.buffer);
      record.buffer = rest;
      for (const frame of frames) this.handleFrame(record, frame);
    } catch (error) {
      this.sendText(record, JSON.stringify({ type: 'error', message: (error as Error).message }));
      record.socket.destroy();
    }
  }

  private handleFrame(record: ClientRecord, frame: RawFrame): void {
    const { fin, opcode, payload } = frame;

    if (opcode === OP_CLOSE) {
      try {
        if (!record.socket.destroyed) record.socket.write(encodeFrame(Buffer.alloc(0), OP_CLOSE));
      } catch {
        /* ignore */
      }
      this.remove(record);
      return;
    }
    if (opcode === OP_PING) {
      this.sendRaw(record, payload, OP_PONG);
      return;
    }
    if (opcode === OP_PONG) {
      record.alive = true;
      return;
    }
    if (opcode === OP_CONTINUATION) {
      if (record.fragmentOpcode === undefined) return;
      record.fragments.push(payload);
      if (!fin) return;
      const complete = Buffer.concat(record.fragments);
      const messageOpcode = record.fragmentOpcode;
      record.fragments = [];
      record.fragmentOpcode = undefined;
      if (messageOpcode === OP_TEXT) this.dispatch(record, complete);
      return;
    }
    if (opcode === OP_TEXT || opcode === OP_BINARY) {
      if (!fin) {
        record.fragmentOpcode = opcode;
        record.fragments = [payload];
        return;
      }
      if (opcode === OP_TEXT) this.dispatch(record, payload);
    }
  }

  private dispatch(record: ClientRecord, payload: Buffer): void {
    const text = payload.toString('utf8');
    try {
      const parsed = JSON.parse(text) as { requestId?: unknown; ok?: unknown; payload?: unknown; error?: unknown };
      if (typeof parsed.requestId === 'string') {
        const pending = this.pendingRequests.get(parsed.requestId);
        if (pending !== undefined) {
          this.pendingRequests.delete(parsed.requestId);
          clearTimeout(pending.timeout);
          if (parsed.ok === false) {
            pending.reject(new Error(String(parsed.error ?? 'request failed')));
          } else {
            pending.resolve(parsed.payload);
          }
        }
      }
    } catch {
      /* non-JSON frames are handled below */
    }
    try {
      this.options.onMessage(text, this.publicClient(record));
    } catch {
      /* a bad client message must never kill the server */
    }
  }

  private pingAll(): void {
    for (const client of this.clients.values()) {
      if (!client.alive) {
        client.socket.destroy();
        this.remove(client);
        continue;
      }
      client.alive = false;
      this.sendRaw(client, Buffer.alloc(0), OP_PING);
    }
  }

  private sendText(record: ClientRecord, text: string): void {
    this.sendRaw(record, Buffer.from(text, 'utf8'), OP_TEXT);
  }

  private sendRaw(record: ClientRecord, payload: Buffer, opcode: number): void {
    if (record.socket.destroyed) return;
    try {
      record.socket.write(encodeFrame(payload, opcode));
    } catch {
      /* ignore */
    }
  }

  private remove(record: ClientRecord): void {
    if (!this.clients.delete(record.id)) return;
    try {
      this.options.onDisconnect?.(this.publicClient(record));
    } catch {
      /* ignore */
    }
  }

  private publicClient(record: ClientRecord): WebSocketClient {
    return {
      id: record.id,
      send: (data: string) => this.sendText(record, data),
      close: () => {
        this.sendRaw(record, Buffer.alloc(0), OP_CLOSE);
        record.socket.end();
        this.remove(record);
      },
    };
  }
}

export const WS_MAGIC = GUID;

export { encodeFrame as wsEncodeFrame, parseFrames as wsParseFrames, OP_TEXT as WS_OP_TEXT, OP_PING as WS_OP_PING, OP_PONG as WS_OP_PONG, OP_CLOSE as WS_OP_CLOSE };