/**
 * The StreetUI HTTP server (Phases 5 & 8). Built on Node's standard `node:http`
 * — no Express, no third-party server. It serves the built client assets as
 * static files and delegates every other request to the project's server
 * bundle, which exports a `render(request)` function producing full HTML.
 *
 * The same server backs both `dev` (with live-reload injection) and `start`
 * (production). Dev-only behaviour is gated behind the `reload` option.
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The contract a project's server entry must satisfy. */
export interface RenderRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string | string[] | undefined>;
}
export interface RenderResult {
  readonly html: string;
  readonly status?: number;
  readonly headers?: Record<string, string>;
}
export type RenderFn = (request: RenderRequest) => RenderResult | Promise<RenderResult>;

export interface ServeOptions {
  readonly clientDir: string;
  readonly serverBundle: string;
  readonly host: string;
  readonly port: number;
  /** When set, HTML responses get a live-reload snippet + an SSE endpoint. */
  readonly reload?: ReloadHub;
  /**
   * Dev mode: re-import the server bundle on every request so edits are picked
   * up without restarting. In production the bundle is loaded once.
   */
  readonly devMode?: boolean;
}

/** A running server plus the resolved address and a stop handle. */
export interface RunningServer {
  readonly server: Server;
  readonly url: string;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** Live-reload coordination for dev: tracks SSE clients and pushes events. */
export class ReloadHub {
  private readonly clients = new Set<ServerResponse>();
  static readonly PATH = '/__streetui_reload';

  /** The snippet injected before `</body>` so the page listens for reloads. */
  static readonly snippet =
    `<script>(function(){try{new EventSource("${ReloadHub.PATH}").onmessage=function(e){if(e.data==="reload")location.reload()}}catch(_){}})();</script>`;

  handle(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  /** Tell every connected browser to reload. */
  triggerReload(): void {
    for (const res of this.clients) res.write('data: reload\n\n');
  }

  closeAll(): void {
    for (const res of this.clients) res.end();
    this.clients.clear();
  }
}

/**
 * Resolve a URL path to a file inside `clientDir`, guarding against escapes.
 *
 * Security notes (production hardening, v0.8):
 *   - Malformed percent-encoding (`decodeURIComponent` throwing) is rejected
 *     rather than allowed to bubble up as a 500.
 *   - Null-byte injection (`\0`) is rejected — it can truncate paths in some
 *     syscalls.
 *   - Containment is verified with `path.relative`, NOT a raw `startsWith`
 *     prefix check: a prefix check treats a sibling dir like `<clientDir>-x` as
 *     "inside" and is a real traversal hole. `relative` yields a `..`-leading or
 *     absolute path exactly when the target escapes the root.
 */
function resolveStatic(clientDir: string, urlPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0] ?? '');
  } catch {
    return undefined; // malformed percent-encoding
  }
  if (decoded.includes('\0')) return undefined; // null-byte injection
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = join(clientDir, clean);
  const rel = relative(clientDir, full);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return full;
  return undefined; // escaped the client root
}

async function tryServeStatic(
  clientDir: string,
  urlPath: string,
  res: ServerResponse,
  devMode: boolean,
): Promise<boolean> {
  const full = resolveStatic(clientDir, urlPath);
  if (full === undefined) return false;
  try {
    const info = await stat(full);
    if (!info.isFile()) return false;
    const body = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full)] ?? 'application/octet-stream',
      // Never let a browser MIME-sniff a served asset into something executable.
      'X-Content-Type-Options': 'nosniff',
      // Dev must always re-fetch; production may cache immutable build output.
      'Cache-Control': devMode ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

/** Import the built server bundle and return its `render` export. */
async function loadRender(serverBundle: string): Promise<RenderFn> {
  const mod = (await import(`${pathToFileURL(serverBundle).href}?t=${Date.now()}`)) as {
    render?: RenderFn;
    default?: RenderFn | { render?: RenderFn };
  };
  const candidate =
    mod.render ??
    (typeof mod.default === 'function' ? mod.default : mod.default?.render);
  if (typeof candidate !== 'function') {
    throw new Error(`Server entry ${serverBundle} must export a "render(request)" function.`);
  }
  return candidate;
}

function injectReload(html: string): string {
  if (html.includes('</body>')) return html.replace('</body>', `${ReloadHub.snippet}</body>`);
  return html + ReloadHub.snippet;
}

/** Start the HTTP server and resolve once it is actually listening. */
export async function startServer(options: ServeOptions): Promise<RunningServer> {
  // In production, load the render function once. In dev, load per request so
  // rebuilt bundles are picked up (loadRender cache-busts the import URL).
  let cachedRender: RenderFn | undefined;
  const getRender = async (): Promise<RenderFn> => {
    if (options.devMode === true) return loadRender(options.serverBundle);
    if (cachedRender === undefined) cachedRender = await loadRender(options.serverBundle);
    return cachedRender;
  };
  // Fail fast on a broken bundle before we start listening.
  await getRender();

  const server = createHttpServer((req, res) => {
    void handleRequest(req, res, getRender, options);
  });

  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolvePromise();
    });
  });

  const url = `http://${options.host}:${options.port}`;
  return {
    server,
    url,
    close: () =>
      new Promise<void>((resolveClose) => {
        options.reload?.closeAll();
        server.close(() => resolveClose());
      }),
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  getRender: () => Promise<RenderFn>,
  options: ServeOptions,
): Promise<void> {
  const url = req.url ?? '/';

  // Dev live-reload channel.
  if (options.reload && url === ReloadHub.PATH) {
    options.reload.handle(req, res);
    return;
  }

  // Static assets first (only paths with an extension, so routes fall through).
  if (extname(url.split('?')[0] ?? '') !== '') {
    const served = await tryServeStatic(options.clientDir, url, res, options.devMode === true);
    if (served) return;
  }

  // Otherwise, server-render the requested route.
  try {
    const render = await getRender();
    const result = await render({
      url,
      method: req.method ?? 'GET',
      headers: req.headers,
    });
    const status = result.status ?? 200;
    const html = options.reload ? injectReload(result.html) : result.html;
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...result.headers });
    res.end(html);
  } catch (err) {
    // Always surface the failure server-side for operators.
    // eslint-disable-next-line no-console
    console.error(`[StreetUI] render error for ${url}:`, err);
    // But only leak stack traces / internal detail in dev. A production server
    // must not disclose stacks, file paths or env-derived strings to clients
    // (information-disclosure hardening, v0.8 §18/§19).
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    if (options.devMode === true) {
      const message = err instanceof Error ? err.stack ?? err.message : String(err);
      res.end(`StreetUI server error while rendering ${url}:\n\n${message}`);
    } else {
      res.end('Internal Server Error');
    }
  }
}
