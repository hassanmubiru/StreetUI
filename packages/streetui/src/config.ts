/**
 * Project-configuration surface for `streetui.config.ts`.
 *
 * The configuration *type* is single-sourced from the internal CLI module (so
 * there is exactly one authoritative `StreetUIConfig` shape). `defineConfig` is
 * the standard one-line identity helper used purely for editor type-inference on
 * the exported config object.
 *
 * This lives in its own tiny module — rather than re-exporting `defineConfig`
 * from the CLI barrel — so that importing `streetui` for application code does
 * **not** drag the CLI's build machinery (and its `esbuild` dependency) into the
 * client runtime bundle. The CLI's own `loadConfig` reads the default export of
 * `streetui.config.ts` regardless of which identity helper wrapped it, so the
 * behaviour is identical to configuring via the CLI directly.
 */
import type { StreetUIConfig } from '@streetui/cli';

export type { StreetUIConfig, ResolvedConfig } from '@streetui/cli';

/** Identity helper that gives `streetui.config.ts` full type-checking + inference. */
export function defineConfig(config: StreetUIConfig): StreetUIConfig {
  return config;
}
