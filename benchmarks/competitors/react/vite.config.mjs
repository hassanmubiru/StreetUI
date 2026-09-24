// DEV-ONLY benchmark artifact — React Vite config. NOT part of the `streetui` runtime.
// Provides the JSX compiler. The orchestrator (benchmarks/run-competitors.mjs)
// merges per-entry build overrides (input, ssr, outDir) over this config.
import react from '@vitejs/plugin-react';

export default {
  plugins: [react()],
  // esbuild minify keeps H bundle numbers comparable across frameworks.
  build: { minify: 'esbuild', target: 'es2022' },
};
