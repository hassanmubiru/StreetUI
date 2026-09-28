/**
 * DevTools report (2.1 §23) — the first *usable* DevTools interface: one call
 * that turns a compiled application into a complete, self-contained HTML page a
 * developer can open in a browser (or save as a static report / inject into a
 * panel or iframe).
 *
 * It is a thin, additive convenience over the pieces that already shipped in
 * 2.0 — it composes them, it adds no new capability:
 *
 *     renderDevToolsReport(compiled)  ≡  renderDevToolsHTML(createDevTools(compiled).snapshot)
 *
 * Properties inherited from those pieces (nothing new is introduced):
 *   - DOM-free: pure string building; touches no DOM API and mounts nothing, so
 *     it runs in Node, a worker, or a test.
 *   - Non-mutating & non-instrumenting: reads only the compiled app plus any
 *     live sources the caller passes; never subscribes to signals, never patches
 *     the reactive runtime. DevTools pulls — it is never pushed to.
 *   - Zero production cost: nothing in the runtime imports this; the interface
 *     exists only once dev code opts in by calling it.
 *
 * HONEST SCOPE (unchanged from the view layer): this produces markup. Whether it
 * renders pixel-correctly, is screen-reader accessible, or hits 60fps in a real
 * browser is NOT claimed and has NOT been verified here — the browser/AT gates
 * are BLOCKED (no Chromium/AT in this environment). What is verified is that the
 * emitted document faithfully and safely (HTML-escaped) reflects the snapshot.
 */

import type { CompiledApplication } from '@streetui/compiler';
import { createDevTools, type DevToolsSources, type DevToolsOptions } from './panels.js';
import { renderDevToolsHTML } from './view.js';

/**
 * Build a complete, self-contained DevTools HTML document for a compiled app in
 * one call. Equivalent to rendering `createDevTools(compiled, sources, options)`'s
 * current snapshot; call again to reflect new state (DevTools pulls).
 */
export function renderDevToolsReport(
  compiled: CompiledApplication,
  sources: DevToolsSources = {},
  options: DevToolsOptions = {},
): string {
  const session = createDevTools(compiled, sources, options);
  return renderDevToolsHTML(session.snapshot);
}
