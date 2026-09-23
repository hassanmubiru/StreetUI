/**
 * Node server entry (#23). Pure server-side: no window, no document, no DOM
 * globals. It builds the app, resolves any state, renders HTML with
 * `renderToString`, embeds a state island with `serializeState`, prints the full
 * document to stdout, and exits cleanly.
 *
 * This is framework-neutral — there is no Express/Fastify assumption. A real
 * server (StreetJS or otherwise) would call `renderDocument()` inside a request
 * handler and send the returned string as the response body.
 */

import { renderToString, serializeState } from '@streetui/renderer';
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

// Running directly (`node server-entry.js`) prints one rendered document and
// exits. No listeners are left open — the process terminates on its own.
const html = renderDocument();
process.stdout.write(html + '\n');
process.exit(0);
