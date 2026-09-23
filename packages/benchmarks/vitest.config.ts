import { defineConfig } from 'vitest/config';

/**
 * Correctness tests for the benchmark harness itself (stats math, comparison
 * logic). These are fast and completely separate from the actual performance
 * runs, which execute via `npm run bench` (node dist/run.js), never through
 * vitest. Kept in `happy-dom` so the harness's DOM helpers can be exercised.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    environmentOptions: {
      happyDOM: {
        settings: { navigation: { disableMainFrameNavigation: true } },
      },
    },
  },
});
