/**
 * Framework diagnostics — structured errors, warnings, and hints
 * that flow through the compiler, validator, and runtime.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticLocation {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly nodeId?: string;
}

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly location: DiagnosticLocation | undefined;
  readonly cause: unknown;
}

export class DiagnosticError extends Error {
  readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    const summary = diagnostics
      .filter(d => d.severity === 'error')
      .map(d => `[${d.code}] ${d.message}`)
      .join('\n');
    super(`StreetUI diagnostics:\n${summary}`);
    this.name = 'DiagnosticError';
    this.diagnostics = diagnostics;
  }
}

export class DiagnosticCollector {
  private readonly _diagnostics: Diagnostic[] = [];

  get diagnostics(): readonly Diagnostic[] {
    return this._diagnostics;
  }

  get hasErrors(): boolean {
    return this._diagnostics.some(d => d.severity === 'error');
  }

  get hasWarnings(): boolean {
    return this._diagnostics.some(d => d.severity === 'warning');
  }

  error(
    code: string,
    message: string,
    location?: DiagnosticLocation,
    cause?: unknown,
  ): void {
    this._diagnostics.push({ severity: 'error', code, message, location: location ?? undefined, cause: cause ?? undefined });
  }

  warn(
    code: string,
    message: string,
    location?: DiagnosticLocation,
  ): void {
    this._diagnostics.push({ severity: 'warning', code, message, location: location ?? undefined, cause: undefined });
  }

  info(
    code: string,
    message: string,
    location?: DiagnosticLocation,
  ): void {
    this._diagnostics.push({ severity: 'info', code, message, location: location ?? undefined, cause: undefined });
  }

  merge(other: DiagnosticCollector): void {
    for (const d of other.diagnostics) {
      this._diagnostics.push(d);
    }
  }

  throwIfErrors(): void {
    if (this.hasErrors) {
      throw new DiagnosticError(this._diagnostics);
    }
  }

  clear(): void {
    this._diagnostics.length = 0;
  }
}

/** Format a single diagnostic as a human-readable string. */
export function formatDiagnostic(d: Diagnostic): string {
  const loc = d.location !== undefined
    ? ` (${[d.location.file, d.location.line, d.location.column]
        .filter(Boolean)
        .join(':')})`
    : '';
  return `[${d.severity.toUpperCase()}] ${d.code}: ${d.message}${loc}`;
}
