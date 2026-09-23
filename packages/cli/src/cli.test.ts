import { describe, it, expect } from 'vitest';
import { runCli, CLI_VERSION } from './index.js';
import type { Logger } from './logger.js';

/** A logger that records everything written, for assertions. */
function recordingLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const push = (m: string) => lines.push(m);
  return {
    lines,
    logger: { info: push, success: push, warn: push, error: push, plain: push },
  };
}

describe('runCli — help & version', () => {
  it('prints the version for --version with no command', async () => {
    const { logger, lines } = recordingLogger();
    const res = await runCli(['--version'], { logger });
    expect(res.exitCode).toBe(0);
    expect(lines.join('\n')).toContain(CLI_VERSION);
  });

  it('prints help for --help', async () => {
    const { logger, lines } = recordingLogger();
    const res = await runCli(['--help'], { logger });
    expect(res.exitCode).toBe(0);
    const out = lines.join('\n');
    expect(out).toContain('Usage:');
    expect(out).toContain('create');
    expect(out).toContain('dev');
    expect(out).toContain('build');
    expect(out).toContain('start');
  });

  it('prints help and exits non-zero when no command is given', async () => {
    const { logger, lines } = recordingLogger();
    const res = await runCli([], { logger });
    expect(res.exitCode).toBe(1);
    expect(lines.join('\n')).toContain('Usage:');
  });
});

describe('runCli — invalid usage', () => {
  it('rejects unknown flags with a message and exit 1', async () => {
    const { logger, lines } = recordingLogger();
    const res = await runCli(['dev', '--nope'], { logger });
    expect(res.exitCode).toBe(1);
    expect(lines.join('\n')).toMatch(/Unknown or invalid option/);
  });

  it('reports a clear error when create has no target directory', async () => {
    const { logger, lines } = recordingLogger();
    const res = await runCli(['create'], { logger, cwd: '/tmp/does-not-matter' });
    expect(res.exitCode).toBe(1);
    expect(lines.join('\n')).toMatch(/requires a target directory/);
  });
});
