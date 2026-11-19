/**
 * StreetUI Playground — local orchestration.
 *
 * Reuses the existing StreetUI dev server (`createDevServer` from
 * `@streetui/cli`) and mounts the Playground UI + control API on the same
 * server via the `beforeRequest` hook. The Playground is an orchestration layer
 * only: the actual application is executed by the StreetUI toolchain.
 */

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir, stat, lstat, writeFile, mkdir, rm, rename, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { zipSync } from 'fflate';
import { createDevServer, createProject, buildProject, makeEventId } from '@streetui/cli';
import type { ResolvedProject, EventLogger, StreetUIEvent, StreetUIEventType, Logger } from '@streetui/cli';
import { AutomationManager, AutomationError, type AutomationEngine, type Viewport, type InteractionInput } from './automation.js';

const here = dirname(fileURLToPath(import.meta.url));
export const PLAYGROUND_STATIC = join(here, 'ui');
export const PLAYGROUND_PREFIX = '/__playground';

export interface PlaygroundOptions {
  readonly project: ResolvedProject;
  readonly logger: Logger;
  readonly host?: string;
  readonly port?: number;
  readonly token?: string;
  readonly sessionId?: string;
  /** Maximum number of JSONL events kept in the in-memory diagnostics buffer. */
  readonly eventsMaxSize?: number;
}

export interface RunningPlayground {
  readonly url: string;
  readonly port: number;
  readonly host: string;
  readonly previewUrl: string;
  readonly token: string;
  readonly sessionId: string;
  stop(): Promise<void>;
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Resolve a project-relative path and confirm it stays inside the project.
 * Control-path file operations reject `node_modules` (workspace symlinks there
 * escape the root and are not user source). The realpath of the target is also
 * checked to block symlink escapes.
 */
async function safeResolve(root: string, maybeRel: string): Promise<string> {
  const full = resolve(root, maybeRel);
  if (!isInside(root, full)) throw new HttpError(403, 'path outside project');
  const rel = relative(root, full);
  if (rel.split(sep)[0] === 'node_modules') throw new HttpError(403, 'node_modules is not editable');
  try {
    const real = await realpath(full);
    if (!isInside(root, real)) throw new HttpError(403, 'symlink escape blocked');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const parent = dirname(full);
    const realParent = await realpath(parent).catch(() => parent);
    if (!isInside(root, realParent)) throw new HttpError(403, 'symlink escape blocked');
  }
  return full;
}

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.turbo', '.streetui-cache']);

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(join(dir, entry.name));
      } else {
        out.push(relative(root, join(dir, entry.name)));
      }
    }
  };
  await walk(root);
  return out.sort();
}

