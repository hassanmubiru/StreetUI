import { describe, it, expect } from 'vitest';
import {
  frameworkError,
  StreetFrameworkError,
  formatDiagnosticContext,
  reportDiagnostic,
  consoleDiagnosticSink,
  type DiagnosticSink,
} from './observability.js';

describe('frameworkError / StreetFrameworkError', () => {
  it('embeds structured context in the message', () => {
    const err = frameworkError('boom', {
      package: '@streetui/renderer',
      operation: 'hydrate',
      nodeId: 'n1',
    });
    expect(err).toBeInstanceOf(StreetFrameworkError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('boom');
    expect(err.message).toContain('package=@streetui/renderer');
    expect(err.message).toContain('operation=hydrate');
    expect(err.message).toContain('node=n1');
    expect(err.context?.operation).toBe('hydrate');
  });

  it('produces a bare message when no context is given', () => {
    expect(frameworkError('bare').message).toBe('bare');
    expect(formatDiagnosticContext(undefined)).toBe('');
  });
});

describe('reportDiagnostic', () => {
  it('does nothing when the sink is undefined', () => {
    expect(() => reportDiagnostic(undefined, 'error', 'x')).not.toThrow();
  });

  it('calls only the matching level that exists on the sink', () => {
    const calls: Array<[string, string]> = [];
    const sink: DiagnosticSink = {
      warn: (m) => calls.push(['warn', m]),
    };
    reportDiagnostic(sink, 'warn', 'a warning');
    reportDiagnostic(sink, 'error', 'an error'); // no error() present → ignored
    expect(calls).toEqual([['warn', 'a warning']]);
  });

  it('swallows a throwing sink so the framework is never broken', () => {
    const sink: DiagnosticSink = {
      error() {
        throw new Error('sink blew up');
      },
    };
    expect(() => reportDiagnostic(sink, 'error', 'x')).not.toThrow();
  });
});

describe('consoleDiagnosticSink', () => {
  it('forwards each level with the formatted context suffix', () => {
    const lines: string[] = [];
    const sink = consoleDiagnosticSink({ warn: (m) => lines.push(m) });
    sink.warn?.('careful', { package: '@streetui/router', route: '/x' });
    expect(lines[0]).toBe('careful [package=@streetui/router, route=/x]');
  });
});
