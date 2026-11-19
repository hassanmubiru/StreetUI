/**
 * StreetUI's development server.
 *
 * Built on `node:http` only. It serves the real SSR HTML, transforms every
 * TypeScript/JavaScript module on demand through StreetUI's resolver and
 * TypeScript transform, and speaks StreetUI's own HMR protocol over a
 * WebSocket. There is no bundler and no third-party dev server.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import type { ResolvedProject } from '../../project.js';
import type { Logger } from '../../logger.js';
import type { EventLogger } from '../json/events.js';
import { makeEventId } from '../json/events.js';
import { CliError, formatBuildFailure } from '../../diagnostics.js';
import { createResolver, fileToUrl, formatForFile, kindForFile, urlToFile } from '../resolve/resolver.js';
import { isInside, pathnameOf } from '../resolve/paths.js';
import { ModuleGraph } from '../graph/graph.js';
import { crawl } from '../graph/crawl.js';
import { TransformCache } from '../cache/transform-cache.js';
import { hashContent } from '../graph/graph.js';
import { transformModule, inlineSourceMap } from '../transform/typescript.js';
import { cssToDevModule, assetToDevModule, cssUrl, assetUrl } from '../transform/css.js';
import { createSsrRunner, type SsrRunner } from './ssr-runner.js';
import { WebSocketHub } from './ws.js';
import { serveStaticFile, MIME } from './static.js';
import { HMR_CLIENT_CODE } from '../hmr/client.js';
import { HMR_RUNTIME_CODE } from '../hmr/runtime.js';
import { HMR_PATH, HMR_CLIENT_PATH, HMR_RUNTIME_PATH, HMR_PROTOCOL_VERSION, type HmrServerMessage } from '../hmr/protocol.js';
import { watchRecursive, type Watcher } from '../watch/watcher.js';

export interface DevServerOptions {
  readonly project: ResolvedProject;
  readonly logger: Logger;
  readonly events?: EventLogger;
  readonly sessionId?: string;
  readonly host?: string;
  readonly port?: number;
  /** When true, a busy port is an error instead of auto-incrementing. */
  readonly strictPort?: boolean;
  /**
   * Optional mount hook. Called for every non-HMR request before the default
   * handler. Return true to signal the request was fully handled. This lets
   * layers like the Playground mount their own routes on the same server
   * without duplicating the dev server.
   */
  readonly beforeRequest?: (
    req: IncomingMessage,
    res: ServerResponse,
    ctx: { url: string; path: string },
  ) => Promise<boolean> | boolean;
}

export interface RunningDevServer {
  readonly url: string;
  readonly port: number;
  readonly host: string;
  readonly hub: import('./ws.js').WebSocketHub;
  stop(): Promise<void>;
}

export interface DevServerInternals {
  readonly server: Server;
  readonly graph: ModuleGraph;
  readonly ssr: SsrRunner | undefined;
}

const PUBLIC_PREFIX = 'STREETUI_PUBLIC_';

function publicEnv(): Record<string, string> {
  const env: Record<string, string> = { NODE_ENV: 'development' };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(PUBLIC_PREFIX) && value !== undefined) env[key] = value;
  }
  return env;
}

