/**
 * Server entry. The StreetUI CLI bundles this for Node and calls `render` for
 * non-asset requests. It renders the requested route to HTML and embeds the
 * state snapshot used to hydrate the identical app in the browser.
 */
import { renderToString, serializeState } from 'streetui/server';
import { renderStyles } from 'streetui';
import { createState, compileApp, snapshot, viewForPath, STATE_KEY } from './app.js';

export interface RenderRequest {
  readonly url: string;
}
export interface RenderResult {
  readonly html: string;
  readonly status?: number;
}

export async function render(request: RenderRequest): Promise<RenderResult> {
  const state = createState({ view: viewForPath(request.url) });
  // Resolve the demo data before serializing so SSR contains real content
  // (loading states are still exercised on the client when refetching).
  await Promise.all([state.overview.refetch(), state.users.refetch(), state.projects.refetch()]);
  const compiled = compileApp(state);
  const body = renderToString(compiled);
  const styles = renderStyles();
  const island = serializeState({ [STATE_KEY]: snapshot(state) });

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>Acme Admin — StreetUI dashboard</title>',
    '<meta name="description" content="A production-oriented StreetUI SaaS admin dashboard example: users, projects, settings, SSR and hydration." />',
    '<link rel="icon" href="/favicon.svg" />',
    '<link rel="stylesheet" href="/styles.css" />',
    styles,
    '</head>',
    '<body>',
    `<div id="app">${body}</div>`,
    island,
    '</body>',
    '</html>',
  ].join('\n');

  return { html };
}
