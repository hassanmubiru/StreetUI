/**
 * A real, tiny HTTP API used by the data example and its tests.
 *
 * It serves product data from an in-memory store over real HTTP — there is no
 * mocking and the application never hardcodes product data; it always fetches
 * from this endpoint (or any compatible one).
 *
 *   GET /api/products            → 200 [{ id, name, price }, ...]
 *   GET /api/products?fail=1     → 500 (to exercise the error + retry path)
 *
 * The failure and latency behaviour can also be toggled at runtime via
 * `setFail(true)` / `setDelay(ms)` so a single running server can drive the
 * error→retry and in-flight-navigation tests without restarting.
 *
 * `createProductApi().listen()` resolves with the bound base URL (random port)
 * and a `close()` to shut it down.
 */
import { createServer, type Server } from 'node:http';

export interface Product {
  readonly id: number;
  readonly name: string;
  readonly price: number;
}

const DEFAULT_PRODUCTS: readonly Product[] = [
  { id: 1, name: 'Antminer S21', price: 3999 },
  { id: 2, name: 'Whatsminer M60', price: 3499 },
  { id: 3, name: 'Avalon A1466', price: 2899 },
];

export interface ProductApi {
  readonly server: Server;
  listen(): Promise<string>;
  close(): Promise<void>;
  /** Replace the backing data (still served over real HTTP). */
  setProducts(products: readonly Product[]): void;
  /** When true, every request responds 500 (regardless of the `fail` query). */
  setFail(fail: boolean): void;
  /** Artificially delay each response by `ms` milliseconds (for in-flight tests). */
  setDelay(ms: number): void;
}

export function createProductApi(initial: readonly Product[] = DEFAULT_PRODUCTS): ProductApi {
  let products: readonly Product[] = initial;
  let forceFail = false;
  let delayMs = 0;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const respond = (): void => {
      if (req.method === 'GET' && url.pathname === '/api/products') {
        if (forceFail || url.searchParams.get('fail') === '1') {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(products));
        return;
      }
      res.statusCode = 404;
      res.end('Not found');
    };
    if (delayMs > 0) setTimeout(respond, delayMs);
    else respond();
  });

  return {
    server,
    listen(): Promise<string> {
      return new Promise<string>((resolve) => {
        server.listen(0, () => {
          const addr = server.address();
          const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
          resolve(`http://localhost:${port}`);
        });
      });
    },
    close(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    setProducts(next: readonly Product[]): void {
      products = next;
    },
    setFail(fail: boolean): void {
      forceFail = fail;
    },
    setDelay(ms: number): void {
      delayMs = ms;
    },
  };
}
