import { defineConfig } from '@streetui/cli';

export default defineConfig({
  clientEntry: 'src/main.ts',
  serverEntry: 'src/server.ts',
  outDir: 'dist',
  publicDir: 'public',
});
