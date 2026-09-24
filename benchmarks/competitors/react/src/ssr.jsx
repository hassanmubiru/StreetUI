// DEV-ONLY benchmark artifact — React 19 SSR scenario (Node). NOT part of the `streetui` runtime.
/**
 * Scenario F — server-side render of the 10,000-node app with React's real
 * server renderer (`react-dom/server` `renderToString`). Node-only; no browser.
 * Built for Node consumption by the orchestrator via `vite build --ssr`.
 */

import { renderToString } from 'react-dom/server';
import { measure, N_BIG } from '../../shared/measure.mjs';
import { FlatList } from './app.jsx';

export async function runSSR() {
  const element = <FlatList n={N_BIG} />;
  let bytes = 0;
  const timing = await measure(
    () => {
      bytes = Buffer.byteLength(renderToString(element), 'utf8');
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