function send(res: ServerResponse, status: number, contentType: string, body: string | Buffer): void {
  if (res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

const sendJs = (res: ServerResponse, code: string): void => send(res, 200, 'text/javascript; charset=utf-8', code);
const sendHtml = (res: ServerResponse, html: string): void => send(res, 200, 'text/html; charset=utf-8', html);

function injectHtml(html: string, entryUrl: string): string {
  const tags =
    `<script type="module" src="${entryUrl}"></script>` +
    `<script type="module" src="${HMR_CLIENT_PATH}"></script>`;
  if (html.includes('</body>')) return html.replace('</body>', `${tags}</body>`);
  return `${html}${tags}`;
}

function hasQuery(url: string, key: string, value: string): boolean {
  const query = url.split('?')[1] ?? '';
  return new URLSearchParams(query).get(key) === value;
}

function packageNameForFile(file: string): string | undefined {
  const marker = `${sep}node_modules${sep}`;
  const index = file.indexOf(marker);
  if (index < 0) return undefined;
  const after = file.slice(index + marker.length).split(sep);
  if ((after[0] ?? '').startsWith('@')) return `${after[0]}/${after[1] ?? ''}`;
  return after[0];
}

export async function createDevServer(options: DevServerOptions): Promise<RunningDevServer> {
  const { project, logger, events } = options;
  const sessionId = options.sessionId ?? makeEventId();
  const config = project.config;
  const root = config.root;
  const env = publicEnv();
  const frameworkVersion =
    project.packageJson.devDependencies?.['@streetui/cli'] ??
    project.packageJson.devDependencies?.['streetui'] ??
    project.packageJson.dependencies?.['streetui'] ??
    project.packageJson.version;

  if (!existsSync(config.clientEntry)) {
    throw new CliError(`Client entry not found: ${config.clientEntry}`, {
      suggestion: 'Create the entry file or set "clientEntry" in streetui.config.ts.',
    });
  }

  const resolver = createResolver({
    root,
    ...(config.extensions !== undefined ? { extensions: config.extensions } : {}),
    ...(config.aliases !== undefined ? { aliases: config.aliases } : {}),
  });

  const cacheDir = join(root, '.streetui-cache');
  const ssr = existsSync(config.serverEntry)
    ? createSsrRunner({ root, serverEntry: config.serverEntry, cacheDir, env })
    : undefined;

  const clientEntryUrl = fileToUrl(config.clientEntry, root);
  if (clientEntryUrl === undefined) {
    throw new CliError(`Client entry is outside the project root: ${config.clientEntry}`);
  }

  let graph: ModuleGraph;
  try {
    const crawled = crawl({ entry: config.clientEntry, root, mode: 'development' });
    graph = crawled.graph;
    for (const diagnostic of crawled.diagnostics) logger.warn(diagnostic.message);
  } catch (error) {
    throw new CliError(`Failed to build the module graph: ${(error as Error).message}`);
  }

  const cache = new TransformCache();
  const version = Date.now();
  let versionCounter = 0;

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  const sockets = new Set<import('node:net').Socket>();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  const isOriginAllowed = (origin: string | undefined): boolean => {
    if (origin === undefined) return true;
    try {
      const parsed = new URL(origin);
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
    } catch {
      return false;
    }
  };

  const RING_BUFFER_MAX = 1000;
  type BrowserEntry = { timestamp: string; level: string; message: string; stack?: string; file?: string; line?: number; column?: number };
  const browserLog: BrowserEntry[] = [];
  const browserErrors: BrowserEntry[] = [];

  function addToRingBuffer(entry: BrowserEntry): void {
    if (entry.level === 'error') {
      browserErrors.push(entry);
      if (browserErrors.length > RING_BUFFER_MAX) browserErrors.shift();
    }
    browserLog.push(entry);
    if (browserLog.length > RING_BUFFER_MAX) browserLog.shift();
  }

  let serverUrl = '';
  const hub = new WebSocketHub({
    server,
    path: HMR_PATH,
    isOriginAllowed,
    onConnect(client) {
      client.send(JSON.stringify({ type: 'connected', protocol: HMR_PROTOCOL_VERSION }));
      events?.emit({
        event: 'browser_connected',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        url: serverUrl,
        clientId: client.id,
      });
    },
    onDisconnect(client) {
      events?.emit({
        event: 'browser_disconnected',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        url: serverUrl,
        clientId: client.id,
      });
    },
    onMessage(message, client) {
      let parsed: { type?: unknown };
      try {
        parsed = JSON.parse(message) as { type?: unknown };
      } catch {
        return;
      }
      if (parsed.type === 'runtime-error') {
        const runtimeMessage = (parsed as { message?: unknown }).message;
        const stack = (parsed as { stack?: unknown }).stack;
        logger.error(`Runtime error in browser: ${String(runtimeMessage)}`);
        events?.emit({
          event: 'runtime_error',
          eventId: makeEventId(),
            sessionId,
            schemaVersion: 1,
          framework: 'streetui',
          timestamp: new Date().toISOString(),
          message: String(runtimeMessage),
          ...(typeof stack === 'string' ? { stack } : {}),
        });
        const ts = new Date().toISOString();
        events?.emit({
          event: 'browser_error',
          eventId: makeEventId(),
            sessionId,
            schemaVersion: 1,
          framework: 'streetui',
          timestamp: ts,
          message: String(runtimeMessage),
          clientId: client.id,
          ...(typeof stack === 'string' ? { stack } : {}),
        });
        addToRingBuffer({ timestamp: ts, level: 'error', message: String(runtimeMessage), ...(typeof stack === 'string' ? { stack } : {}) });
      }
      if (parsed.type === 'log') {
        const level = (parsed as { level?: unknown }).level as 'info' | 'warn' | 'error' | undefined;
        const logMessage = (parsed as { message?: unknown }).message;
        const ts = new Date().toISOString();
        events?.emit({
          event: 'browser_console',
          eventId: makeEventId(),
            sessionId,
            schemaVersion: 1,
          framework: 'streetui',
          timestamp: ts,
          level: level ?? 'info',
          message: String(logMessage),
          clientId: client.id,
        });
        addToRingBuffer({ timestamp: ts, level: level ?? 'info', message: String(logMessage) });
      }
      if (parsed.type === 'hmr_applied') {
        const updateId = (parsed as { updateId?: unknown }).updateId;
        events?.emit({
          event: 'hmr_applied',
          eventId: makeEventId(),
            sessionId,
            schemaVersion: 1,
          framework: 'streetui',
          timestamp: new Date().toISOString(),
          file: String(updateId),
          accepted: true,
        });
      }
      if (parsed.type === 'hmr_failed') {
        const updateId = (parsed as { updateId?: unknown }).updateId;
        const error = (parsed as { error?: unknown }).error;
        events?.emit({
          event: 'hmr_failed',
          eventId: makeEventId(),
            sessionId,
            schemaVersion: 1,
          framework: 'streetui',
          timestamp: new Date().toISOString(),
          file: String(updateId),
          error: String(error),
        });
      }
    },
  });

  const broadcast = (message: HmrServerMessage): void => hub.broadcast(message);

  const transformError = (file: string, problems: readonly { message: string; line?: number; file?: string }[]): string => {
    const detail = formatBuildFailure(problems.map((p) => ({ message: p.message })));
    return [
      `throw new Error(${JSON.stringify(`StreetUI transform error in ${file}:\n${detail}`)});`,
      `export {};`,
    ].join('\n');
  };

  const serveModule = async (file: string, url: string, res: ServerResponse): Promise<void> => {
    const kind = kindForFile(file);

    if (kind === 'css') {
      const css = readFileSync(file, 'utf8');
      if (hasQuery(url, 'streetui', 'js')) {
        sendJs(res, cssToDevModule(css, file));
      } else {
        send(res, 200, 'text/css; charset=utf-8', css);
      }
      return;
    }

    if (kind === 'asset') {
      if (hasQuery(url, 'streetui', 'url')) {
        sendJs(res, assetToDevModule(pathnameOf(url)));
        return;
      }
      const body = readFileSync(file);
      send(res, 200, MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', body);
      return;
    }

    if (kind === 'json') {
      const json = readFileSync(file, 'utf8');
      sendJs(res, `export default ${json};\n`);
      return;
    }

    if (kind !== 'ts' && kind !== 'js') {
      send(res, 500, 'text/plain; charset=utf-8', `Unsupported module type: ${file}`);
      return;
    }

    // CommonJS modules cannot be imported by a browser as ESM. Fail with a
    // useful diagnostic instead of serving invalid JavaScript.
    if (kind === 'js' && formatForFile(file) === 'cjs') {
      const pkg = packageNameForFile(file);
      const importer = [...(graph.get(file)?.importers ?? [])][0];
      const message =
        `The module ${file} is CommonJS and cannot be executed in the browser.\n` +
        (pkg !== undefined ? `Package: ${pkg}\n` : '') +
        (importer !== undefined ? `Importing module: ${importer}\n` : '') +
        `Module format: CommonJS\n` +
        `Reason: StreetUI serves browser-native ESM; CommonJS package entry points ` +
        `are not converted.\n` +
        `What to do: pick an ESM entry of the package (e.g. an "import"/"module" ` +
        `condition or a .mjs build), or wrap the dependency behind a tiny ESM ` +
        `adapter that re-exports the parts you need.`;
      broadcast({ type: 'error', diagnostics: [{ message, file, importer }], fatal: false });
      logger.error(message);
      send(res, 500, 'text/plain; charset=utf-8', message);
      return;
    }

    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch (error) {
      send(res, 500, 'text/plain; charset=utf-8', `Could not read ${file}: ${(error as Error).message}`);
      return;
    }

    const hash = hashContent(source);
    let result = cache.get(file, hash);
    if (result === undefined) {
      result = transformModule(source, {
        fileName: file,
        moduleId: file,
        mode: 'development',
        env,
        resolve(specifier) {
          const resolved = resolver.resolveBrowser(specifier, file);
          if (resolved === undefined || resolved.kind === 'builtin') return undefined;
          const depUrl = fileToUrl(resolved.file, root);
          if (depUrl === undefined) return undefined;
          if (resolved.kind === 'css') return { url: cssUrl(depUrl, version), kind: resolved.kind, id: resolved.file };
          if (resolved.kind === 'asset') return { url: assetUrl(depUrl), kind: resolved.kind, id: resolved.file };
          if (resolved.kind === 'json') return { url: `${depUrl}?streetui=js`, kind: resolved.kind, id: resolved.file };
          return { url: `${depUrl}?t=${version}`, kind: resolved.kind, id: resolved.file };
        },
        resolveId(specifier) {
          return resolver.resolveBrowser(specifier, file)?.file;
        },
      });
      if (result.diagnostics.length > 0) {
        const body = transformError(file, result.diagnostics.map((d) => ({ message: d.message })));
        broadcast({ type: 'error', diagnostics: result.diagnostics, fatal: false });
        send(res, 500, 'text/javascript; charset=utf-8', body);
        return;
      }
      cache.set(file, hash, result);
    }

    const map = result.sourceMap !== undefined ? inlineSourceMap(result.sourceMap) : '';
    sendJs(res, `${result.code}${map}`);
  };

  const renderSsr = async (url: string, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let html: string;
    let status = 200;
    const headers: Record<string, string> = {};

    if (ssr !== undefined) {
      try {
        const result = await ssr.render({ url, method: req.method ?? 'GET', headers: req.headers });
        html = result.html;
        status = result.status ?? 200;
        Object.assign(headers, result.headers ?? {});
      } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        logger.error(`SSR render failed for ${url}: ${message}`);
        send(res, 500, 'text/plain; charset=utf-8', `StreetUI server error while rendering ${url}:\n\n${message}`);
        return;
      }
    } else {
      const indexPath = join(root, 'index.html');
      if (existsSync(indexPath)) {
        html = readFileSync(indexPath, 'utf8');
      } else {
        html = [
          '<!doctype html>',
          '<html lang="en">',
          '<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>',
          '<body><div id="app"></div></body>',
          '</html>',
        ].join('\n');
      }
    }

    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
    res.end(injectHtml(html, clientEntryUrl));
  };

  const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = req.url ?? '/';
    const path = pathnameOf(url);

    try {
      if (path === HMR_PATH) {
        send(res, 426, 'text/plain; charset=utf-8', 'Upgrade Required');
        return;
      }
      if (path === HMR_CLIENT_PATH) {
        sendJs(res, HMR_CLIENT_CODE);
        return;
      }
      if (path === HMR_RUNTIME_PATH) {
        sendJs(res, HMR_RUNTIME_CODE);
        return;
      }

      if (options.beforeRequest !== undefined) {
        const handled = await options.beforeRequest(req, res, { url, path });
        if (handled) return;
      }

      const file = urlToFile(url, root);
      if (file !== undefined && isInside(root, file) && existsSync(file)) {
        try {
          if (statSync(file).isFile()) {
            await serveModule(file, url, res);
            return;
          }
        } catch {
          /* fall through to SSR */
        }
      }

      // Public directory fallback (public assets are served from the root).
      if (existsSync(config.publicDir)) {
        const served = await serveStaticFile(config.publicDir, path, res, { devMode: true });
        if (served) return;
      }

      await renderSsr(url, req, res);
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      logger.error(`Request failed for ${url}: ${message}`);
      if (!res.writableEnded && !res.headersSent) send(res, 500, 'text/plain; charset=utf-8', message);
    }
  };

  const handleChange = async (file: string): Promise<void> => {
    if (!isInside(root, file)) return;
    const rel = relative(root, file);
    if (rel.startsWith('node_modules')) return;

    events?.emit({
      event: 'file_changed',
      eventId: makeEventId(),
      sessionId,
      schemaVersion: 1,
      framework: 'streetui',
      timestamp: new Date().toISOString(),
      file,
    });

    if (ssr !== undefined && ssr.getFiles().has(file)) {
      try {
        await ssr.reload();
        broadcast({ type: 'reload', reason: 'server module changed' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`SSR rebuild failed: ${message}`);
        broadcast({ type: 'error', diagnostics: [{ message }], fatal: false });
      }
      return;
    }

    cache.invalidate(file);
    graph.invalidate(file);
    const kind = kindForFile(file);
    const cacheVersion = ++versionCounter;

    if (kind === 'css') {
      const depUrl = fileToUrl(file, root);
      if (depUrl === undefined) return;
      const update = { id: file, url: cssUrl(depUrl, cacheVersion), accepted: true, kind: 'css' as const };
      broadcast({ type: 'update', updates: [update] });
      events?.emit({
        event: 'module_updated',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        id: file,
        url: update.url,
        accepted: true,
      });
      return;
    }

    if (kind === 'ts' || kind === 'js') {
      let source: string;
      try {
        source = readFileSync(file, 'utf8');
      } catch (error) {
        broadcast({ type: 'error', diagnostics: [{ message: (error as Error).message }], fatal: false });
        return;
      }
      const accepted = graph.get(file)?.hmrAccepted ?? /import\s*\.\s*meta\s*\.\s*hot/.test(source);
      const depUrl = fileToUrl(file, root);
      if (depUrl === undefined) {
        broadcast({ type: 'reload', reason: 'module outside project root' });
        return;
      }
      const update = { id: file, url: `${depUrl}?t=${cacheVersion}`, accepted, kind: 'js' as const };
      broadcast({ type: 'update', updates: [update] });
      events?.emit({
        event: 'module_updated',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
        id: file,
        url: update.url,
        accepted,
      });
      return;
    }

    broadcast({ type: 'reload', reason: `${kind} file changed` });
  };

  const watcher: Watcher = watchRecursive({
    root,
    ignored: (file) => !isInside(root, file) || /[/\\]node_modules([/\\]|$)|[/\\]dist([/\\]|$)|[/\\]\.git([/\\]|$)|[/\\]\.streetui-cache([/\\]|$)/.test(file),
    onChange: (file) => {
      void handleChange(file);
    },
  });

  const host = options.host ?? config.host;
  const preferred = options.port ?? config.port;
  const strict = options.strictPort === true;
  let port = preferred;
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
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EADDRINUSE' && !strict && preferred !== 0) {
        port += 1;
        continue;
      }
      watcher.close();
      hub.closeAll();
      throw new CliError(`Could not start the dev server on ${host}:${port}: ${(error as Error).message}`, {
        suggestion: strict ? 'Choose a free port or omit --port to auto-select one.' : 'Check that the port is available.',
      });
    }
  }

  if (!listening) {
    watcher.close();
    hub.closeAll();
    throw new CliError(`Could not find an available port near ${preferred}.`);
  }

  const address = server.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : port;
  const url = `http://${host}:${actualPort}`;
  serverUrl = url;

  logger.success(`StreetUI dev server ready at ${url}`);
  logger.info('Press Ctrl+C to stop.');

  events?.emit({
    event: 'compilation_completed',
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: 'streetui',
    timestamp: new Date().toISOString(),
    mode: 'development',
    modules: graph.nodes.size,
    durationMs: 0,
  });
  events?.emit({
    event: 'server_started',
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: 'streetui',
    timestamp: new Date().toISOString(),
    url,
    port: actualPort,
    host,
    version: frameworkVersion,
  });
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
    version: frameworkVersion,
  });

  let stopping = false;
  return {
    url,
    port: actualPort,
    host,
    hub,
    async stop() {
      if (stopping) return;
      stopping = true;
      watcher.close();
      hub.closeAll();
      await ssr?.close().catch(() => undefined);
      for (const socket of sockets) {
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
      }
      sockets.clear();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      events?.emit({
        event: 'server_stopped',
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: 'streetui',
        timestamp: new Date().toISOString(),
      });
    },
  };
}