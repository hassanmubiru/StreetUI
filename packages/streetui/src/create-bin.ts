#!/usr/bin/env node
/**
 * The `create-streetui` executable, invoked by `npm create streetui@latest
 * <dir>` (equivalently `npx create-streetui <dir>`). npm passes the target
 * directory (and any extra flags) as argv, so we prepend the implicit `create`
 * command and hand off to the bundled CLI's `runCli`.
 */
import { runCli } from '@streetui/cli';

const argv = process.argv.slice(2);
// `npm create streetui my-app` → argv is ["my-app"]; make it a create command.
const withCommand = argv[0] === 'create' ? argv : ['create', ...argv];

runCli(withCommand)
  .then((result) => {
    if (result.exitCode !== 0) process.exitCode = result.exitCode;
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
