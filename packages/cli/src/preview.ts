/**
 * `streetui preview` — serves the production build in `dist/client`.
 *
 * Completely independent of the dev server's compiler and HMR: no resolver,
 * no transform, no WebSocket. It only serves files and applies SPA fallback to
 * `index.html` when the app is client-only.
 */

import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { serveStaticFile } from './toolchain/server/static.js';
import type { Logger } from './logger.js';
import type { EventLogger } from './toolchain/json/events.js';
import { makeEventId } from './toolchain/json/events.js';

export interface PreviewOptions {
  readonly clientDir: string;
  readonly logger: Logger;
  readonly events?: EventLogger;
  readonly sessionId?: string;
  readonly host?: string;
  readonly port?: number;
  readonly strictPort?: boolean;
  /** Installed framework/CLI version. */
  readonly version?: string;
  /**
   * Serve `index.html` for extensionless routes. Defaults to true when the
   * build contains an `index.html` (client-only builds always do, and they also
   * write a manifest — so the manifest must not disable the fallback).
   */
  readonly spaFallback?: boolean;
}

export interface RunningPreview {
  readonly url: string;
  readonly port: number;
  stop(): Promise<void>;
}

export async function startPreview(options: PreviewOptions): Promise<RunningPreview> {
  const { clientDir, logger, events } = options;
  const sessionId = options.sessionId ?? makeEventId();
  const host = options.host ?? 'localhost';
  const hasIndex = existsSync(join(clientDir, 'index.html'));
  const spaFallback = options.spaFallback ?? hasIndex;

  const server: Server = createServer(async (req, res) => {
    const url = req.url ?? '/';
    const path = url.split('?')[0] ?? url;
    const extension = extname(path);

    if (extension !== '') {
      const served = await serveStaticFile(clientDir, path, res, { immutable: /-[0-9a-f]{8,}\.[^/]+$/.test(path) });
      if (served) return;
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    if (spaFallback) {
      const served = await serveStaticFile(clientDir, '/index.html', res, { maxAge: 0 });
      if (served) return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  let port = options.port ?? 4173;
  const strict = options.strictPort === true;
  let listening = false;

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => reject(error);
        server.once('error', onError);
        server.listen(port, host, () => {
          server.off('error', onError);
          resolve();
        });
      });
      listening = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE' && !strict && port !== 0) {
        port += 1;
        continue;
      }
      throw error;
    }
  }
  if (!listening) throw new Error(`Could not find an available port near ${port}`);

  const address = server.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : port;
  const url = `http://${host}:${actualPort}`;

  logger.success(`StreetUI preview running at ${url}`);
  if (spaFallback) logger.info('Serving production build with SPA fallback.');

  events?.emit({
    event: 'preview_ready',
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: 'streetui',
    timestamp: new Date().toISOString(),
    url: `${url}/`,
    port: actualPort,
    status: 'ready',
    ...(options.version !== undefined ? { version: options.version } : {}),
  });

  return {
    url,
    port: actualPort,
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}