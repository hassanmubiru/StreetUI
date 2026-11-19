/**
 * Static file serving shared by the dev server, the production `start` server,
 * and `preview`. Containment is verified with `path.relative`; malformed
 * percent-encoding and null bytes are rejected.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, relative } from 'node:path';
import type { ServerResponse } from 'node:http';
import { safeDecode } from '../resolve/paths.js';

export const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

export function resolveStatic(clientDir: string, urlPath: string): string | undefined {
  const decoded = safeDecode(urlPath.split('?')[0] ?? '');
  if (decoded === undefined) return undefined;
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = join(clientDir, clean);
  const rel = relative(clientDir, full);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return full;
  return undefined;
}

export interface StaticOptions {
  readonly devMode?: boolean;
  readonly immutable?: boolean;
  readonly maxAge?: number;
}

export async function serveStaticFile(
  rootDir: string,
  urlPath: string,
  res: ServerResponse,
  options: StaticOptions = {},
): Promise<boolean> {
  const full = resolveStatic(rootDir, urlPath);
  if (full === undefined) return false;
  try {
    const info = await stat(full);
    if (!info.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control':
        options.immutable === true
          ? 'public, max-age=31536000, immutable'
          : options.devMode === true
            ? 'no-cache'
            : `public, max-age=${options.maxAge ?? 3600}`,
    });
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(full);
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res);
    });
    return true;
  } catch {
    return false;
  }
}