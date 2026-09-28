import { describe, it, expect } from 'vitest';
import {
  frameworkError,
  StreetFrameworkError,
  formatDiagnosticContext,
  reportDiagnostic,
  consoleDiagnosticSink,
  describeError,
  reportError,
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

// ── Production error diagnostics (2.0 §7) ─────────────────────────────────────

describe('formatDiagnosticContext — §7 fields', () => {
  it('emits component/phase/element/signal identifiers', () => {
    const s = formatDiagnosticContext({
      component: 'UserCard',
      phase: 'render',
      nodeId: 'n7',
      element: 'div#app',
      route: '/users/42',
      resource: 'user',
      signal: 'currentUser',
    });
    expect(s).toContain('component=UserCard');
    expect(s).toContain('phase=render');
    expect(s).toContain('node=n7');
    expect(s).toContain('element=div#app');
    expect(s).toContain('route=/users/42');
    expect(s).toContain('resource=user');
    expect(s).toContain('signal=currentUser');
  });
});

describe('describeError', () => {
  it('captures name + message + context, and is production-safe by default (no stack)', () => {
    const err = new TypeError('cannot read x');
    const report = describeError(err, { component: 'UserCard', phase: 'render', route: '/u/1' });
    expect(report.name).toBe('TypeError');
    expect(report.message).toBe('cannot read x');
    expect(report.isError).toBe(true);
    expect(report.context?.component).toBe('UserCard');
    // No stack unless explicitly opted in.
    expect(report.stack).toBeUndefined();
    expect(report.cause).toBeUndefined();
  });

  it('includes the stack only when includeStack is set', () => {
    const err = new Error('boom');
    expect(describeError(err).stack).toBeUndefined();
    const withStack = describeError(err, undefined, { includeStack: true });
    expect(typeof withStack.stack).toBe('string');
    expect(withStack.stack).toContain('boom');
  });

  it('never enumerates own-properties of the error (no sensitive data leak)', () => {
    // A common failure mode: an error carrying a request body / token.
    const err = Object.assign(new Error('request failed'), {
      token: 'secret-abc',
      body: { password: 'hunter2' },
    });
    const report = describeError(err, undefined, { includeStack: true });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('secret-abc');
    expect(serialized).not.toContain('hunter2');
    expect(report.message).toBe('request failed');
  });

  it('describes a non-Error throw by type without exposing its contents', () => {
    const report = describeError({ password: 'hunter2' });
    expect(report.isError).toBe(false);
    expect(report.message).toBe('[non-Error Object]');
    expect(JSON.stringify(report)).not.toContain('hunter2');

    expect(describeError('plain string').message).toBe('plain string');
    expect(describeError(42).message).toBe('42');
    expect(describeError(null).message).toBe('null');
  });

  it('follows error.cause only when includeCause is set, with the same redaction', () => {
    const root = Object.assign(new Error('db down'), { dsn: 'postgres://secret' });
    const wrapper = new Error('load failed', { cause: root });
    expect(describeError(wrapper).cause).toBeUndefined();
    const withCause = describeError(wrapper, undefined, { includeCause: true });
    expect(withCause.cause?.name).toBe('Error');
    expect(withCause.cause?.message).toBe('db down');
    expect(JSON.stringify(withCause)).not.toContain('secret');
  });
});

describe('reportError', () => {
  it('routes a production-safe report to the sink at error level and returns it', () => {
    const calls: Array<{ msg: string; ctx: unknown }> = [];
    const sink: DiagnosticSink = { error: (msg, ctx) => calls.push({ msg, ctx }) };
    const report = reportError(sink, new Error('kaput'), {
      component: 'Dashboard',
      resource: 'metrics',
    });
    expect(calls.length).toBe(1);
    expect(calls[0]!.msg).toBe('kaput');
    expect((calls[0]!.ctx as { component?: string }).component).toBe('Dashboard');
    expect(report.name).toBe('Error');
    expect(report.stack).toBeUndefined(); // still safe by default
  });

  it('is a no-op (but still returns a report) when the sink is undefined', () => {
    let report;
    expect(() => {
      report = reportError(undefined, new Error('x'), { route: '/' });
    }).not.toThrow();
    expect(report!.message).toBe('x');
  });
});
