#!/usr/bin/env node
/**
 * The `streetui` executable.
 *
 * StreetUI ships a single CLI as part of the one `streetui` package: `streetui
 * create | dev | build | start`, plus `--help` / `--version`. This is a thin
 * shim over the already-implemented CLI (`runCli`); all logic lives there. The
 * CLI implementation is bundled into this package, so users never install a
 * separate `@streetui/cli`.
 */
import { runCli } from '@streetui/cli';

runCli(process.argv.slice(2))
  .then((result) => {
    if (result.exitCode !== 0) process.exitCode = result.exitCode;
  })
  .catch((err: unknown) => {
    // Last-resort guard; runCli already handles expected errors.
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
