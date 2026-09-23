/**
 * A real, tiny HTTP API for the account example and its tests. No mocking —
 * the app fetches plans and creates accounts over real HTTP.
 *
 *   GET  /api/plans       → 200 [{ id, name }, ...]
 *   POST /api/accounts    → 201 { id, email }            (creates an account)
 *                         → 409 { error } if the email is already registered
 *                         → 500 { error } when `setFail(true)` is set
 *
 * `createAccountApi().listen()` resolves with the bound base URL (random port)
 * and a `close()` to shut it down.
 */
import { createServer, type Server } from 'node:http';

export interface Plan {
  readonly id: string;
  readonly name: string;
}

export interface AccountRecord {
  readonly id: number;
  readonly email: string;
}

const DEFAULT_PLANS: readonly Plan[] = [
  { id: 'free', name: 'Free' },
  { id: 'pro', name: 'Pro' },
  { id: 'team', name: 'Team' },
];

export interface AccountApi {
  readonly server: Server;
  listen(): Promise<string>;
  close(): Promise<void>;
  setFail(fail: boolean): void;
  /** Seed an already-registered email to exercise the 409 conflict path. */
  register(email: string): void;
  /** Emails created so far (for assertions). */
  accounts(): readonly AccountRecord[];
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function createAccountApi(initial: readonly Plan[] = DEFAULT_PLANS): AccountApi {
  const plans = initial;
  const taken = new Set<string>();
  const created: AccountRecord[] = [];
  let forceFail = false;
  let nextId = 1;

  const server = createServer((req, res) => {
    void (async (): Promise<void> => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const json = (status: number, payload: unknown): void => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(payload));
      };

      if (forceFail) return json(500, { error: 'Internal Server Error' });

      if (req.method === 'GET' && url.pathname === '/api/plans') {
        return json(200, plans);
      }

      if (req.method === 'POST' && url.pathname === '/api/accounts') {
        const body = await readBody(req);
        const parsed = JSON.parse(body || '{}') as { email?: string };
        const email = (parsed.email ?? '').toLowerCase();
        if (taken.has(email)) return json(409, { error: 'Email already registered' });
        taken.add(email);
        const record: AccountRecord = { id: nextId++, email };
        created.push(record);
        return json(201, record);
      }

      json(404, { error: 'Not found' });
    })().catch(() => {
      res.statusCode = 500;
      res.end('{"error":"server"}');
    });
  });

  return {
    server,
    listen(): Promise<string> {
      return new Promise((resolve) => {
        server.listen(0, () => {
          const addr = server.address();
          const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
          resolve(`http://127.0.0.1:${port}`);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
    setFail(fail: boolean): void {
      forceFail = fail;
    },
    register(email: string): void {
      taken.add(email.toLowerCase());
    },
    accounts(): readonly AccountRecord[] {
      return created;
    },
  };
}
