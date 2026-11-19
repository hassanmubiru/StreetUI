#!/usr/bin/env node
/**
 * `streetui-playground` — the Playground server entry.
 * Parses argv, resolves the project, and runs the local Playground.
 */

import { resolveProject, CLI_VERSION } from '@streetui/cli';
import { runPlayground } from './server.js';

function parseArgs(argv: string[]) {
  const args = {
    dir: process.cwd(),
    host: 'localhost',
    port: undefined as number | undefined,
    token: undefined as string | undefined,
    sessionId: undefined as string | undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') args.port = Number(argv[++i]);
    else if (a === '--host') args.host = argv[++i] as string;
    else if (a === '--token') args.token = argv[++i];
    else if (a === '--session-id') args.sessionId = argv[++i];
    else if (a && !a.startsWith('-')) args.dir = a;
  }
  return args;
}

const logger = {
  info: (m: string) => console.log(m),
  success: (m: string) => console.log(m),
  warn: (m: string) => console.warn(m),
  error: (m: string) => console.error(m),
  plain: (m: string) => console.log(m),
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const project = await resolveProject(args.dir, { requireEntry: true });

  const running = await runPlayground({
    project,
    logger,
    host: args.host,
    ...(args.port !== undefined ? { port: args.port } : {}),
    ...(args.token !== undefined ? { token: args.token } : {}),
    ...(args.sessionId !== undefined ? { sessionId: args.sessionId } : {}),
  });

  void running;

  const shutdown = (): void => {
    void running.stop().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
