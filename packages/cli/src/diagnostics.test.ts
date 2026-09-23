import { describe, it, expect } from 'vitest';
import {
  CliError,
  fromEsbuildMessage,
  formatProblem,
  formatBuildFailure,
} from './diagnostics.js';

describe('CliError', () => {
  it('defaults the exit code to 1 and keeps the message', () => {
    const e = new CliError('boom');
    expect(e.message).toBe('boom');
    expect(e.exitCode).toBe(1);
    expect(e.suggestion).toBeUndefined();
  });

  it('carries a suggestion and custom exit code when provided', () => {
    const e = new CliError('nope', { suggestion: 'try this', exitCode: 2 });
    expect(e.suggestion).toBe('try this');
    expect(e.exitCode).toBe(2);
  });
});

describe('fromEsbuildMessage', () => {
  it('preserves a real location and converts columns to 1-based', () => {
    const p = fromEsbuildMessage({
      text: 'Unexpected token',
      location: { file: 'src/app.ts', line: 42, column: 16, lineText: '  const x =' },
    });
    expect(p.file).toBe('src/app.ts');
    expect(p.line).toBe(42);
    expect(p.column).toBe(17); // 16 (0-based) + 1
  });

  it('invents no location when esbuild reports none', () => {
    const p = fromEsbuildMessage({ text: 'general failure', location: null });
    expect(p.file).toBeUndefined();
    expect(p.line).toBeUndefined();
    expect(p.column).toBeUndefined();
  });

  it('suggests running install for an unresolved @streetui package', () => {
    const p = fromEsbuildMessage({
      text: 'Could not resolve "@streetui/renderer"',
      location: null,
    });
    expect(p.suggestion).toMatch(/npm install/);
  });
});

describe('formatProblem', () => {
  it('renders file:line:column, message and the offending source line', () => {
    const out = formatProblem({
      message: 'boom',
      file: 'src/app.ts',
      line: 3,
      column: 5,
      lineText: '  broken()',
    });
    expect(out).toContain('src/app.ts:3:5');
    expect(out).toContain('boom');
    expect(out).toContain('broken()');
  });
});

describe('formatBuildFailure', () => {
  it('uses the StreetUI header and pluralises the count', () => {
    const one = formatBuildFailure([{ message: 'a' }]);
    expect(one).toContain('StreetUI build error');
    expect(one).toContain('1 error');
    const two = formatBuildFailure([{ message: 'a' }, { message: 'b' }]);
    expect(two).toContain('2 errors');
  });
});
