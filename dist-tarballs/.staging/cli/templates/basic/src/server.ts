/**
 * Server entry. The StreetUI CLI bundles this for Node and calls `render` for
 * every non-asset request, embedding a state snapshot for hydration.
 */

import { renderToString, serializeState } from '@streetui/renderer';
import { createState, compileApp, snapshot, STATE_KEY } from './app.js';

export interface RenderRequest {
  readonly url: string;
}
export interface RenderResult {
  readonly html: string;
}

export function render(_request: RenderRequest): RenderResult {
  const state = createState();
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
