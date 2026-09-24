// DEV-ONLY benchmark artifact — Svelte 5 SSR scenario (Node). NOT part of the `streetui` runtime.
/**
 * Scenario F — server-side render of the 10,000-node app with Svelte's real
 * server renderer (`svelte/server` `render`). Node-only. Built for Node by the
 * orchestrator via `vite build --ssr` (compiles components with generate:ssr).
 */

import { render } from 'svelte/server';
import Flat from './Flat.svelte';
import { measure, N_BIG } from '../../shared/measure.mjs';

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
