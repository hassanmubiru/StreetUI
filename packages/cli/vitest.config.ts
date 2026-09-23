import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The CLI is a Node program: it spawns builds, watches files and starts
    // HTTP servers. Tests exercise real process behaviour, so a Node env.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Real builds + server round-trips need headroom beyond the default 5s.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
