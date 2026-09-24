// DEV-ONLY benchmark artifact — Vue 3.5 SSR scenario (Node). NOT part of the `streetui` runtime.
/**
 * Scenario F — server-side render of the 10,000-node app with Vue's real
 * server renderer (`@vue/server-renderer` `renderToString`, async). Node-only.
 */

import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { measure, N_BIG } from '../../shared/measure.mjs';
import { makeFlat } from './app.mjs';

export async function runSSR() {
  let bytes = 0;
  const timing = await measure(
    async () => {
      const app = createSSRApp(makeFlat(N_BIG).App);
      bytes = Buffer.byteLength(await renderToString(app), 'utf8');
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
