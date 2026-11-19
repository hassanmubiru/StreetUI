/**
 * StreetUI project configuration.
 *
 * The config is intentionally tiny: every field has a sensible default, so
 * `streetui.config.ts` is optional. TypeScript configs are transpiled with the
 * TypeScript compiler API to a temporary ESM module next to the config file
 * before import, so no host loader is required and there is no bundler.
 */

import { rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as ts from 'typescript';

export interface StreetUIConfig {
  readonly port?: number;
  readonly host?: string;
  readonly clientEntry?: string;
  readonly serverEntry?: string;
  readonly outDir?: string;
  readonly publicDir?: string;
  /** Exact or wildcard aliases, e.g. `{ "@/*": "src/*" }`. */
  readonly alias?: Record<string, string>;
  /** Extra extensionless-import candidates. */
  readonly extensions?: readonly string[];
  /** Emit source maps for production output. Default true. */
  readonly sourcemap?: boolean;
  /** SPA fallback for client-only `preview`. Default true when index.html exists. */
  readonly spaFallback?: boolean;
  /** Enable HMR. Default true. */
  readonly hmr?: boolean;
}

export interface ResolvedConfig {
  readonly root: string;
  readonly port: number;
  readonly host: string;
  readonly clientEntry: string;
  readonly serverEntry: string;
  readonly outDir: string;
  readonly publicDir: string;
  readonly aliases: Readonly<Record<string, string>>;
  readonly extensions: readonly string[];
  readonly sourcemap: boolean;
  readonly spaFallback: boolean;
  readonly hmr: boolean;
}

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
  sourcemap: true,
  spaFallback: true,
  hmr: true,
} as const;

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'] as const;

const CONFIG_FILENAMES = ['streetui.config.ts', 'streetui.config.mjs', 'streetui.config.js'];

export function findConfigFile(root: string): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(root, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function transpileConfig(source: string, file: string): string {
  const result = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: false,
      esModuleInterop: true,
      isolatedModules: true,
    },
  });
  return result.outputText;
}

async function importConfigFile(file: string): Promise<StreetUIConfig> {
  if (!file.endsWith('.ts')) {
    const mod = (await import(pathToFileURL(file).href)) as { default?: StreetUIConfig };
    return mod.default ?? {};
  }

  const source = await (await import('node:fs/promises')).readFile(file, 'utf8');
  const code = transpileConfig(source, file);
  // Write the compiled module next to the config so bare imports (e.g.
  // `@streetui/cli` for `defineConfig`) resolve against the project.
  const outFile = join(dirname(file), `.streetui.config.${Date.now()}.mjs`);
  try {
    await writeFile(outFile, code, 'utf8');
    const mod = (await import(pathToFileURL(outFile).href)) as { default?: StreetUIConfig };
    return mod.default ?? {};
  } finally {
    await rm(outFile, { force: true });
  }
}

function toAbsolute(root: string, p: string): string {
  return isAbsolute(p) ? p : resolve(root, p);
}

function resolveAliases(root: string, alias: Record<string, string> | undefined): Record<string, string> {
  if (alias === undefined) return {};
  const result: Record<string, string> = {};
  for (const [key, target] of Object.entries(alias)) {
    result[key] = isAbsolute(target) ? target : resolve(root, target);
  }
  return result;
}

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
    aliases: resolveAliases(absRoot, user.alias),
    extensions: user.extensions ?? DEFAULT_EXTENSIONS,
    sourcemap: user.sourcemap ?? DEFAULTS.sourcemap,
    spaFallback: user.spaFallback ?? DEFAULTS.spaFallback,
    hmr: user.hmr ?? DEFAULTS.hmr,
  };
}