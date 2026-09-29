// DEV-ONLY benchmark artifact — Svelte 5 SSR scenario (Node). NOT part of the `streetui` runtime.
/**
 * Scenario F — server-side render of the 10,000-node app with Svelte's real
 * server renderer (`svelte/server` `render`). Node-only. Built for Node by the
 * orchestrator via `vite build --ssr` (compiles components with generate:ssr).
 *
 * `renderFlatHtml()` is ALSO exported (mirroring the Solid adapter) so the
 * orchestrator can server-render the Flat tree in Node — where the component is
 * SSR-compiled — and inject that markup into the browser (as
 * `globalThis.__SOLID_SSR_HTML__`) for hydration scenario G. This is required
 * because Svelte 5 is a COMPILED framework: `svelte/server`'s `render()` only
 * works on server-compiled components, so the CLIENT bundle cannot server-render
 * itself (unlike React/Vue whose renderers are runtime-only). Producing the SSR
 * markup here, in the SSR build, is the correct and fair way to feed G.
 */

import { render } from 'svelte/server';
import Flat from './Flat.svelte';
import { measure, N_BIG } from '../../shared/measure.mjs';

/**
 * Server-render the Flat 10k-node tree and return ONLY its HTML string. Used by
 * the orchestrator to seed the browser hydration scenario (G). Node-only.
 */
export function renderFlatHtml() {
  return render(Flat, { props: { n: N_BIG } }).html;
}

export async function runSSR() {
  let bytes = 0;
  const timing = await measure(
    () => {
      bytes = Buffer.byteLength(render(Flat, { props: { n: N_BIG } }).html, 'utf8');
    },
    { iterations: 20, warmup: 5 },
  );
  return {
    nodes: N_BIG,
    ...timing,
    outputBytes: bytes,
    note: 'render() of a 10k-node app; output size in bytes',
  };
}
