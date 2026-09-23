/**
 * StreetUI project configuration (Phase 9). The config is intentionally tiny:
 * every field has a sensible default so `streetui.config.ts` is optional. A
 * project with no config file still builds and runs.
 *
 * The file is authored as TypeScript (`streetui.config.ts`) and compiled with
 * esbuild to a temporary ESM module before import, so we never depend on the
 * host having a TS loader registered.
 */

import { build as esbuildBuild } from 'esbuild';
import { rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

/** User-facing configuration shape (all fields optional). */
export interface StreetUIConfig {
  /** Dev server / preview port. Default 3000. */
  readonly port?: number;
  /** Host to bind. Default 'localhost'. */
  readonly host?: string;
  /** Client/browser entry, relative to project root. Default 'src/main.ts'. */
  readonly clientEntry?: string;
  /** Server entry used for SSR, relative to project root. Default 'src/server.ts'. */
  readonly serverEntry?: string;
  /** Output directory for `build`. Default 'dist'. */
  readonly outDir?: string;
  /** Static assets directory copied verbatim. Default 'public'. */
  readonly publicDir?: string;
}

/** Fully-resolved config: every field present, all paths absolute. */
export interface ResolvedConfig {
  readonly root: string;
  readonly port: number;
  readonly host: string;
  readonly clientEntry: string;
  readonly serverEntry: string;
  readonly outDir: string;
  readonly publicDir: string;
}

/**
 * Identity helper that gives config authors type-checking and autocomplete.
 * It returns its argument unchanged — the value matters, not the call.
 */
export function defineConfig(config: StreetUIConfig): StreetUIConfig {
  return config;
}

const DEFAULTS = {
  port: 3000,
  host: 'localhost',
  clientEntry: 'src/main.ts',
  serverEntry: 'src/server.ts',
  outDir: 'dist',
  publicDir: 'public',
} as const;

/** Config file names we look for, in priority order. */
const CONFIG_FILENAMES = ['streetui.config.ts', 'streetui.config.mjs', 'streetui.config.js'];

/** Absolute path of the first config file present in `root`, or undefined. */
export function findConfigFile(root: string): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(root, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Compile + import a `streetui.config.*` file and return its default export. */
async function importConfigFile(file: string): Promise<StreetUIConfig> {
  // `.js`/`.mjs` can be imported directly; `.ts` is compiled first.
  if (!file.endsWith('.ts')) {
    const mod = (await import(pathToFileURL(file).href)) as { default?: StreetUIConfig };
    return mod.default ?? {};
  }

  const result = await esbuildBuild({
    entryPoints: [file],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    // Keep node builtins and any deps external — we only want the config value.
    packages: 'external',
    logLevel: 'silent',
  });
  const code = result.outputFiles[0]?.text ?? '';

  // Write the compiled module *next to the config file* (not the OS temp dir)
  // so that any bare imports it kept external — e.g. `@streetui/cli` for
  // `defineConfig` — resolve against the project's own `node_modules`. A temp
  // file in the system temp directory would have no node_modules to walk up to.
  const outFile = join(dirname(file), `.streetui.config.${Date.now()}.mjs`);
  try {
    await writeFile(outFile, code, 'utf8');
    const mod = (await import(pathToFileURL(outFile).href)) as {
      default?: StreetUIConfig;
    };
    return mod.default ?? {};
  } finally {
    await rm(outFile, { force: true });
  }
}

function toAbsolute(root: string, p: string): string {
  return isAbsolute(p) ? p : resolve(root, p);
}

/**
 * Load and fully resolve configuration for the project rooted at `root`.
 * Missing config file → all defaults. Every returned path is absolute.
 */
export async function loadConfig(root: string): Promise<ResolvedConfig> {
  const absRoot = resolve(root);
  const file = findConfigFile(absRoot);
  const user = file ? await importConfigFile(file) : {};

  return {
    root: absRoot,
    port: user.port ?? DEFAULTS.port,
    host: user.host ?? DEFAULTS.host,
    clientEntry: toAbsolute(absRoot, user.clientEntry ?? DEFAULTS.clientEntry),
    serverEntry: toAbsolute(absRoot, user.serverEntry ?? DEFAULTS.serverEntry),
    outDir: toAbsolute(absRoot, user.outDir ?? DEFAULTS.outDir),
    publicDir: toAbsolute(absRoot, user.publicDir ?? DEFAULTS.publicDir),
  };
}
