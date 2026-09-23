#!/usr/bin/env node
/**
 * The `streetui` executable. Thin shim: parse `process.argv`, run the CLI, and
 * exit with the code the command returned. All logic lives in `runCli`.
 */

import { runCli } from './index.js';

runCli(process.argv.slice(2))
  .then((result) => {
    if (result.exitCode !== 0) process.exitCode = result.exitCode;
  })
  .catch((err: unknown) => {
    // Last-resort guard; runCli already handles expected errors.
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
