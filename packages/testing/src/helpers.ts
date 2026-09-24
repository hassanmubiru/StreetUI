/**
 * Higher-level testing helpers: role/text queries, update flushing, async
 * waiting, and a first-class SSR → hydrate → assert workflow.
 *
 * These build on the same real renderer the app uses — no private-graph access,
 * no second assertion framework. They exist so a test does not have to
 * reimplement server-render/hydrate plumbing or poll for async resource state
 * by hand.
 */

import { resetIdCounter } from '@streetui/core';
import { flushSync } from '@streetui/scheduler';
import { compile } from '@streetui/compiler';
import type { StreetApp } from '@streetui/dsl';
import { BrowserDOMAdapter } from '@streetui/dom';
import {
  createRenderer,
  renderToString,
  type HydrationDiagnostic,
  createHydrationDiagnosticCollector,
} from '@streetui/renderer';
import type { RenderHandle } from '@streetui/runtime';

// ── Update flushing & async waiting ─────────────────────────────────────────

/**
 * Flush all pending scheduler work, then yield once to the microtask queue so
 * promise-driven updates (e.g. a resolved `resource` loader) are applied. Await
 * this after triggering a change that schedules a DOM patch.
 */
export async function flushUpdates(): Promise<void> {
  flushSync();
  await Promise.resolve();
  flushSync();
}

export interface WaitForOptions {
  /** Give up after this many milliseconds (default 1000). */
  readonly timeout?: number;
  /** Delay between attempts in milliseconds (default 10). */
  readonly interval?: number;
}

/**
 * Poll `check` until it returns a truthy value (or stops throwing), flushing
 * updates between attempts. Rejects with the last error/tiemout after the
 * deadline. Use for assertions that become true only after async work settles.
 */
export async function waitFor<T>(
  check: () => T,
  options: WaitForOptions = {},
): Promise<T> {
  const timeout = options.timeout ?? 1000;
  const interval = options.interval ?? 10;
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  for (;;) {
    await flushUpdates();
    try {
      const result = check();
      if (result) return result;
      lastError = new Error('[StreetUI Testing] waitFor: condition was falsy');
    } catch (err) {
      lastError = err;
    }
    if (Date.now() >= deadline) {
      throw lastError instanceof Error
        ? lastError
        : new Error(String(lastError));
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// ── Text / role queries (container-scoped) ──────────────────────────────────

/** Find the first leaf element whose text content includes `text`. */
export function findByText(container: Element, text: string): Element {
  const match = Array.from(container.querySelectorAll('*')).find(
    (el) => el.children.length === 0 && (el.textContent?.includes(text) ?? false),
  );
  if (match === undefined) {
    throw new Error(`[StreetUI Testing] No element with text "${text}" found`);
  }
  return match;
}

export interface ByRoleOptions {
  /** Restrict to elements whose accessible name includes this string. */
  readonly name?: string;
}

/** The implicit ARIA role for a plain HTML element, when it has one. */
function implicitRole(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'button':
      return 'button';
    case 'a':
      return el.hasAttribute('href') ? 'link' : null;
    case 'nav':
      return 'navigation';
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading';
    case 'input': {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'button' || type === 'submit') return 'button';
      return 'textbox';
    }
    case 'form':
      return 'form';
    default:
      return null;
  }
}

/** The accessible name approximation for an element (aria-label or text). */
function accessibleName(el: Element): string {
  return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
}

/**
 * Find all elements matching an ARIA `role` — explicit `role="…"` first, then
 * the element's implicit role. Optionally filter by accessible name.
 */
export function findAllByRole(
  container: Element,
  role: string,
  options: ByRoleOptions = {},
): Element[] {
  const all = Array.from(container.querySelectorAll('*'));
  return all.filter((el) => {
    const explicit = el.getAttribute('role');
    const matches = explicit === role || (explicit === null && implicitRole(el) === role);
    if (!matches) return false;
    if (options.name !== undefined) {
      return accessibleName(el).includes(options.name);
    }
    return true;
  });
}

/** Find the single element matching a role (throws if none/ambiguous). */
export function findByRole(
  container: Element,
  role: string,
  options: ByRoleOptions = {},
): Element {
  const matches = findAllByRole(container, role, options);
  if (matches.length === 0) {
    const named = options.name !== undefined ? ` with name "${options.name}"` : '';
    throw new Error(`[StreetUI Testing] No element with role "${role}"${named} found`);
  }
  if (matches.length > 1) {
    throw new Error(
      `[StreetUI Testing] Found ${matches.length} elements with role "${role}" — refine with { name }`,
    );
  }
  return matches[0]!;
}

// ── First-class SSR → hydrate → assert workflow ─────────────────────────────

export interface HydrateTestOptions {
  /** Collect hydration mismatch diagnostics (dev-style) during hydration. */
  readonly collectDiagnostics?: boolean;
}

export interface HydrateTestResult {
  /** The container holding the server HTML, now hydrated live. */
  readonly container: HTMLElement;
  /** The server-produced HTML string (before hydration). */
  readonly serverHtml: string;
  /** The live render handle from hydration. */
  readonly handle: RenderHandle;
  /** Hydration mismatch diagnostics (empty unless collectDiagnostics + a real mismatch). */
  readonly diagnostics: readonly HydrationDiagnostic[];
  /** Flush pending scheduler work. */
  flush(): void;
  /** Unmount and detach the container. */
  unmount(): void;
}

/**
 * Render `build` on the "server" to HTML, mount that HTML into a container,
 * then hydrate the SAME app against it — exactly the production SSR path. The
 * builder is invoked twice (server then client) with `resetIdCounter` between,
 * so deterministic ids line up. Assert node identity, behavior, and (optionally)
 * that hydration reported no mismatches.
 */
export function renderServerThenHydrate(
  build: () => StreetApp,
  options: HydrateTestOptions = {},
): HydrateTestResult {
  resetIdCounter();
  const serverHtml = renderToString(compile(build()));

  const container = document.createElement('div');
  container.innerHTML = serverHtml;
  document.body.appendChild(container);

  const collector = options.collectDiagnostics === true
    ? createHydrationDiagnosticCollector()
    : undefined;

  resetIdCounter();
  const renderer = createRenderer({
    domAdapter: new BrowserDOMAdapter(),
    ...(collector !== undefined ? { hydrationDiagnostics: collector.sink } : {}),
  });
  const handle = renderer.hydrate(compile(build()), container);

  return {
    container,
    serverHtml,
    handle,
    diagnostics: collector?.diagnostics ?? [],
    flush() {
      handle.flush();
    },
    unmount() {
      handle.unmount();
      if (container.parentNode !== null) container.parentNode.removeChild(container);
    },
  };
}
