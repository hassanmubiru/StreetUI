/**
 * Interactive DevTools view (2.2 Phase 1) — a self-contained, 12-panel browser
 * DevTools surface rendered as ONE HTML document.
 *
 * This extends the static `renderDevToolsHTML` (2.0 §8) into a *tabbed,
 * interactive* tool while preserving every DevTools design constraint:
 *
 *   - It consumes ONLY an existing {@link DevToolsSnapshot} (already composed
 *     from the read-only inspectors). There is NO second framework runtime, NO
 *     second reactive system, NO second graph, and NO DOM/subscription work at
 *     render time — this function is a pure string builder.
 *   - The snapshot is embedded once as inert JSON. A small, dependency-free
 *     vanilla-JS controller (no framework, no bundler, no network) renders the
 *     panels from that JSON in the browser: tab switching, component selection,
 *     and a Refresh button.
 *   - Refresh is pull-based and never mutates the app: the controller calls an
 *     optional host hook `window.__STREETUI_DEVTOOLS_REFRESH__()` that, when the
 *     host provides it, returns a fresh snapshot (e.g. from `session.refresh()`).
 *     Absent the hook, Refresh is a no-op — DevTools is never pushed to.
 *   - Every value the controller injects into the DOM is escaped; the embedded
 *     JSON is `<`-escaped so app data cannot break out of the <script> block.
 *
 * The 12 panels map 1:1 to the milestone spec: (1) Component Tree,
 * (2) Component Inspector, (3) Reactive State, (4) Signal/Dependency Graph,
 * (5) Router, (6) Resource/Async, (7) Mutation, (8) Event, (9) Overlay,
 * (10) Performance Timeline, (11) Error Diagnostics, (12) SSR/Hydration.
 *
 * HONEST SCOPE: this produces markup + a controller script. That it *renders*
 * pixels, is screen-reader conformant, or hits 60fps in a real browser is NOT
 * claimed and has NOT been observed here — no browser/AT exists in this
 * environment (browser + AT gates remain BLOCKED). What tests verify is that the
 * document faithfully and safely embeds the snapshot and that the controller
 * logic is deterministic (exercised under happy-dom, which is NOT a browser).
 */

import type { DevToolsSnapshot } from './panels.js';
import { escapeHtml } from './view.js';

export interface InteractiveDevToolsOptions {
  /** Tab id to open first. Defaults to `'components'`. */
  readonly initialTab?: string;
  /** Document <title>. Defaults to `StreetUI DevTools — <app name>`. */
  readonly title?: string;
}

/** The 12 panels, in tab order. `id` is stable and used by the controller/tests. */
export const DEVTOOLS_TABS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'components', label: 'Component Tree' },
  { id: 'inspector', label: 'Component Inspector' },
  { id: 'state', label: 'Reactive State' },
  { id: 'signalGraph', label: 'Signal Graph' },
  { id: 'router', label: 'Router' },
  { id: 'resources', label: 'Resource / Async' },
  { id: 'mutations', label: 'Mutations' },
  { id: 'events', label: 'Events' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'performance', label: 'Performance' },
  { id: 'diagnostics', label: 'Error Diagnostics' },
  { id: 'hydration', label: 'SSR / Hydration' },
];

/** Serialize the snapshot for safe inline embedding in a <script> block. */
function embedJson(snapshot: DevToolsSnapshot): string {
  // Escape `<` (and U+2028/U+2029) so the payload cannot terminate the <script>
  // element or break a JSON parser; the controller reads it with JSON.parse.
  return JSON.stringify(snapshot)
    .replace(/</g, '\\u003c')
    .replace(/ /g, '\\u2028')
    .replace(/ /g, '\\u2029');
}

/**
 * Render the interactive 12-panel DevTools document for a snapshot. Static,
 * side-effect-free string builder. Re-run with a fresh snapshot (or let the
 * in-page Refresh button pull one via the host hook) to reflect new state.
 */
export function renderInteractiveDevTools(
  snapshot: DevToolsSnapshot,
  options: InteractiveDevToolsOptions = {},
): string {
  const app = snapshot.application;
  const title = options.title ?? `StreetUI DevTools — ${app.identity.name}`;
  const initialTab = options.initialTab ?? DEVTOOLS_TABS[0]!.id;

  const tabButtons = DEVTOOLS_TABS.map(
    (t) =>
      `<button type="button" role="tab" class="st-tab" data-tab="${escapeHtml(t.id)}"` +
      `${t.id === initialTab ? ' aria-selected="true"' : ' aria-selected="false"'}>` +
      `${escapeHtml(t.label)}</button>`,
  ).join('');

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(title)}</title><style>${INTERACTIVE_CSS}</style></head>` +
    `<body class="st-dt">` +
    `<header class="st-top"><h1>${escapeHtml(title)} ` +
    `<span class="st-dim">v${escapeHtml(app.identity.version)}</span></h1>` +
    `<button type="button" id="st-refresh" class="st-refresh">↻ Refresh</button></header>` +
    `<nav class="st-tabs" role="tablist" aria-label="DevTools panels">${tabButtons}</nav>` +
    `<main id="st-panel" class="st-body" role="tabpanel" aria-live="polite"></main>` +
    `<footer class="st-foot"><span class="st-dim">Structural inspection over one compiled graph. ` +
    `Not a production profiler; browser/AT conformance not claimed (gates BLOCKED).</span></footer>` +
    `<script type="application/json" id="st-data">${embedJson(snapshot)}</script>` +
    `<script>${CONTROLLER_JS.replace('__INITIAL_TAB__', JSON.stringify(initialTab))}</script>` +
    `</body></html>`
  );
}
