/**
 * Template registry (Phases 3, 11, 12). Templates are real files shipped inside
 * the CLI package under `templates/<name>/`. They are copied verbatim at
 * scaffold time, with two transforms: a small set of placeholder tokens are
 * substituted, and files prefixed `_` are un-prefixed (so `_gitignore` becomes
 * `.gitignore` and `_package.json` becomes `package.json` — npm would otherwise
 * mangle those names on publish).
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Available starter templates. */
export type TemplateName =
  | 'basic'
  | 'ssr'
  | 'counter'
  | 'todo'
  | 'form'
  | 'routing'
  | 'signals'
  | 'components'
  | 'data-fetching'
  | 'interactive';

export const TEMPLATES: readonly TemplateName[] = [
  'basic',
  'ssr',
  'counter',
  'todo',
  'form',
  'routing',
  'signals',
  'components',
  'data-fetching',
  'interactive',
];
export const DEFAULT_TEMPLATE: TemplateName = 'ssr';

/** Tokens replaced in every text file of a template. */
export interface TemplateTokens {
  /** Normalised directory name of the project. */
  readonly projectName: string;
  /** StreetUI framework version the generated app depends on. */
  readonly frameworkVersion: string;
  /** StreetUI CLI version for the devDependency (defaults to frameworkVersion). */
  readonly cliVersion?: string;
}

/**
 * Files stored under a transformed name because npm would otherwise mangle them
 * on publish (it renames `.gitignore` and drops/collides on `package.json`). The
 * key is the shipped name; the value is what it becomes in the scaffolded app.
 */
const NAME_MAP: Record<string, string> = {
  '_gitignore': '.gitignore',
  '_npmrc': '.npmrc',
  '_package.json': 'package.json',
};

/** Absolute path to the shipped `templates/` directory. */
export function templatesRoot(): string {
  // Resolve from the location of THIS module (ESM import.meta.url / CJS
  // __dirname), so the CLI finds its own shipped templates regardless of the
  // current working directory (e.g. when run via `npx @streetui/cli`). The
  // source-tree and cwd entries remain as fallbacks for unpacked development.
  function moduleDirectory(): string | undefined {
    if (typeof __dirname === 'string') return __dirname;
    try {
      return dirname(fileURLToPath(import.meta.url));
    } catch {
      return undefined;
    }
  }

  const hereCandidates = [moduleDirectory(), process.cwd()].filter(
    (value): value is string => value !== undefined,
  );
  const candidates = hereCandidates.flatMap((here) => [
    resolve(here, 'templates'),
    resolve(here, '..', 'templates'),
    resolve(here, '..', '..', 'templates'),
  ]);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Fall back to the first candidate; callers surface a clear error if missing.
  return candidates[0] ?? resolve(process.cwd(), 'templates');
}

/** Absolute path to a specific template's source directory. */
export function templateDir(name: TemplateName): string {
  return join(templatesRoot(), name);
}

/** Validate a user-supplied template name, returning it typed or throwing. */
export function resolveTemplateName(name: string | undefined): TemplateName {
  if (name === undefined) return DEFAULT_TEMPLATE;
  if ((TEMPLATES as readonly string[]).includes(name)) return name as TemplateName;
  throw new Error(`Unknown template "${name}". Available: ${TEMPLATES.join(', ')}.`);
}

/** Map a template file name to its materialised name (see `NAME_MAP`). */
export function materialisedName(fileName: string): string {
  return NAME_MAP[fileName] ?? fileName;
}

/** Replace template tokens in a text file's contents. */
export function applyTokens(contents: string, tokens: TemplateTokens): string {
  return contents
    .replaceAll('__PROJECT_NAME__', tokens.projectName)
    .replaceAll('__FRAMEWORK_VERSION__', tokens.frameworkVersion)
    .replaceAll('__CLI_VERSION__', tokens.cliVersion ?? tokens.frameworkVersion);
}

/** File extensions treated as text (token substitution applies). */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.css', '.html', '.md', '.txt', '.npmrc', '',
]);

/** Whether a file should be read as text for token substitution. */
export function isTextFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  const ext = dot >= 0 ? fileName.slice(dot) : '';
  // `_gitignore` / `_npmrc` have no dotted extension → treat as text.
  return TEXT_EXTENSIONS.has(ext);
}
