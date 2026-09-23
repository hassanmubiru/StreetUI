/**
 * Project resolution and validation (Phase 17). Before `dev`, `build`, or
 * `start` do any real work, we confirm the working directory actually looks
 * like a StreetUI project and fail with a clear, actionable message otherwise —
 * never a cryptic stack trace.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { CliError } from './diagnostics.js';
import { loadConfig, type ResolvedConfig } from './config.js';

/** A validated StreetUI project ready for a command to act on. */
export interface ResolvedProject {
  /** Absolute project root. */
  readonly root: string;
  /** Parsed package.json. */
  readonly packageJson: PackageJson;
  /** Fully-resolved configuration (defaults applied). */
  readonly config: ResolvedConfig;
}

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly type?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly scripts?: Record<string, string>;
  readonly [key: string]: unknown;
}

function readPackageJson(root: string): PackageJson {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new CliError(`No package.json found in ${root}.`, {
      suggestion: 'Run this command from the root of a StreetUI project, or create one with "npm create streetui@latest".',
    });
  }
  let raw: string;
  try {
    raw = readFileSync(pkgPath, 'utf8');
  } catch (err) {
    throw new CliError(`Could not read ${pkgPath}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(raw) as PackageJson;
  } catch (err) {
    throw new CliError(`package.json is not valid JSON: ${(err as Error).message}`, {
      suggestion: 'Fix the syntax error in package.json and try again.',
    });
  }
}

/** True when the package depends on any `@streetui/*` package. */
function dependsOnStreetUI(pkg: PackageJson): boolean {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return Object.keys(deps).some((name) => name === 'streetui' || name.startsWith('@streetui/'));
}

/**
 * Resolve + validate the project rooted at `cwd` (or `--dir`). Throws a
 * `CliError` with a helpful suggestion for every failure mode Phase 17 lists:
 * missing package.json, not a StreetUI project, invalid config, missing entry.
 */
export async function resolveProject(cwd: string, options?: { requireEntry?: boolean }): Promise<ResolvedProject> {
  const root = resolve(cwd);
  const packageJson = readPackageJson(root);

  if (!dependsOnStreetUI(packageJson)) {
    throw new CliError(`${root} does not look like a StreetUI project.`, {
      suggestion: 'Its package.json declares no "@streetui/*" dependency. Create a project with "npm create streetui@latest".',
    });
  }

  let config: ResolvedConfig;
  try {
    config = await loadConfig(root);
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError(`Failed to load streetui.config: ${(err as Error).message}`, {
      suggestion: 'Check streetui.config.ts for syntax or import errors.',
    });
  }

  if (options?.requireEntry === true && !existsSync(config.clientEntry)) {
    throw new CliError(`Client entry not found: ${config.clientEntry}`, {
      suggestion: 'Create the entry file, or set "clientEntry" in streetui.config.ts to point at your app entry.',
    });
  }

  return { root, packageJson, config };
}
