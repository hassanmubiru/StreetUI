import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    // pushState/replaceState + popstate are all we exercise; a real back()/forward()
    // in happy-dom would otherwise try to *load* the target document over the network.
    // Disable main-frame navigation so history moves without a resource fetch.
    environmentOptions: {
      happyDOM: {
        settings: { navigation: { disableMainFrameNavigation: true } },
      },
    },
  },
});
