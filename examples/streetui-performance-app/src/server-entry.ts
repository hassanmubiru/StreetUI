/**
 * Server entry — render the composed page to HTML and embed a state island so
 * the client can rebuild identical deps and hydrate in place.
 *
 * `renderDocument` returns a full HTML document string; `renderIsland` returns
 * just the app markup + state script (handy for benchmarks that measure the
 * SSR body size without the surrounding boilerplate).
 */
import { renderToString, serializeState } from 'streetui';
import { createDeps, snapshot, STATE_KEY, type CreateDepsOptions, type Theme } from './deps.js';
import { compilePage, type ViewName } from './index.js';

export interface RenderOptions extends CreateDepsOptions {
  readonly view?: ViewName;
  readonly theme?: Theme;
}

export interface RenderResult {
  readonly html: string;
  readonly body: string;
  readonly stateScript: string;
  readonly bytes: number;
}

/** Render the app island (mount node + state script) as a string. */
export function renderIsland(options: RenderOptions = {}): RenderResult {
  const view = options.view ?? 'users';
  const theme = options.theme ?? { name: 'light' };
  const deps = createDeps(options);
  const compiled = compilePage(deps, view, theme);

  const body = renderToString(compiled);
  const stateScript = serializeState({ [STATE_KEY]: snapshot(deps) });
  const island = `<div id="app">${body}</div>${stateScript}`;

  return {
    html: island,
    body,
    stateScript,
    bytes: Buffer.byteLength(island, 'utf8'),
  };
}

/** Render a complete HTML document around the app island. */
export function renderDocument(options: RenderOptions = {}): string {
  const { html } = renderIsland(options);
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<title>StreetUI Console</title></head><body>' +
    html +
    '<script type="module" src="/browser-entry.js"></script>' +
    '</body></html>'
  );
}
