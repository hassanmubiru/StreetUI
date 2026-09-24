// DEV-ONLY benchmark artifact — Solid Vite config. NOT part of the `streetui` runtime.
// vite-plugin-solid is the required Solid compiler (JSX + fine-grained
// reactivity). `hydratable: true` makes the client build able to hydrate the
// SSR markup used by scenario G. The orchestrator merges per-entry build
// overrides (and the SSR build sets ssr mode automatically).
import solid from 'vite-plugin-solid';

export default {
  plugins: [solid({ hydratable: true })],
  build: { minify: 'esbuild', target: 'es2022' },
};
