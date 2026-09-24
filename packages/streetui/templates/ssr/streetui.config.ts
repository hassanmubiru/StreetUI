import { defineConfig } from 'streetui';

/**
 * StreetUI project configuration. Every field is optional and shown here with
 * its default — delete anything you do not need to change.
 */
export default defineConfig({
  port: 3000,
  host: 'localhost',
  clientEntry: 'src/main.ts',
  serverEntry: 'src/server.ts',
  outDir: 'dist',
  publicDir: 'public',
});
