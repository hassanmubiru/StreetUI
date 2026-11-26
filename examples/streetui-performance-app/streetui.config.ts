import { defineConfig } from 'streetui';

// The browser benchmark is a client-only StreetUI application. The dev server
// compiles and serves this entry directly; no external bundler is involved.
export default defineConfig({
  clientEntry: 'src/bench-browser.ts',
});
