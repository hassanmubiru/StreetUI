// DEV-ONLY benchmark artifact — Svelte 5 compiler config. NOT part of the `streetui` runtime.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
