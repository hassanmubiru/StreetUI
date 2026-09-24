// DEV-ONLY benchmark artifact — Solid 1.9 SSR scenario (Node). NOT part of the `streetui` runtime.
/**
 * Scenario F — server-side render of the 10,000-node app with Solid's real
 * server renderer (`solid-js/web` `renderToString`). Node-only. Built for Node
 * by the orchestrator via `vite build --ssr` (compiles components to SSR mode).
 *
 * `renderFlatHtml()` is exported so the orchestrator can feed Solid's server
 * markup into the browser (as __SOLID_SSR_HTML__) for the hydration scenario G,
 * which a DOM-mode client build cannot produce on its own.
 */

import { renderToString } from 'solid-js/web';
import { measure, N_BIG } from '../../shared/measure.mjs';
import { FlatList } from './app.jsx';

export function renderFlatHtml() {
  return renderToString(() => <FlatList n={N_BIG} />);
}

export async function runSSR() {
  let bytes = 0;
  const timing = await measure(
    () => {
      bytes = Buffer.byteLength(renderToString(() => <FlatList n={N_BIG} />), 'utf8');
    },
    { iterations: 20, warmup: 5 },
  );
  return {
    nodes: N_BIG,
    ...timing,
    outputBytes: bytes,
    note: 'renderToString of a 10k-node app; output size in bytes',
  };
}
