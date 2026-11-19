import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // Playground server (Node). Reuses createDevServer from the CLI.
    name: 'playground-server',
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node18',
    sourcemap: true,
    clean: false,
    splitting: false,
    external: ['typescript', '@streetui/cli'],
  },
  {
    // Playground UI — a self-contained StreetUI app bundle (served statically).
    name: 'playground-ui',
    entry: { main: 'ui/main.ts' },
    format: ['esm'],
    outDir: 'dist/ui',
    target: 'es2022',
    sourcemap: true,
    clean: false,
    splitting: false,
    noExternal: [/^@streetui\//, /^@codemirror\//, /^codemirror$/],
  },
]);
