/**
 * Developer-facing diagnostics. Two rules govern everything here (Phase 6, 19,
 * 22): be USEFUL and be TRUTHFUL. We only print a source position when the
 * underlying tool (esbuild / Node) actually gives us one, and we never dress up
 * a failure as anything other than what it is.
 */

import { style } from './logger.js';

/**
 * A CLI-level error carrying a human-readable explanation and, optionally, a
 * concrete suggestion. Throwing this (instead of a bare `Error`) lets the top
 * level render a clean message rather than a raw stack trace for expected
 * user mistakes (Phase 17).
 */
export class CliError extends Error {
  readonly suggestion: string | undefined;
  /** Process exit code to use when this error reaches the top level. */
  readonly exitCode: number;

  constructor(message: string, options?: { suggestion?: string; exitCode?: number }) {
    super(message);
    this.name = 'CliError';
    this.suggestion = options?.suggestion;
    this.exitCode = options?.exitCode ?? 1;
  }
}

/** A single build problem with an optional, real source location. */
export interface BuildProblem {
  readonly message: string;
  /** File path, when the tool reported one. */
  readonly file?: string;
  /** 1-based line, when known. */
  readonly line?: number;
  /** 1-based column, when known. */
  readonly column?: number;
  /** The offending source line, when the tool provided it. */
  readonly lineText?: string;
  /** A concrete suggestion, when we can infer one honestly. */
  readonly suggestion?: string;
}

/** Known StreetUI API names, used only to suggest fixes for obvious typos. */
const KNOWN_DSL_METHODS = [
  'app', 'page', 'section', 'container', 'heading', 'text', 'button', 'link',
  'input', 'form', 'list', 'listOf', 'when', 'errorBoundary',
];

/**
 * Turn an esbuild message into a `BuildProblem`, preserving the real location
 * esbuild computed. If esbuild could not determine a location, none is invented.
 */
export function fromEsbuildMessage(msg: {
  text: string;
  location: { file: string; line: number; column: number; lineText: string } | null;
}): BuildProblem {
  const problem: BuildProblem = { message: msg.text };
  const loc = msg.location;
  if (loc === null) return withSuggestion(problem);
  return withSuggestion({
    message: msg.text,
    file: loc.file,
    line: loc.line,
    column: loc.column + 1, // esbuild columns are 0-based; humans count from 1.
    lineText: loc.lineText,
  });
}

function withSuggestion(problem: BuildProblem): BuildProblem {
  // Only attach a suggestion when we can make a truthful, specific one.
  const unknownApi = /Property '(\w+)' does not exist|'(\w+)' is not a function/.exec(problem.message);
  const missingModule = /Could not resolve ["']([^"']+)["']/.exec(problem.message);

  if (missingModule) {
    const spec = missingModule[1] ?? '';
    if (spec.startsWith('@streetui/')) {
      return {
        ...problem,
        suggestion: `Install the StreetUI packages (run "npm install") — "${spec}" is not resolvable yet.`,
      };
    }
    return { ...problem, suggestion: `Check the import path "${spec}" — the file or package could not be found.` };
  }

  if (unknownApi) {
    const name = unknownApi[1] ?? unknownApi[2] ?? '';
    const near = KNOWN_DSL_METHODS.find((m) => m.toLowerCase() === name.toLowerCase() && m !== name)
      ?? KNOWN_DSL_METHODS.find((m) => m.startsWith(name.slice(0, 3)));
    if (near !== undefined && name.length > 0) {
      return { ...problem, suggestion: `Did you mean "${near}"? Check the StreetUI DSL API.` };
    }
  }

  return problem;
}

/** Render one build problem as a readable multi-line block (Phase 6 shape). */
export function formatProblem(problem: BuildProblem): string {
  const lines: string[] = [];
  if (problem.file !== undefined) {
    const pos =
      problem.line !== undefined
        ? `:${problem.line}${problem.column !== undefined ? `:${problem.column}` : ''}`
        : '';
    lines.push(style.cyan(`${problem.file}${pos}`));
  }
  lines.push(problem.message);
  if (problem.lineText !== undefined && problem.lineText.trim().length > 0) {
    lines.push(style.dim(`  | ${problem.lineText.trim()}`));
  }
  if (problem.suggestion !== undefined) {
    lines.push('');
    lines.push(`${style.yellow('Suggestion:')} ${problem.suggestion}`);
  }
  return lines.join('\n');
}

/** Render a full build failure with a StreetUI header and every problem. */
export function formatBuildFailure(problems: readonly BuildProblem[]): string {
  const header = style.red(style.bold('StreetUI build error'));
  const count = problems.length === 1 ? '1 error' : `${problems.length} errors`;
  const blocks = problems.map((p) => formatProblem(p)).join('\n\n');
  return `${header} (${count})\n\n${blocks}`;
}
