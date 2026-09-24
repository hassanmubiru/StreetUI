// DEV-ONLY benchmark artifact — Vue Vite config. NOT part of the `streetui` runtime.
// Render-function components need no SFC compiler, so no Vue plugin is required;
// Vite resolves the bare `vue` / `@vue/server-renderer` imports directly.
// The orchestrator merges per-entry build overrides over this config.
export default {
  // For SSR builds the orchestrator passes build.ssr; the app uses the Node
  // server-renderer build of vue there automatically via conditional exports.
  build: { minify: 'esbuild', target: 'es2022' },
};
