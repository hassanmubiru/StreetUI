/**
 * v1.0 public API contract — @streetui/cli.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import { CLI_VERSION, parseArgs } from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'buildProject', 'CLI_VERSION', 'clientEnvDefine', 'CliError', 'createLogger',
  'createProject', 'defineConfig', 'findConfigFile', 'loadConfig', 'parseArgs',
  'PUBLIC_ENV_PREFIX', 'publicEnvNames', 'ReloadHub', 'resolveProject',
  'runCli', 'runDev', 'runStart', 'startServer',
] as const;

describe('@streetui/cli — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it('CLI_VERSION is aligned to the coordinated 1.3.0 release', () => {
    expect(CLI_VERSION).toBe('1.5.0');
  });

  it('parseArgs recognizes commands and flags', () => {
    expect(parseArgs(['build']).command).toBe('build');
    expect(parseArgs(['--version']).version).toBe(true);
    expect(parseArgs(['--help']).help).toBe(true);
  });
});
