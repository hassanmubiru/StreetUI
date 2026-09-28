/**
 * Server entry. The StreetUI CLI bundles this for Node and calls the exported
 * `render(request)` for every non-asset request. It renders the app to HTML for
 * the requested URL and embeds a state snapshot so the browser can hydrate the
 * exact same app in place.
 *
 * Pure server code: no `window`, no `document`.
 */

import { renderToString, serializeState } from '@streetui/renderer';
import { createState, compileApp, snapshot, viewForPath, STATE_KEY } from './app.js';

export interface RenderRequest {
  readonly url: string;
}
export interface RenderResult {
  readonly html: string;
  readonly status?: number;
}

/** Render a full HTML document for the requested URL. */
export function render(request: RenderRequest): RenderResult {
  const state = createState({ view: viewForPath(request.url) });
  const compiled = compileApp(state);
  const body = renderToString(compiled);
  const island = serializeState({ [STATE_KEY]: snapshot(state) });

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>__PROJECT_NAME__</title>',
    '<link rel="icon" href="/favicon.svg" />',
    '<link rel="stylesheet" href="/styles.css" />',
    '</head>',
    '<body>',
    `<div id="app">${body}</div>`,
    island,
    '<script type="module" src="/main.js"></script>',
    '</body>',
    '</html>',
  ].join('\n');

  return { html };
}
