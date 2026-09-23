/**
 * Minimal ANSI logger — no third-party colour dependency. Colours are disabled
 * automatically when output is not a TTY or when `NO_COLOR` is set, so piped and
 * CI output stays clean.
 */

/* eslint-disable no-console */

const useColor =
  process.env['NO_COLOR'] === undefined &&
  process.env['FORCE_COLOR'] !== '0' &&
  (process.stdout.isTTY === true || process.env['FORCE_COLOR'] !== undefined);

function paint(code: number, text: string): string {
  return useColor ? `[${code}m${text}[0m` : text;
}

export const style = {
  bold: (t: string): string => paint(1, t),
  dim: (t: string): string => paint(2, t),
  red: (t: string): string => paint(31, t),
  green: (t: string): string => paint(32, t),
  yellow: (t: string): string => paint(33, t),
  blue: (t: string): string => paint(34, t),
  cyan: (t: string): string => paint(36, t),
};

const BRAND = style.bold(style.cyan('streetui'));

export interface Logger {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  plain(message: string): void;
}

/** The default logger writes to stdout/stderr with a `streetui` prefix. */
export function createLogger(prefix = BRAND): Logger {
  return {
    info: (m) => console.log(`${prefix} ${m}`),
    success: (m) => console.log(`${prefix} ${style.green(m)}`),
    warn: (m) => console.warn(`${prefix} ${style.yellow(m)}`),
    error: (m) => console.error(`${prefix} ${style.red(m)}`),
    plain: (m) => console.log(m),
  };
}
