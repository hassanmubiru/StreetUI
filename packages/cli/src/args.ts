/**
 * A tiny, dependency-free argument parser tailored to the StreetUI CLI.
 *
 * It intentionally supports only what the CLI actually uses — a leading command
 * word, positional arguments, boolean flags, and a handful of value options
 * (`--port`, `--host`, `--template`, `--dir`). Unknown flags are collected so a
 * command can reject them with a useful message rather than silently ignoring
 * them (Phase 14: no options that are ignored).
 */

export interface ParsedArgs {
  /** The command word, e.g. `create` / `dev` / `build` / `start`. */
  readonly command: string | undefined;
  /** Positional arguments after the command (e.g. the project name). */
  readonly positionals: readonly string[];
  /** `--help` / `-h` anywhere. */
  readonly help: boolean;
  /** `--version` / `-v` anywhere. */
  readonly version: boolean;
  /** `--port <n>` (validated as an integer, else `undefined`). */
  readonly port: number | undefined;
  /** `--host <h>`. */
  readonly host: string | undefined;
  /** `--template <name>` (project template for `create`). */
  readonly template: string | undefined;
  /** `--dir <path>` project directory override. */
  readonly dir: string | undefined;
  /** Any flags we do not recognise, reported verbatim (without leading `--`). */
  readonly unknown: readonly string[];
}

const VALUE_FLAGS = new Set(['port', 'host', 'template', 'dir']);
const BOOLEAN_FLAGS = new Set(['help', 'version']);
const SHORT: Record<string, string> = { h: 'help', v: 'version', p: 'port' };

/** Parse `process.argv.slice(2)`-style tokens into a `ParsedArgs`. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  let command: string | undefined;
  const positionals: string[] = [];
  const unknown: string[] = [];
  let help = false;
  let version = false;
  let port: number | undefined;
  let host: string | undefined;
  let template: string | undefined;
  let dir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;

    if (token.startsWith('--') || (token.startsWith('-') && token.length > 1 && !/^-\d/.test(token))) {
      // Normalise `--name=value` and short flags to a long flag name + value.
      const isLong = token.startsWith('--');
      const raw = isLong ? token.slice(2) : token.slice(1);
      const eq = raw.indexOf('=');
      let name = eq >= 0 ? raw.slice(0, eq) : raw;
      let inlineValue: string | undefined = eq >= 0 ? raw.slice(eq + 1) : undefined;
      if (!isLong) name = SHORT[name] ?? name;

      if (BOOLEAN_FLAGS.has(name)) {
        if (name === 'help') help = true;
        else if (name === 'version') version = true;
        continue;
      }

      if (VALUE_FLAGS.has(name)) {
        const value = inlineValue ?? argv[++i];
        if (value === undefined) {
          unknown.push(`${name} (missing value)`);
          continue;
        }
        if (name === 'port') {
          const n = Number.parseInt(value, 10);
          port = Number.isFinite(n) && n > 0 ? n : undefined;
          if (port === undefined) unknown.push(`port (invalid: ${value})`);
        } else if (name === 'host') host = value;
        else if (name === 'template') template = value;
        else if (name === 'dir') dir = value;
        continue;
      }

      unknown.push(name);
      // A stray `--flag value` shouldn't swallow the value as a positional
      // silently; but we also don't know it takes a value, so leave `value`.
      inlineValue = undefined;
      continue;
    }

    if (command === undefined) command = token;
    else positionals.push(token);
  }

  return { command, positionals, help, version, port, host, template, dir, unknown };
}
