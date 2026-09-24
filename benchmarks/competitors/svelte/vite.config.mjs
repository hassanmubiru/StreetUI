// DEV-ONLY benchmark artifact — Svelte Vite config. NOT part of the `streetui` runtime.
// @sveltejs/vite-plugin-svelte is the required Svelte 5 compiler (runes,
// components). The orchestrator merges per-entry build overrides over this.
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default {
  plugins: [svelte()],
  build: { minify: 'esbuild', target: 'es2022' },
};
