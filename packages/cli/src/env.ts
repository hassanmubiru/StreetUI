/**
 * Environment variables (Phase 10). The rule is simple and safe by default:
 * only variables whose names begin with `STREETUI_PUBLIC_` are exposed to the
 * browser bundle. Everything else stays on the server, so secrets in the
 * process environment cannot leak into client-side JavaScript.
 *
 * `NODE_ENV` is always defined (as the build mode) so app code can branch on
 * development vs production.
 */

/** Prefix that marks an env var as safe to ship to the browser. */
export const PUBLIC_ENV_PREFIX = 'STREETUI_PUBLIC_';

/**
 * Build the esbuild `define` map for the CLIENT bundle: `NODE_ENV` plus every
 * `STREETUI_PUBLIC_*` variable, each stringified as a compile-time constant.
 * Server-only variables are deliberately excluded.
 */
export function clientEnvDefine(
  mode: 'development' | 'production',
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const define: Record<string, string> = {
    'process.env.NODE_ENV': JSON.stringify(mode),
  };
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(PUBLIC_ENV_PREFIX) && value !== undefined) {
      define[`process.env.${key}`] = JSON.stringify(value);
    }
  }
  return define;
}

/** Names of the public variables currently visible (for logging/diagnostics). */
export function publicEnvNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env).filter((k) => k.startsWith(PUBLIC_ENV_PREFIX));
}
