/**
 * `streetui playground` — launches the StreetUI Playground.
 *
 * The Playground UI + orchestration live in `@streetui/playground`; this command
 * spawns its server process with the resolved project and relays its JSONL
 * `preview_ready` event as the "server ready" signal.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEventId } from './toolchain/json/events.js';
import type { ResolvedProject } from './project.js';
import type { Logger } from './logger.js';

export interface PlaygroundOptions {
  readonly project: ResolvedProject;
  readonly logger: Logger;
  readonly host?: string;
  readonly port?: number;
  readonly sessionId?: string;
}

export interface RunningPlayground {
  readonly url: string;
  readonly previewUrl: string;
  readonly port: number;
  readonly token: string;
  readonly sessionId: string;
  stop(): Promise<void>;
}

function resolvePlaygroundServer(): string {
  try {
    const require = createRequire(import.meta.url);
    return require.resolve('@streetui/playground/dist/index.js');
  } catch {
    // Monorepo fallback: sibling workspace package.
    const here = dirname(fileURLToPath(import.meta.url)); // packages/cli/src
    return join(here, '..', '..', 'playground', 'dist', 'index.js');
  }
}

export async function runPlaygroundCommand(options: PlaygroundOptions): Promise<RunningPlayground> {
  const { project, logger } = options;
  const serverPath = resolvePlaygroundServer();

  const args = [project.root];
  if (options.host !== undefined) args.push('--host', options.host);
  if (options.port !== undefined) args.push('--port', String(options.port));
  if (options.sessionId !== undefined) args.push('--session-id', options.sessionId);

  const child: ChildProcess = spawn(process.execPath, [serverPath, ...args], {
    cwd: project.root,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  return new Promise<RunningPlayground>((resolvePromise, reject) => {
    let stdout = '';
    let settled = false;

    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGTERM');
      reject(new Error(`${message}\n${stdout}`));
    };

    const timer = setTimeout(() => fail('Playground did not become ready'), 60000);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const lines = stdout.split('\n');
      stdout = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev: { event?: string; url?: string; previewUrl?: string; port?: number; host?: string; token?: string; sessionId?: string; reason?: string };
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.event === 'session_attached' && !settled) {
          settled = true;
          clearTimeout(timer);
          const url = ev.url ?? '';
          const token = ev.token ?? '';
          logger.success(`Playground ready: ${url}`);
          process.stdout.write(
            JSON.stringify({
              event: 'session_attached',
              eventId: makeEventId(),
              sessionId: ev.sessionId ?? '',
              schemaVersion: 1,
              framework: 'streetui',
              timestamp: new Date().toISOString(),
              url,
              previewUrl: ev.previewUrl ?? url,
              port: ev.port ?? 0,
              host: ev.host ?? 'localhost',
              token,
              status: 'attached',
            }) + '\n',
          );
          resolvePromise({
            url,
            previewUrl: ev.previewUrl ?? url,
            port: ev.port ?? 0,
            token,
            sessionId: ev.sessionId ?? '',
            stop: () =>
              new Promise<void>((res) => {
                child.once('exit', () => res());
                child.kill('SIGTERM');
              }),
          });
          return;
        }
        if (ev.event === 'session_stopped' && settled) {
          process.stdout.write(
            JSON.stringify({
              event: 'session_stopped',
              eventId: makeEventId(),
              sessionId: ev.sessionId ?? '',
              schemaVersion: 1,
              framework: 'streetui',
              timestamp: new Date().toISOString(),
              ...(ev.reason !== undefined ? { reason: ev.reason } : {}),
            }) + '\n',
          );
          child.kill('SIGTERM');
          return;
        }
      }
    });

    child.on('error', (error) => fail(`Playground failed to start: ${error.message}`));
    child.on('exit', (code) => {
      if (!settled) fail(`Playground exited early (${code})`);
    });
  });
}