const MAX_BODY = 2 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');
      if (body.length > MAX_BODY) {
        reject(new HttpError(413, 'body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolvePromise(body));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, value: unknown): void {
  if (res.writableEnded || res.headersSent) return;
  // Serialize before touching headers so a bad payload can never produce a
  // half-written response or a ERR_HTTP_HEADERS_SENT crash.
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveStatic(res: ServerResponse, file: string): Promise<void> {
  return new Promise((resolvePromise) => {
    import('node:fs').then((fs) => {
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(file)
        .on('error', () => {
          json(res, 404, { error: 'not found' });
          resolvePromise();
        })
        .on('end', () => resolvePromise())
        .pipe(res);
    });
  });
}

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
};

function resolveTemplatesManifest(): string {
  try {
    const require = createRequire(import.meta.url);
    return require.resolve('@streetui/cli/templates/gallery.json');
  } catch {
    // Monorepo fallback: sibling cli package.
    return join(here, '..', '..', 'cli', 'templates', 'gallery.json');
  }
}

interface TemplateMeta {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly preview?: string;
  /** CLI template directory name (e.g. "basic" | "ssr"). */
  readonly template?: string;
}

async function listTemplates(): Promise<TemplateMeta[]> {
  const manifest = resolveTemplatesManifest();
  try {
    const data = (await readFile(manifest, 'utf8').catch(() => '[]')) as string;
    const parsed = JSON.parse(data) as TemplateMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function runPlayground(options: PlaygroundOptions): Promise<RunningPlayground> {
  const token = options.token ?? randomBytes(32).toString('hex');
  const project = options.project;
  const root = project.root;
  const host = options.host ?? 'localhost';
  const sessionId = options.sessionId ?? makeEventId();
  const eventsMaxSize = options.eventsMaxSize ?? 1000;
  let revoked = false;
  let sessionStopped = false;

  const eventsBuffer: StreetUIEvent[] = [];
  const recordEvent = (ev: StreetUIEvent): void => {
    eventsBuffer.push(ev);
    if (eventsBuffer.length > eventsMaxSize) eventsBuffer.splice(0, eventsBuffer.length - eventsMaxSize);
  };
  const eventsLogger = {
    emit(ev: StreetUIEvent) {
      recordEvent(ev);
      console.log(JSON.stringify(ev));
    },
    send(
      ev: Exclude<StreetUIEventType, never>,
      payload: Record<string, unknown> & { event: StreetUIEventType },
    ) {
      const { event: _ignored, ...rest } = payload;
      const full = { schemaVersion: 1, eventId: makeEventId(), sessionId, framework: 'streetui' as const, timestamp: new Date().toISOString(), ...rest, event: ev } as StreetUIEvent;
      recordEvent(full);
      console.log(JSON.stringify(full));
    },
    get buffer() {
      return eventsBuffer;
    },
  };

  const authorized = (req: IncomingMessage): boolean => {
    if (revoked) return false;
    const header = req.headers.authorization ?? '';
    return header === `Bearer ${token}`;
  };

  const emitSessionStopped = (): void => {
    if (sessionStopped) return;
    sessionStopped = true;
    eventsLogger.send('session_stopped', { event: 'session_stopped', reason: 'shutdown' });
  };

  const hostAllowed = (req: IncomingMessage): boolean => {
    const h = req.headers.host;
    if (!h) return true;
    const hostname = h.split(':')[0]?.toLowerCase() ?? '';
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === host.toLowerCase()
    );
  };

  const detectorRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
    ctx: { path: string },
  ): Promise<boolean> => {
    const { path } = ctx;
    if (!path.startsWith(PLAYGROUND_PREFIX)) return false;

    const rest = path.slice(PLAYGROUND_PREFIX.length) || '/';

    if (rest === '/api/session' || rest === '/api/session/') {
      if (!hostAllowed(req)) {
        json(res, 403, { error: 'bad host' });
        return true;
      }
      json(res, 200, {
        project: root,
        frameworkVersion: project.packageJson.version ?? project.packageJson.devDependencies?.['@streetui/cli'],
        previewUrl: devUrl,
        hmrPath: '/__streetui_hmr',
        prefix: PLAYGROUND_PREFIX,
        sessionId,
      });
      return true;
    }

    if (rest === '/api/session/shutdown' && (req.method === 'POST' || req.method === 'DELETE')) {
      if (!hostAllowed(req)) {
        json(res, 403, { error: 'bad host' });
        return true;
      }
      if (!authorized(req)) {
        json(res, 401, { error: 'unauthorized', hint: 'missing or invalid playground token' });
        return true;
      }
      revoked = true;
      json(res, 200, { ok: true, sessionId });
      void (async () => {
        await automation.disconnect();
        await automation.cleanup();
        emitSessionStopped();
        await dev.stop();
      })().catch(() => undefined);
      return true;
    }

    if (rest.startsWith('/api/')) {
      if (!hostAllowed(req)) {
        json(res, 403, { error: 'bad host' });
        return true;
      }
      if (!authorized(req)) {
        json(res, 401, { error: 'unauthorized', hint: 'missing or invalid playground token' });
        return true;
      }
      try {
        return await handleApi(rest, req, res);
      } catch (error) {
        if (res.headersSent) return true;
        const status = error instanceof HttpError ? error.status : 500;
        json(res, status, { error: error instanceof Error ? error.message : String(error) });
        return true;
      }
    }

    // Static playground assets.
    const fileRel = rest === '/' ? 'index.html' : rest.replace(/^\/+/, '');
    const file = await safeResolve(PLAYGROUND_STATIC, fileRel);
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      json(res, 404, { error: 'not found' });
      return true;
    }
    if (fileRel === 'index.html') {
      const html = await readFile(file, 'utf8').catch(() => '');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html.replaceAll('__PG_TOKEN__', token));
      return true;
    }
    await serveStatic(res, file);
    return true;
  };

  const handleApi = async (rest: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const method = req.method ?? 'GET';

    if (rest === '/api/files' && method === 'GET') {
      json(res, 200, { files: await listFiles(root) });
      return true;
    }

    if (rest === '/api/diagnostics' && method === 'GET') {
      json(res, 200, { events: eventsLogger.buffer });
      return true;
    }

    if (rest === '/api/templates' && method === 'GET') {
      json(res, 200, { templates: await listTemplates() });
      return true;
    }

    if (rest === '/api/create' && method === 'POST') {
      const body = JSON.parse(await readBody(req)) as { template?: string; dir?: string };
      const template = body.template ?? '';
      const dir = body.dir ?? '';
      if (!template || !dir) {
        json(res, 400, { error: 'template and dir required' });
        return true;
      }
      const templates = await listTemplates();
      const chosen = templates.find((t) => t.id === template);
      if (!chosen) {
        json(res, 400, { error: `unknown template: ${template}` });
        return true;
      }
      const templateDir = chosen.template ?? chosen.id;
      try {
        await createProject({
          targetDir: dir,
          template: templateDir,
          frameworkVersion: project.packageJson.version ?? '3.1.0',
          logger: options.logger,
        });
      } catch (error) {
        json(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
        return true;
      }
      const installed = await new Promise<boolean>((resolveInstall) => {
        const child = spawn('npm', ['install', '--no-audit', '--no-fund'], {
          cwd: dir,
          stdio: 'ignore',
          env: { ...process.env, NO_COLOR: '1' },
        });
        child.on('close', (code) => resolveInstall(code === 0));
        child.on('error', () => resolveInstall(false));
      });
      json(res, 200, { ok: true, dir, template, installed });
      return true;
    }

    if (rest === '/api/export' && method === 'GET') {
      const files = await listFiles(root);
      const contents: Record<string, Uint8Array> = {};
      for (const f of files) {
        const abs = join(root, f);
        const st = await lstat(abs).catch(() => null);
        if (!st || !st.isFile() || st.isSymbolicLink()) continue; // skip symlinks/outside
        contents[f] = Uint8Array.from(await readFile(abs));
      }
      const zipped = zipSync(contents, { level: 6 });
      const name = (project.packageJson.name ?? 'streetui-project').replace(/[^\w.-]/g, '_');
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${name}.zip"`,
        'Cache-Control': 'no-store',
      });
      res.end(Buffer.from(zipped));
      return true;
    }

    if (rest === '/api/file') {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let rel = url.searchParams.get('path') ?? '';
      let body: { path?: string; content?: string; to?: string } = {};
      if (method === 'POST' || method === 'PUT') {
        body = JSON.parse(await readBody(req)) as typeof body;
        if (rel === '' && body.path) rel = body.path;
      }
      if (rel === '') {
        json(res, 400, { error: 'path required' });
        return true;
      }
      if (method === 'GET') {
        const file = await safeResolve(root, rel);
        const content = await readFile(file, 'utf8').catch(() => null);
        if (content === null) {
          json(res, 404, { error: 'not found' });
          return true;
        }
        json(res, 200, { path: rel, content });
        return true;
      }
      if (method === 'POST') {
        const file = await safeResolve(root, rel);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, body.content ?? '', 'utf8');
        json(res, 200, { ok: true, path: rel });
        return true;
      }
      if (method === 'PUT') {
        const from = await safeResolve(root, rel);
        const toAbs = await safeResolve(root, body.to ?? '');
        await mkdir(dirname(toAbs), { recursive: true });
        await rename(from, toAbs);
        json(res, 200, { ok: true, from: rel, to: body.to });
        return true;
      }
      if (method === 'DELETE') {
        const file = await safeResolve(root, rel);
        await rm(file, { recursive: true, force: true });
        json(res, 200, { ok: true, path: rel });
        return true;
      }
    }

    if (rest === '/api/build' && method === 'POST') {
      eventsLogger.send('build_started', { event: 'build_started' });
      try {
        const out = await buildProject(project, 'production', { logger: options.logger });
        eventsLogger.send('build_completed', {
          event: 'build_completed',
          outDir: out.clientDir,
          files: out.fileCount,
          durationMs: out.durationMs,
        });
        json(res, 200, { ok: true, outDir: out.clientDir, files: out.fileCount, durationMs: out.durationMs });
      } catch (error) {
        json(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }

    const runBrowserRoute = async (operation: () => Promise<void>): Promise<true> => {
      try {
        await operation();
      } catch (error) {
        if (res.headersSent) return true;
        const err = error as { code?: string; message?: string };
        const code = err.code ?? 'E_INSPECTION_FAILED';
        const status =
          code === 'E_BROWSER_UNAVAILABLE' || code === 'E_AUTOMATION_UNAVAILABLE'
            ? 503
            : code === 'E_CLIENT_NOT_FOUND' || code === 'E_NOT_FOUND'
              ? 404
              : code === 'E_CLIENT_REQUIRED' || code === 'E_BAD_REQUEST'
                ? 400
                : 200;
        json(res, status, { ok: false, error: { code, message: err.message ?? String(error) } });
      }
      return true;
    };

    type BrowserTarget = { kind: 'hmr'; id: string } | { kind: 'automation' };
    const resolveBrowserTarget = (clientId: string | undefined): BrowserTarget => {
      const hmrIds = dev.hub.clientIds;
      if (clientId !== undefined && clientId !== '') {
        if (clientId === automation.clientId) {
          if (!automation.isConnected()) throw new AutomationError('E_CLIENT_NOT_FOUND', 'The automation browser is not connected.');
          return { kind: 'automation' };
        }
        if (hmrIds.includes(clientId)) return { kind: 'hmr', id: clientId };
        throw new AutomationError('E_CLIENT_NOT_FOUND', `Unknown or disconnected browser client: ${clientId}`);
      }
      if (automation.isConnected() && hmrIds.length === 0) return { kind: 'automation' };
      if (!automation.isConnected() && hmrIds.length === 1) return { kind: 'hmr', id: hmrIds[0] as string };
      if (!automation.isConnected() && hmrIds.length === 0) {
        throw new AutomationError('E_BROWSER_UNAVAILABLE', 'No browser is connected to the dev server.');
      }
      throw new AutomationError('E_CLIENT_REQUIRED', 'Multiple browsers are connected; pass clientId to choose a target.');
    };

    if (rest === '/api/browser/status' && method === 'GET') {
      json(res, 200, {
        connected: dev.hub.clientIds.length > 0 || automation.isConnected(),
        clients: dev.hub.clientIds.length + (automation.isConnected() ? 1 : 0),
        automation: automation.status(),
        previewUrl: devUrl,
      });
      return true;
    }

    if (rest === '/api/browser/clients' && method === 'GET') {
      const status = automation.status();
      json(res, 200, {
        clients: [
          ...dev.hub.clientIds.map((id) => ({ id, kind: 'hmr' })),
          ...(status.connected
            ? [{ id: automation.clientId, kind: 'automation', engine: status.engine, url: status.url, connectedAt: status.connectedAt }]
            : []),
        ],
      });
      return true;
    }

    if (rest === '/api/browser/automation/status' && method === 'GET') {
      json(res, 200, automation.status());
      return true;
    }

    if (rest === '/api/browser/automation/connect' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { engine?: AutomationEngine; viewport?: Partial<Viewport>; url?: string };
      return runBrowserRoute(async () => {
        json(res, 200, { ok: true, ...(await automation.connect(body)) });
      });
    }

    if (rest === '/api/browser/automation/disconnect' && method === 'POST') {
      return runBrowserRoute(async () => {
        await automation.disconnect();
        json(res, 200, { ok: true });
      });
    }

    if (rest.startsWith('/api/browser/screenshot/') && method === 'GET') {
      const id = rest.slice('/api/browser/screenshot/'.length);
      const found = await automation.readScreenshot(id);
      if (found === undefined) {
        json(res, 404, { ok: false, error: { code: 'E_NOT_FOUND', message: 'Unknown or expired screenshot id.' } });
        return true;
      }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': found.data.length, 'Cache-Control': 'no-store' });
      res.end(found.data);
      return true;
    }

    if (rest === '/api/browser/screenshot' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { fullPage?: boolean; viewport?: Partial<Viewport>; clientId?: string };
      return runBrowserRoute(async () => {
        if (body.clientId !== undefined && body.clientId !== automation.clientId) {
          throw new AutomationError('E_UNSUPPORTED', 'Screenshots require the automation browser; HMR preview clients cannot capture images.');
        }
        const meta = await automation.screenshot(body);
        json(res, 200, {
          ok: true,
          screenshot: {
            id: meta.id,
            format: meta.format,
            width: meta.width,
            height: meta.height,
            bytes: meta.bytes,
            fullPage: meta.fullPage,
            createdAt: meta.createdAt,
            url: `${PLAYGROUND_PREFIX}/api/browser/screenshot/${meta.id}`,
          },
        });
      });
    }

    if (rest === '/api/browser/interact' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as InteractionInput;
      return runBrowserRoute(async () => {
        json(res, 200, await automation.interact(body));
      });
    }

    if (rest === '/api/browser/inspect' && method === 'GET') {
      const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
      return runBrowserRoute(async () => {
        const clientId = query.get('clientId') ?? undefined;
        if (clientId !== undefined && clientId !== automation.clientId) {
          throw new AutomationError('E_UNSUPPORTED', 'Visual inspection requires the automation browser client.');
        }
        const inspection = await automation.inspect({
          ...(query.get('selector') !== null ? { selector: query.get('selector') as string } : {}),
          ...(query.get('limit') !== null ? { limit: Number(query.get('limit')) } : {}),
          ...(query.get('maxText') !== null ? { maxText: Number(query.get('maxText')) } : {}),
        });
        json(res, 200, { ok: true, inspection });
      });
    }

    if (rest === '/api/browser/dom' && method === 'GET') {
      const clientId = new URL(req.url ?? '/', 'http://localhost').searchParams.get('clientId') ?? undefined;
      return runBrowserRoute(async () => {
        const target = resolveBrowserTarget(clientId);
        if (target.kind === 'automation') {
          json(res, 200, { ok: true, payload: await automation.dom(), clientId: automation.clientId });
          return;
        }
        json(res, 200, { ok: true, payload: await dev.hub.sendRequest(target.id, { type: 'inspect_dom' }), clientId: target.id });
      });
    }

    if (rest === '/api/browser/element' && method === 'GET') {
      const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
      const selector = query.get('selector') ?? '';
      const clientId = query.get('clientId') ?? undefined;
      return runBrowserRoute(async () => {
        const target = resolveBrowserTarget(clientId);
        if (target.kind === 'automation') {
          const inspection = await automation.inspect({ selector, limit: 1 });
          const element = inspection.elements[0];
          if (element === undefined) throw new AutomationError('E_ELEMENT_NOT_FOUND', `No element matches ${selector}`);
          json(res, 200, { ok: true, payload: element, clientId: automation.clientId });
          return;
        }
        json(res, 200, {
          ok: true,
          payload: await dev.hub.sendRequest(target.id, { type: 'inspect_element', selector }),
          clientId: target.id,
        });
      });
    }

    if (rest === '/api/browser/navigate' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { url?: string; clientId?: string };
      return runBrowserRoute(async () => {
        const target = resolveBrowserTarget(body.clientId);
        if (target.kind === 'automation') {
          json(res, 200, {
            ok: true,
            payload: await automation.interact({ operation: 'navigate', url: body.url ?? '/' }),
            clientId: automation.clientId,
          });
          return;
        }
        json(res, 200, {
          ok: true,
          payload: await dev.hub.sendRequest(target.id, { type: 'navigate', url: body.url ?? '/' }),
          clientId: target.id,
        });
      });
    }

    if (rest === '/api/browser/reload' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { clientId?: string };
      return runBrowserRoute(async () => {
        const target = resolveBrowserTarget(body.clientId);
        if (target.kind === 'automation') {
          json(res, 200, {
            ok: true,
            payload: await automation.interact({ operation: 'reload' }),
            clientId: automation.clientId,
          });
          return;
        }
        json(res, 200, {
          ok: true,
          payload: await dev.hub.sendRequest(target.id, { type: 'reload' }),
          clientId: target.id,
        });
      });
    }

    if (rest === '/api/browser/console' && method === 'GET') {
      const clientId = new URL(req.url ?? '/', 'http://localhost').searchParams.get('clientId') ?? undefined;
      if (clientId === automation.clientId) {
        json(res, 200, { messages: automation.consoleLog() });
        return true;
      }
      json(res, 200, {
        messages: eventsLogger.buffer.filter(
          (ev) => ev.event === 'browser_console' && (clientId === undefined || ev.clientId === clientId),
        ),
        ...(automation.isConnected() && clientId === undefined ? { automation: automation.consoleLog() } : {}),
      });
      return true;
    }

    if (rest === '/api/browser/errors' && method === 'GET') {
      const clientId = new URL(req.url ?? '/', 'http://localhost').searchParams.get('clientId') ?? undefined;
      if (clientId === automation.clientId) {
        json(res, 200, { errors: automation.errorLog() });
        return true;
      }
      json(res, 200, {
        errors: eventsLogger.buffer.filter((ev) => {
          if (ev.event === 'browser_error') return clientId === undefined || ev.clientId === clientId;
          if (ev.event === 'runtime_error') return clientId === undefined;
          return false;
        }),
        ...(automation.isConnected() && clientId === undefined ? { automation: automation.errorLog() } : {}),
      });
      return true;
    }

    if (rest === '/api/browser/disconnect' && method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}') as { clientId?: string };
      return runBrowserRoute(async () => {
        const id = body.clientId ?? '';
        if (id === automation.clientId) {
          await automation.disconnect();
          json(res, 200, { ok: true, clientId: id });
          return;
        }
        if (!dev.hub.disconnect(id)) throw new AutomationError('E_CLIENT_NOT_FOUND', `Unknown or disconnected browser client: ${id}`);
        json(res, 200, { ok: true, clientId: id });
      });
    }

    json(res, 404, { error: 'unknown api' });
    return true;
  };

  const dev = await createDevServer({
    project,
    logger: options.logger,
    events: eventsLogger,
    sessionId,
    ...(options.host !== undefined ? { host: options.host } : {}),
    ...(options.port !== undefined ? { port: options.port } : {}),
    strictPort: options.port !== undefined,
    beforeRequest: detectorRequest,
  });
  const devUrl = `${dev.url}`;
  const automation = new AutomationManager({
    root,
    sessionId,
    previewUrl: devUrl,
    emit: (ev) => eventsLogger.emit(ev),
  });

  eventsLogger.send('playground_started', {
    event: 'playground_started',
    url: devUrl,
    port: dev.port,
    host: dev.host,
  });

  eventsLogger.send('session_attached', {
    event: 'session_attached',
    url: dev.url,
    previewUrl: devUrl,
    port: dev.port,
    host: dev.host,
    token,
    version: project.packageJson.version ?? project.packageJson.devDependencies?.['@streetui/cli'],
  });

  // Emitted exactly once, after the server and preview are actually ready.
  eventsLogger.send('session_ready', {
    event: 'session_ready',
    url: devUrl,
    port: dev.port,
    host: dev.host,
  });

  return {
    url: dev.url,
    port: dev.port,
    host: dev.host,
    previewUrl: devUrl,
    token,
    sessionId,
    stop: async () => {
      revoked = true;
      await automation.disconnect();
      await automation.cleanup();
      emitSessionStopped();
      await dev.stop();
    },
  };
}
