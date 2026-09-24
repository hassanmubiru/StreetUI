/**
 * `streetui/server` — server-only rendering helpers.
 *
 * This is a *curated subset* of the same framework that powers `streetui`; it
 * does not introduce a second renderer or SSR implementation. It re-exports the
 * already-implemented server-side rendering surface so server entry points can
 * import exactly what they need without pulling in browser-only concerns.
 *
 * ```ts
 * import { renderToString, serializeState, ServerDOMAdapter } from 'streetui/server';
 * ```
 *
 * Client-side hydration (`hydrate` / `createRenderer`) is available from the
 * main `streetui` entry.
 */

// Server-side rendering: compiled app → HTML string, with hydration state.
export {
  renderToString,
  serializeState,
  readState,
  STATE_MARKER_ATTR,
} from '@streetui/renderer';
export type { RenderToStringOptions } from '@streetui/renderer';

// The DOM adapter used to render on the server (no live browser DOM).
export { ServerDOMAdapter } from '@streetui/dom';

// Re-export the framework version for parity with the main entry.
export { VERSION } from './version.js';
