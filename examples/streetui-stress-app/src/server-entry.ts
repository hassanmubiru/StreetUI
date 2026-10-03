/**
 * StreetUI Stress App — server entry.
 *
 * Re-exports renderApp as the canonical server entry so tsup's server bundle
 * has a stable, route-facing surface. `renderApp(path)` produces the server
 * HTML for a route: the persistent shell with the active route already inside
 * `#page-outlet`, exactly where the client router will hydrate it — composed
 * as ONE compiled StreetUI app through the normal renderToString pipeline.
 */

export { renderApp, STATE_KEY, OUTLET_ID } from './app.js';
export type { RenderResult } from './app.js';
