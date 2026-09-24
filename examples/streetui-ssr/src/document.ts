/**
 * Full-document rendering for the SSR example. Kept separate from the runnable
 * server entry so tests can import `renderDocument` without triggering the
 * entry's `process.exit`.
 *
 * Pure server-side: no window, no document, no DOM globals.
 */

import { renderToString, serializeState } from 'streetui';
import { createState, compileApp, snapshot, STATE_KEY, type AppSnapshot } from './app.js';

/**
 * Render a complete HTML document for the app in a given initial state. The
 * `#app` element holds the server-rendered markup; the state island lets the
 * browser rebuild the exact same reactive state before hydrating (no refetch,
 * no flash, no divergence).
 */
export function renderDocument(seed?: AppSnapshot): string {
  const state = createState(seed);
  const compiled = compileApp(state);
  const body = renderToString(compiled);
  const island = serializeState({ [STATE_KEY]: snapshot(state) });

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>StreetUI SSR</title>',
    '</head>',
    '<body>',
    `<div id="app">${body}</div>`,
    island,
    '<script type="module" src="/browser-entry.js"></script>',
    '</body>',
    '</html>',
  ].join('\n');
}
