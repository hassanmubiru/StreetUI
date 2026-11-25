/**
 * M11 — Optional browser automation provider for the Playground.
 *
 * A single automation session per playground, backed by Playwright when it is
 * installed (development-only, loaded lazily). The provider drives a real
 * browser against the dev server's preview URL: screenshots, interactions,
 * and structured visual inspection. It is never a required runtime dependency;
 * when it is unavailable every operation fails with a precise structured error.
 *
 * The provider never invents results: no screenshot is returned unless a real
 * browser produced the PNG bytes, and no interaction is reported as successful
 * unless the driver completed it.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StreetUIEvent } from '@streetui/cli';

export type AutomationEngine = 'chromium' | 'firefox' | 'webkit';
export interface Viewport {
  readonly width: number;
  readonly height: number;
}
export interface ScreenshotMeta {
  readonly id: string;
  readonly format: 'png';
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly fullPage: boolean;
  readonly path: string;
  readonly createdAt: string;
}
export interface BrowserDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly clientId: string;
  readonly timestamp: string;
  readonly url?: string;
}
export interface InspectionElement {
  readonly tag: string;
  readonly id: string;
  readonly className: string;
  readonly text: string;
  readonly visible: boolean;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly outsideViewport: boolean;
}
export interface VisualInspection {
  readonly url: string;
  readonly title: string;
  readonly route: string;
  readonly readyState: string;
  readonly viewport: Viewport;
  readonly document: Viewport;
  readonly visibleText: string;
  readonly truncated: boolean;
  readonly elements: readonly InspectionElement[];
  readonly elementCount: number;
  readonly consoleErrorCount: number;
  readonly runtimeErrorCount: number;
  readonly failedRequestCount: number;
  readonly brokenImageCount: number;
  readonly appRootEmpty: boolean | null;
  readonly diagnostics: readonly BrowserDiagnostic[];
  readonly screenshotId?: string;
}
export interface CapturedMessage {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly clientId: string;
  readonly url?: string;
}
export interface AutomationStatus {
  readonly connected: boolean;
  readonly engine?: AutomationEngine;
  readonly url?: string;
  readonly connectedAt?: string;
}
export type InteractionOperation =
  | 'click'
  | 'type'
  | 'fill'
  | 'select'
  | 'press'
  | 'submit'
  | 'scroll'
  | 'navigate'
  | 'reload'
  | 'resize'
  | 'waitForSelector'
  | 'waitForNavigation'
  | 'waitForStable'
  | 'evaluate';
export interface InteractionInput {
  readonly operation: InteractionOperation;
  readonly selector?: string;
  readonly text?: string;
  readonly value?: string;
  readonly key?: string;
  readonly url?: string;
  readonly expression?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly timeoutMs?: number;
}
export interface InteractionSuccess {
  readonly ok: true;
  readonly operation: InteractionOperation;
  readonly selector?: string;
  readonly durationMs: number;
  readonly value?: unknown;
}

export class AutomationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/* Minimal structural Playwright types — keeps the package free of a hard
 * dependency while remaining type-safe (no `any`). */
interface PwKeyboard {
  type(text: string): Promise<void>;
  press(key: string): Promise<void>;
}
interface PwPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  url(): string;
  title(): Promise<string>;
  viewportSize(): Viewport | null;
  setViewportSize(viewport: Viewport): Promise<void>;
  screenshot(options: { type: 'png'; fullPage?: boolean; timeout?: number }): Promise<Buffer>;
  click(selector: string, options?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string, options?: { timeout?: number }): Promise<void>;
  selectOption(selector: string, value: string, options?: { timeout?: number }): Promise<unknown>;
  press(selector: string, key: string, options?: { timeout?: number }): Promise<void>;
  evaluate(pageFunction: string, arg?: unknown): Promise<unknown>;
  reload(options?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  waitForSelector(selector: string, options?: { timeout?: number; state?: string }): Promise<unknown>;
  waitForLoadState(state?: string, options?: { timeout?: number }): Promise<void>;
  waitForURL(url: string, options?: { timeout?: number }): Promise<void>;
  keyboard: PwKeyboard;
  on(event: string, listener: (arg: unknown) => void): void;
  isClosed(): boolean;
  close(): Promise<void>;
  content(): Promise<string>;
}
interface PwContext {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}
interface PwBrowser {
  newContext(options: { viewport: Viewport }): Promise<PwContext>;
  /** Playwright exposes this on real browsers; test doubles may omit it. */
  browserType?(): { name(): string };
  close(): Promise<void>;
}
interface PwBrowserType {
  launch(options: { headless?: boolean; args?: string[]; executablePath?: string }): Promise<PwBrowser>;
}
interface PwModule {
  chromium: PwBrowserType;
  firefox: PwBrowserType;
  webkit: PwBrowserType;
}

