// DEV-ONLY benchmark artifact — Solid Vite config. NOT part of the `streetui` runtime.
// vite-plugin-solid is the required Solid compiler (JSX + fine-grained
// reactivity). `hydratable: true` makes the client build able to hydrate the
// SSR markup used by scenario G. The orchestrator merges per-entry build
// overrides (and the SSR build sets ssr mode automatically).
import solid from 'vite-plugin-solid';

// When Vite's ssr build mode is active (build.ssr set), vite-plugin-solid must
// receive ssr:true to emit SSR-compatible code (solid-js/web server path) instead
// of the browser reactive path — otherwise Index/For use client-only accessors.
const isSsr = !!process.env.VITE_SSR_BUILD;

export default {
  plugins: [solid({ hydratable: true, ssr: isSsr })],
  build: { minify: 'esbuild', target: 'es2022' },
};
