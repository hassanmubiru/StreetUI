import { describe, it, expect } from 'vitest';
import { parseArgs } from './args.js';

describe('parseArgs', () => {
  it('reads the leading command word and positionals', () => {
    const a = parseArgs(['create', 'my-app']);
    expect(a.command).toBe('create');
    expect(a.positionals).toEqual(['my-app']);
  });

  it('parses --help and -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('parses --version and -v', () => {
    expect(parseArgs(['--version']).version).toBe(true);
    expect(parseArgs(['-v']).version).toBe(true);
  });

  it('parses --port as an integer and -p as its alias', () => {
    expect(parseArgs(['dev', '--port', '4000']).port).toBe(4000);
    expect(parseArgs(['dev', '-p', '8080']).port).toBe(8080);
  });

  it('reports an invalid port as an unknown/invalid option instead of guessing', () => {
    const a = parseArgs(['dev', '--port', 'abc']);
    expect(a.port).toBeUndefined();
    expect(a.unknown.some((u) => u.startsWith('port'))).toBe(true);
  });

  it('parses --host, --template and --dir values', () => {
    const a = parseArgs(['create', 'x', '--template', 'basic', '--dir', './here', '--host', '0.0.0.0']);
    expect(a.template).toBe('basic');
    expect(a.dir).toBe('./here');
    expect(a.host).toBe('0.0.0.0');
  });

  it('supports --name=value form', () => {
    expect(parseArgs(['dev', '--port=5000']).port).toBe(5000);
  });

  it('collects unknown flags rather than ignoring them', () => {
    const a = parseArgs(['dev', '--frobnicate']);
    expect(a.unknown).toContain('frobnicate');
  });

  it('does not treat a negative number as a flag', () => {
    const a = parseArgs(['create', '-1']);
    expect(a.positionals).toContain('-1');
    expect(a.unknown).toEqual([]);
  });

  it('returns undefined command for an empty argv', () => {
    expect(parseArgs([]).command).toBeUndefined();
  });
});