interface ConsoleMessageShape {
  type(): string;
  text(): string;
}
interface RequestShape {
  url(): string;
  failure(): { errorText: string } | null;
}
interface ResponseShape {
  status(): number;
  url(): string;
}

export interface AutomationManagerOptions {
  readonly root: string;
  readonly sessionId: string;
  readonly previewUrl: string;
  readonly emit: (event: StreetUIEvent) => void;
}

const MAX_CAPTURE = 200;
const MAX_SCREENSHOTS = 24;
const DEFAULT_TIMEOUT = 10000;
const MAX_TIMEOUT = 30000;
const AUTOMATION_CLIENT_ID = 'automation';

function boundedPush<T>(list: T[], entry: T): void {
  list.push(entry);
  if (list.length > MAX_CAPTURE) list.splice(0, list.length - MAX_CAPTURE);
}

function clampTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT;
  return Math.min(Math.floor(value), MAX_TIMEOUT);
}

function clampDimension(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(64, Math.min(4096, Math.floor(value)));
}

/** Read the real PNG dimensions from the IHDR chunk (never guessed). */
function pngDimensions(buffer: Buffer): { width: number; height: number } {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a' || buffer.length < 24) {
    throw new AutomationError('E_SCREENSHOT_FAILED', 'Browser did not produce a valid PNG image.');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * Locate a real browser binary in the Playwright cache when the version
 * Playwright expects is not installed. Only real executables are used — if none
 * exists the provider reports E_AUTOMATION_UNAVAILABLE.
 */
function cachedEngineExecutable(engine: AutomationEngine): string | undefined {
  const cacheRoot = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cacheRoot)) return undefined;
  const prefix = engine === 'firefox' ? 'firefox-' : engine === 'chromium' ? 'chromium-' : 'webkit-';
  const dirs = readdirSync(cacheRoot)
    .filter((dir) => dir.startsWith(prefix))
    .sort()
    .reverse();
  for (const dir of dirs) {
    const candidates =
      engine === 'firefox'
        ? [join(cacheRoot, dir, 'firefox', 'firefox')]
        : engine === 'chromium'
          ? [join(cacheRoot, dir, 'chrome-linux', 'chrome'), join(cacheRoot, dir, 'chrome-linux64', 'chrome')]
          : [join(cacheRoot, dir, 'pw_run.sh')];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export class AutomationManager {
  readonly clientId = AUTOMATION_CLIENT_ID;
  private browser: PwBrowser | undefined;
  private context: PwContext | undefined;
  private page: PwPage | undefined;
  private engine: AutomationEngine | undefined;
  private connectedAt: string | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly consoleMessages: CapturedMessage[] = [];
  private readonly runtimeErrors: CapturedMessage[] = [];
  private readonly failedRequests: CapturedMessage[] = [];
  private readonly diagnostics: BrowserDiagnostic[] = [];
  private readonly screenshots = new Map<string, ScreenshotMeta>();
  private lastScreenshotId: string | undefined;
  private readonly screenshotsDir: string;

  constructor(private readonly options: AutomationManagerOptions) {
    this.screenshotsDir = join(options.root, '.streetui-cache', 'screenshots', options.sessionId);
  }

  isConnected(): boolean {
    return this.page !== undefined && !this.page.isClosed();
  }

  status(): AutomationStatus {
    if (!this.isConnected()) return { connected: false };
    return {
      connected: true,
      ...(this.engine !== undefined ? { engine: this.engine } : {}),
      ...(this.page !== undefined ? { url: this.page.url() } : {}),
      ...(this.connectedAt !== undefined ? { connectedAt: this.connectedAt } : {}),
    };
  }

  consoleLog(): readonly CapturedMessage[] {
    return this.consoleMessages;
  }

  errorLog(): readonly CapturedMessage[] {
    return [...this.runtimeErrors, ...this.failedRequests];
  }

  private emitLifecycle(event: 'browser_connected' | 'browser_disconnected', url: string): void {
    this.options.emit({
      schemaVersion: 1,
      event,
      eventId: randomUUID(),
      sessionId: this.options.sessionId,
      framework: 'streetui',
      timestamp: new Date().toISOString(),
      url,
      clientId: this.clientId,
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async loadPlaywright(): Promise<PwModule> {
    try {
      const specifier = 'playwright';
      return (await import(specifier)) as PwModule;
    } catch {
      throw new AutomationError(
        'E_AUTOMATION_UNAVAILABLE',
        'Browser automation requires the optional Playwright provider. Install it with `npm install --no-save playwright` and `npx playwright install chromium`.',
      );
    }
  }

  async connect(input?: { engine?: AutomationEngine; viewport?: Partial<Viewport>; url?: string }): Promise<AutomationStatus> {
    return this.serialize(async () => {
      if (this.isConnected()) return this.status();
      const engine = input?.engine ?? 'chromium';
      if (!['chromium', 'firefox', 'webkit'].includes(engine)) {
        throw new AutomationError('E_UNSUPPORTED', `Unsupported browser engine: ${engine}`);
      }
      const viewport: Viewport = {
        width: clampDimension(input?.viewport?.width, 1280),
        height: clampDimension(input?.viewport?.height, 720),
      };
      const playwright = await this.loadPlaywright();
      // `--no-sandbox` is a Chromium flag. Passing it to WebKit makes the
      // browser exit during startup ("Target page, context or browser has been
      // closed"), which previously made every WebKit agent session BLOCKED.
      const launchArgs = engine === 'chromium' ? ['--no-sandbox'] : [];
      let browser: PwBrowser;
      try {
        browser = await playwright[engine].launch({ headless: true, args: launchArgs });
      } catch (error) {
        const fallback = cachedEngineExecutable(engine);
        if (fallback === undefined) {
          throw new AutomationError(
            'E_AUTOMATION_UNAVAILABLE',
            `Failed to launch ${engine}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
          );
        }
        try {
          browser = await playwright[engine].launch({ headless: true, args: launchArgs, executablePath: fallback });
        } catch (fallbackError) {
          throw new AutomationError(
            'E_AUTOMATION_UNAVAILABLE',
            `Failed to launch ${engine}: ${fallbackError instanceof Error ? fallbackError.message.split('\n')[0] : String(fallbackError)}`,
          );
        }
      }
      const actualEngine = browser.browserType?.().name();
      if (actualEngine !== undefined && actualEngine !== engine) {
        await browser.close().catch(() => undefined);
        throw new AutomationError('E_UNSUPPORTED', `Requested ${engine} but Playwright launched ${actualEngine}`);
      }
      this.browser = browser;
      this.context = await browser.newContext({ viewport });
      this.page = await this.context.newPage();
      this.engine = engine;
      this.connectedAt = new Date().toISOString();
      this.attachListeners(this.page);
      await mkdir(this.screenshotsDir, { recursive: true });
      const target = input?.url ?? this.options.previewUrl;
      try {
        await this.page.goto(target, { waitUntil: 'domcontentloaded', timeout: MAX_TIMEOUT });
      } catch (error) {
        await this.disconnect();
        throw new AutomationError('E_NAVIGATION_FAILED', `Could not open ${target}: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.emitLifecycle('browser_connected', this.page.url());
      return this.status();
    });
  }

  private attachListeners(page: PwPage): void {
    page.on('console', (arg) => {
      const message = arg as ConsoleMessageShape;
      const level = message.type() === 'error' ? 'error' : message.type() === 'warning' ? 'warn' : 'info';
      const entry: CapturedMessage = {
        timestamp: new Date().toISOString(),
        level,
        message: message.text(),
        clientId: this.clientId,
      };
      boundedPush(this.consoleMessages, entry);
      if (level === 'error') {
        boundedPush(this.diagnostics, {
          code: 'E_CONSOLE_ERROR',
          severity: 'error',
          message: entry.message,
          clientId: this.clientId,
          timestamp: entry.timestamp,
        });
      }
    });
    page.on('pageerror', (arg) => {
      const error = arg as Error;
      const timestamp = new Date().toISOString();
      boundedPush(this.runtimeErrors, { timestamp, level: 'error', message: error.message, clientId: this.clientId });
      boundedPush(this.diagnostics, {
        code: 'E_PAGE_ERROR',
        severity: 'error',
        message: error.message,
        clientId: this.clientId,
        timestamp,
      });
    });
    page.on('requestfailed', (arg) => {
      const request = arg as RequestShape;
      const timestamp = new Date().toISOString();
      const url = request.url();
      const message = `${url} — ${request.failure()?.errorText ?? 'request failed'}`;
      boundedPush(this.failedRequests, { timestamp, level: 'error', message, clientId: this.clientId, url });
      boundedPush(this.diagnostics, { code: 'E_REQUEST_FAILED', severity: 'error', message, clientId: this.clientId, timestamp, url });
    });
    page.on('response', (arg) => {
      const response = arg as ResponseShape;
      if (response.status() < 400) return;
      const timestamp = new Date().toISOString();
      const url = response.url();
      const message = `${url} — HTTP ${response.status()}`;
      boundedPush(this.failedRequests, { timestamp, level: 'error', message, clientId: this.clientId, url });
      boundedPush(this.diagnostics, { code: 'E_REQUEST_FAILED', severity: 'error', message, clientId: this.clientId, timestamp, url });
    });
  }

  private requirePage(): PwPage {
    if (!this.isConnected() || this.page === undefined) {
      throw new AutomationError('E_AUTOMATION_UNAVAILABLE', 'No automation browser is connected. Call /api/browser/automation/connect first.');
    }
    return this.page;
  }

  async disconnect(): Promise<void> {
    return this.serialize(async () => {
      const page = this.page;
      const context = this.context;
      const browser = this.browser;
      const wasConnected = this.isConnected();
      this.page = undefined;
      this.context = undefined;
      this.browser = undefined;
      if (page !== undefined && !page.isClosed()) await page.close().catch(() => undefined);
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
      if (wasConnected) this.emitLifecycle('browser_disconnected', page?.url() ?? this.options.previewUrl);
      this.engine = undefined;
      this.connectedAt = undefined;
    });
  }

  /** Remove this session's temporary screenshots. Ids are never paths. */
  async cleanup(): Promise<void> {
    this.screenshots.clear();
    this.lastScreenshotId = undefined;
    await rm(this.screenshotsDir, { recursive: true, force: true }).catch(() => undefined);
  }

  async screenshot(input?: { fullPage?: boolean; viewport?: Partial<Viewport> }): Promise<ScreenshotMeta> {
    return this.serialize(async () => {
      const page = this.requirePage();
      if (input?.viewport !== undefined) {
        await page.setViewportSize({
          width: clampDimension(input.viewport.width, page.viewportSize()?.width ?? 1280),
          height: clampDimension(input.viewport.height, page.viewportSize()?.height ?? 720),
        });
      }
      let buffer: Buffer;
      try {
        buffer = await page.screenshot({ type: 'png', fullPage: input?.fullPage === true, timeout: MAX_TIMEOUT });
      } catch (error) {
        throw new AutomationError('E_SCREENSHOT_FAILED', error instanceof Error ? error.message : String(error));
      }
      const { width, height } = pngDimensions(buffer);
      const id = randomUUID();
      const file = join(this.screenshotsDir, `${id}.png`);
      await mkdir(this.screenshotsDir, { recursive: true });
      await writeFile(file, buffer);
      const meta: ScreenshotMeta = {
        id,
        format: 'png',
        width,
        height,
        bytes: buffer.length,
        fullPage: input?.fullPage === true,
        path: file,
        createdAt: new Date().toISOString(),
      };
      this.screenshots.set(id, meta);
      this.lastScreenshotId = id;
      while (this.screenshots.size > MAX_SCREENSHOTS) {
        const oldest = this.screenshots.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        const stale = this.screenshots.get(oldest);
        this.screenshots.delete(oldest);
        if (stale !== undefined) await rm(stale.path, { force: true }).catch(() => undefined);
      }
      return meta;
    });
  }

  /** Retrieval is by generated id only — never by caller-supplied paths. */
  async readScreenshot(id: string): Promise<{ meta: ScreenshotMeta; data: Buffer } | undefined> {
    if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
    const meta = this.screenshots.get(id);
    if (meta === undefined || !existsSync(meta.path)) return undefined;
    return { meta, data: await readFile(meta.path) };
  }

  async interact(input: InteractionInput): Promise<InteractionSuccess> {
    return this.serialize(async () => {
      const page = this.requirePage();
      const timeout = clampTimeout(input.timeoutMs);
      const started = Date.now();
      const selector = input.selector;
      try {
        switch (input.operation) {
          case 'click':
            if (!selector) throw new AutomationError('E_BAD_REQUEST', 'click requires a selector');
            await page.click(selector, { timeout });
            break;
          case 'type':
            if (!selector) throw new AutomationError('E_BAD_REQUEST', 'type requires a selector');
            await page.click(selector, { timeout });
            await page.keyboard.type(input.text ?? '');
            break;
          case 'fill':
            if (!selector) throw new AutomationError('E_BAD_REQUEST', 'fill requires a selector');
            await page.fill(selector, input.value ?? input.text ?? '', { timeout });
            break;
          case 'select':
            if (!selector) throw new AutomationError('E_BAD_REQUEST', 'select requires a selector');
            await page.selectOption(selector, input.value ?? '', { timeout });
            break;
          case 'press':
            if (selector !== undefined) await page.press(selector, input.key ?? 'Enter', { timeout });
            else await page.keyboard.press(input.key ?? 'Enter');
            break;
          case 'submit':
            if (!selector) throw new AutomationError('E_BAD_REQUEST', 'submit requires a selector');
            await page.press(selector, 'Enter', { timeout });
            break;
          case 'scroll':
            if (selector !== undefined) {
              await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('E_ELEMENT_NOT_FOUND'); el.scrollIntoView({ block: 'center' }); })()`);
            } else {
              await page.evaluate(`window.scrollTo(${input.x ?? 0}, ${input.y ?? 0})`);
            }
            break;
          case 'navigate':
            await page.goto(input.url ?? this.options.previewUrl, { waitUntil: 'domcontentloaded', timeout });
            break;
          case 'reload':
            await page.reload({ timeout, waitUntil: 'domcontentloaded' });
            break;
          case 'resize':
            await page.setViewportSize({
              width: clampDimension(input.width, page.viewportSize()?.width ?? 1280),
              height: clampDimension(input.height, page.viewportSize()?.height ?? 720),
            });
            break;
          case 'waitForSelector':
            if (!selector) throw new AutomationError('E_BAD_REQUEST', 'waitForSelector requires a selector');
            await page.waitForSelector(selector, { timeout, state: 'visible' });
            break;
          case 'waitForNavigation':
            await page.waitForURL(input.url ?? '**/*', { timeout });
            break;
          case 'waitForStable':
            await page.waitForLoadState('networkidle', { timeout });
            break;
          case 'evaluate': {
            if (!input.expression) throw new AutomationError('E_BAD_REQUEST', 'evaluate requires an expression');
            const raw = await page.evaluate(`(() => { return (${input.expression}); })()`);
            // Browser values (Window, DOM nodes, cycles) are not always
            // JSON-serializable; never let a result crash the control API.
            let value: unknown;
            try {
              JSON.stringify(raw);
              value = raw;
            } catch {
              value = String(raw);
            }
            return {
              ok: true,
              operation: input.operation,
              durationMs: Date.now() - started,
              value,
            };
          }
          default:
            throw new AutomationError('E_BAD_REQUEST', `Unknown operation: ${String(input.operation)}`);
        }
      } catch (error) {
        if (error instanceof AutomationError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        const code = /navigate|navigation|goto/i.test(input.operation) || /ERR_|Navigation/i.test(message)
          ? 'E_NAVIGATION_FAILED'
          : /waiting for selector|Timeout|not visible|not found|E_ELEMENT_NOT_FOUND/i.test(message)
            ? 'E_ELEMENT_NOT_FOUND'
            : 'E_INTERACTION_FAILED';
        throw new AutomationError(code, message.split('\n')[0] ?? message);
      }
      return {
        ok: true,
        operation: input.operation,
        ...(selector !== undefined ? { selector } : {}),
        durationMs: Date.now() - started,
      };
    });
  }

  async dom(): Promise<{ html: string }> {
    return this.serialize(async () => ({ html: await this.requirePage().content() }));
  }

  async inspect(input?: { selector?: string; limit?: number; maxText?: number }): Promise<VisualInspection> {
    return this.serialize(async () => {
      const page = this.requirePage();
      const limit = Math.max(1, Math.min(200, Math.floor(input?.limit ?? 40)));
      const maxText = Math.max(0, Math.min(20000, Math.floor(input?.maxText ?? 4000)));
      const selector = input?.selector;
      const url = page.url();
      const title = await page.title();
      const viewport = page.viewportSize() ?? { width: 0, height: 0 };
      const readyState = String(await page.evaluate('document.readyState'));
      const documentDims = (await page.evaluate(
        '({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })',
      )) as Viewport;
      const rawText = String(await page.evaluate("document.body ? document.body.innerText : ''"));
      const elements = (await page.evaluate(
        `(() => {
          const selector = ${JSON.stringify(selector ?? 'body *')};
          const limit = ${limit};
          const viewport = { width: window.innerWidth, height: window.innerHeight };
          const nodes = selector === 'body *' ? Array.from(document.querySelectorAll(selector)) : Array.from(document.querySelectorAll(selector));
          const single = ${selector !== undefined};
          const picked = single ? nodes.slice(0, 1) : nodes.slice(0, limit);
          return picked.map((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            return {
              tag: el.tagName.toLowerCase(),
              id: el.id ?? '',
              className: typeof el.className === 'string' ? el.className : '',
              text: (el.textContent ?? '').trim().slice(0, 120),
              visible,
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              outsideViewport: visible && (rect.bottom < 0 || rect.right < 0 || rect.top > viewport.height || rect.left > viewport.width),
            };
          });
        })()`,
      )) as InspectionElement[];
      const appRootEmpty = (await page.evaluate(
        `(() => { const app = document.querySelector('#app'); if (!app) return null; return app.childElementCount === 0 && (app.textContent ?? '').trim() === ''; })()`,
      )) as boolean | null;
      const brokenImages = (await page.evaluate(
        `Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src).slice(0, 20)`,
      )) as string[];
      const diagnostics: BrowserDiagnostic[] = [...this.diagnostics];
      const now = new Date().toISOString();
      for (const src of brokenImages) {
        diagnostics.push({ code: 'W_BROKEN_IMAGE', severity: 'warning', message: `Image failed to load: ${src}`, clientId: this.clientId, timestamp: now, url: src });
      }
      if (appRootEmpty === true) {
        diagnostics.push({ code: 'W_EMPTY_APP_ROOT', severity: 'warning', message: '#app exists but renders no content.', clientId: this.clientId, timestamp: now });
      }
      for (const el of elements) {
        if (el.outsideViewport) {
          diagnostics.push({ code: 'W_OUTSIDE_VIEWPORT', severity: 'warning', message: `<${el.tag}${el.id ? `#${el.id}` : ''}> is outside the viewport.`, clientId: this.clientId, timestamp: now });
        }
      }
      const inspection: VisualInspection = {
        url,
        title,
        route: new URL(url).pathname,
        readyState,
        viewport,
        document: documentDims,
        visibleText: rawText.slice(0, maxText),
        truncated: rawText.length > maxText,
        elements,
        elementCount: elements.length,
        consoleErrorCount: this.consoleMessages.filter((m) => m.level === 'error').length,
        runtimeErrorCount: this.runtimeErrors.length,
        failedRequestCount: this.failedRequests.length,
        brokenImageCount: brokenImages.length,
        appRootEmpty,
        diagnostics,
        ...(this.lastScreenshotId !== undefined ? { screenshotId: this.lastScreenshotId } : {}),
      };
      this.options.emit({
        schemaVersion: 1,
        event: 'preview_inspected',
        eventId: randomUUID(),
        sessionId: this.options.sessionId,
        framework: 'streetui',
        timestamp: now,
        url,
        title,
        route: inspection.route,
        readyState,
      });
      return inspection;
    });
  }
}
