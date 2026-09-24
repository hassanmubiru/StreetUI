import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Hydration/mount tests need a DOM; happy-dom mirrors the renderer package.
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
