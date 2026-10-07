/**
 * StreetJS website — documentation and guide content.
 *
 * Source of truth: facts recorded from the StreetJS v1.2.8 type declarations
 * (`.d.ts`). The package source itself was not available to this site, so
 * nothing here was executed against a live StreetJS install. Anything not
 * inspected is not stated.
 */

import type { Block, CodeSample, DocPage, GuidePage } from './content-types.js';

const p = (text: string): Block => ({ kind: 'p', text });
const h = (text: string): Block => ({ kind: 'h', text });
const list = (...items: string[]): Block => ({ kind: 'list', items });
const warn = (text: string): Block => ({ kind: 'warn', text });
const code = (label: string, body: string, language = 'ts'): Block => ({
  kind: 'code',
  sample: { label, language, code: body } satisfies CodeSample,
});

export const DOC_GROUPS: readonly string[] = ['Start', 'Core', 'Data', 'Security', 'Operations'];

export const DOCS: readonly DocPage[] = [
  {
    slug: 'overview',
    group: 'Start',
    title: 'Overview',
    summary: 'What StreetJS is, what it bundles, and the shape of its package.',
    blocks: [
      p('StreetJS is a production-grade TypeScript backend framework. Its tagline lists a native PostgreSQL wire driver, JWT, WebSockets, clustering, runtime input validation and field-level encryption — with no Express, no pg and no Prisma.'),
      h('Package facts'),
      list(
        'npm package name: streetjs (the companion CLI package is @streetjs/cli).',
        'Requires Node >= 22 and npm >= 10. The package is ESM.',
        'It bundles zod, reflect-metadata and ws, so you do not add Zod yourself. TypeScript >= 5 is a peer dependency.',
        'The root entry exports well over 250 symbols; subpath entries such as streetjs/http, streetjs/database and streetjs/security expose focused slices.',
        'Twenty-one scoped @streetjs/* packages exist (router, postgres, pool, repository, migrations, session, security and others).',
      ),
      h('Not inspected'),
      p('GraphQL, tenancy, microservices, the enterprise and cloud modules, SDK generation, the query builder, Prometheus/OpenTelemetry integrations and several subpaths (sse, websocket, webhook, vault, multipart, resilience, telemetry, cluster, redis-cluster, pg-ha) were not read in detail. This site states only that those subpaths exist.'),
      warn('The only StreetJS version these pages were checked against is 1.2.8. Official documentation lives at https://hassanmubiru.github.io/StreetJS/.'),
    ],
  },
  {
    slug: 'installation',
    group: 'Start',
    title: 'Installation',
    summary: 'Install the package and enable the TypeScript settings decorators need.',
    blocks: [
      p('Install the framework and TypeScript. There is no verified scaffolding command, so start from a plain project.'),
      code('Install', 'npm install streetjs\nnpm install --save-dev typescript @types/node', 'bash'),
      p('Decorators such as @Controller and @Get rely on reflect-metadata, experimentalDecorators and emitDecoratorMetadata. Import reflect-metadata once, at the entry point.'),
      code('tsconfig.json (relevant options)', '{\n  "compilerOptions": {\n    "module": "NodeNext",\n    "moduleResolution": "NodeNext",\n    "target": "ES2022",\n    "strict": true,\n    "experimentalDecorators": true,\n    "emitDecoratorMetadata": true\n  }\n}', 'json'),
      code('src/main.ts', "import 'reflect-metadata'; // once, before any decorated class\nimport { streetApp } from 'streetjs/http';\n\nconst app = streetApp({ port: 3000 });\nawait app.listen();", 'ts'),
    ],
  },
  {
    slug: 'http',
    group: 'Core',
    title: 'HTTP app and controllers',
    summary: 'Create an app with streetApp() and register decorated controllers.',
    blocks: [
      p('streetApp(options) comes from streetjs/http. Its options are port, host, globalMiddlewares, requestTimeoutMs, maxBodyBytes and uploadsDir. The returned StreetHttpApp offers listen, close, registerController, use, openApiSpec, loadPlugin and unloadPlugin, and exposes the underlying Node http.Server as .server (attach WebSockets before calling listen).'),
      p('Routes are declared with decorators: @Controller(prefix, ...middleware) on the class and @Get, @Post, @Put, @Delete or @Patch (path, ...middleware) on methods.'),
      code('A controller', "import 'reflect-metadata';\nimport { Controller, Get } from 'streetjs';\nimport { streetApp } from 'streetjs/http';\n\n@Controller('/api/hello')\nclass HelloController {\n  @Get('/')\n  hello(ctx: { json(data: unknown, status?: number): void }) {\n    ctx.json({ message: 'hello' });\n  }\n}\n\nconst app = streetApp({ port: 3000 });\napp.registerController(HelloController);\nawait app.listen();"),
      warn('registerController resolves the class through a process-wide container exactly once. If the controller needs constructor arguments, call container.register(Ctor, new Ctor(...)) first. A @Command class must have no constructor parameters.'),
      warn('StreetHttpApp is imported from streetjs/http. The root barrel exports only StreetApp and StreetAppOptions.'),
    ],
  },
  {
    slug: 'context',
    group: 'Core',
    title: 'The request context',
    summary: 'What StreetContext exposes — and what it does not.',
    blocks: [
      p('Every handler and middleware receives a StreetContext. Recorded members: req, res, path, method, headers, params, query, body, state, user, files, rawBody (optional), startTime (a bigint), and the response helpers json(data, status?), text, html and send(status). Cookies use cookie(name) and setCookie(name, value, options); setHeader sets headers; sent reports whether a response went out.'),
      h('Not present'),
      p('There is no ctx.db, no ctx.request.* and no ctx.status(). Create your own PgPool and pass it where needed.'),
      h('Cookies'),
      list(
        'setCookie appends to Set-Cookie, so repeated calls set several cookies.',
        'CookieOptions has maxAge but no expires.',
        'Defaults: httpOnly true, SameSite Lax, and secure only when NODE_ENV is production. Pass secure explicitly.',
      ),
      p('AuthenticatedUser is { id, email, roles }. A middleware has the type (ctx, next) => Promise<void>.'),
    ],
  },
  {
    slug: 'validation',
    group: 'Core',
    title: 'Validation',
    summary: 'Two validators: the small @Validate rules and the Zod-based validate().',
    blocks: [
      p('@Validate(schema) accepts a deliberately small rule set. Each field is a FieldRule with a type of string, number, boolean, email or uuid, plus required, min, max and pattern. It covers body, query and params. It does not support nested objects, arrays, enums or refinements.'),
      p('For richer input, use the Zod-based validate({ body, query, params, headers, cookies }) or validated(ctx, schemas), exported from the security validation module and the root barrel. A failure raises ValidationError, which renders as HTTP 400 with { error: "ValidationError", issues: [{ path, message }] }.'),
      warn('ValidationError has no message field and is exported only from the root barrel.'),
    ],
  },
  {
    slug: 'database',
    group: 'Data',
    title: 'PostgreSQL: PgPool',
    summary: 'The native driver, its pool, and why every column comes back as a string.',
    blocks: [
      p('PgPool takes host, port, user, password and database — all five are required. There is no connection-string or DATABASE_URL form. Optional tuning: connectTimeoutMs, minConnections, maxConnections, idleTimeoutMs, acquireTimeoutMs.'),
      p('The constructor does not connect; the first use initialises the pool, so a service can answer a liveness probe while Postgres is still starting. Methods: initialize, ensureInitialized, acquire, release, query(sql, params?), stream, transaction(fn) and close. Getters: size, idle, waiting and avgAcquireMs.'),
      code('Query and transaction', "import { PgPool } from 'streetjs';\n\nconst pool = new PgPool({\n  host: process.env.PGHOST ?? 'localhost',\n  port: Number(process.env.PGPORT ?? 5432),\n  user: process.env.PGUSER ?? 'app',\n  password: process.env.PGPASSWORD ?? '',\n  database: process.env.PGDATABASE ?? 'app',\n});\n\nconst res = await pool.query('SELECT id, email FROM users WHERE id = $1', ['42']);\n\nawait pool.transaction(async (conn) => {\n  // BEGIN has run; COMMIT on return, ROLLBACK if this throws.\n});"),
      h('Every column is a string'),
      p('The driver reads the text format and does no type decoding. DbResult is { rows: Record<string, string | null>[], rowCount, command }. A boolean arrives as "t" or "f" (Boolean("f") is true), an integer as "5" (so "10" < "9"), numeric as "1299.00", a bigint as a string that may exceed Number.MAX_SAFE_INTEGER, a timestamptz as "2026-08-19 10:30:00+00" (not ISO 8601), and jsonb as a string you must JSON.parse. NULL is null.'),
      h('Parameters'),
      p('null and undefined bind as NULL, booleans as "t"/"f", numbers as String(n), Dates as toISOString(), and everything else as String(param) — so an object binds as "[object Object]". Use JSON.stringify with $1::jsonb for objects.'),
      warn('SQLSTATE codes are discarded: errors are plain Error objects whose message is "PostgreSQL: message — detail", and e.code is undefined. Do not catch constraint violations. Report conflicts in SQL instead, for example ON CONFLICT ... DO NOTHING RETURNING and check rowCount.'),
      warn('There is no TLS on the Postgres or Redis clients. Authentication is SCRAM, but the session itself is plaintext.'),
    ],
  },
  {
    slug: 'repositories',
    group: 'Data',
    title: 'Repositories',
    summary: 'StreetPostgresRepository and the ledger transaction service.',
    blocks: [
      p('StreetPostgresRepository<T> is constructed with a PgPool and offers findById, findAll(limit?, offset?), create, update, delete, count and streamAll(sql, params?). LedgerTransactionService(pool) and a FieldEncryptor interface are exported alongside it.'),
      warn('Rows come from the same string-typed driver, so map them to your own types before returning them from an endpoint; otherwise snake_case keys and string values reach the browser.'),
    ],
  },
  {
    slug: 'migrations',
    group: 'Data',
    title: 'Migrations',
    summary: 'StreetMigrationRunner: naming, ordering, transactions and rollback.',
    blocks: [
      p('new StreetMigrationRunner(pool).run(dir) applies pending .sql files; .rollback(dir, steps = 1) reverts. Applied migrations are tracked by filename in the street_migrations table, so never rename one after it has run.'),
      list(
        'Accepted filenames match /^[a-zA-Z0-9][a-zA-Z0-9_\\-.]*\\.sql$/; files ending in .rollback.sql are excluded from the forward run.',
        'Files run in lexicographic order, so use zero-padded prefixes such as 001_ and 002_.',
        'Each file runs in its own transaction; multi-statement $$ bodies are safe.',
        'Rollback goes newest-first by applied_at and needs a sibling <name>.rollback.sql, otherwise it throws "Rollback file not found".',
      ),
      code('Run migrations', "import { PgPool, StreetMigrationRunner } from 'streetjs';\n\nconst pool = new PgPool({ /* host, port, user, password, database */ } as never);\nawait new StreetMigrationRunner(pool).run('./migrations');"),
      p('The package itself ships two example migration files: 001_create_users.sql and its rollback.'),
      warn('Do not use MigrationDiffer on hand-written schemas: it emits DROP TABLE for live tables that have no entity class.'),
    ],
  },
  {
    slug: 'seeding',
    group: 'Data',
    title: 'Seeding',
    summary: 'StreetSeeder tracks seeds by content hash, not by name.',
    blocks: [
      p('StreetSeeder.run(pool, seedFile) returns { skipped, hash, name }. It takes a single file, so ordering several seeds is your job.'),
      p('Seeds are recorded in street_seed_runs by a hash of the file contents. A seed that has not changed is skipped; a seed you edit runs again in full.'),
      warn('"Idempotent" here means "will not run twice", not "safe to run twice". Write every statement with ON CONFLICT ... DO UPDATE, because an edited seed re-executes completely. The hash also cannot notice rows you deleted by hand.'),
    ],
  },
  {
    slug: 'jwt-sessions',
    group: 'Security',
    title: 'JWT and sessions',
    summary: 'JwtService, SessionManager and the secrets they require.',
    blocks: [
      p('JwtService takes a secret of at least 32 characters and offers sign, verify and decode. SessionManager takes a key of exactly 64 hex characters (and checks its entropy) and offers encrypt and decrypt, authenticated encryption.'),
      code('Generate secrets', '# JWT secret (>= 32 chars)\nopenssl rand -base64 48\n\n# SessionManager key (exactly 64 hex chars)\nopenssl rand -hex 32', 'bash'),
      warn('StreetSessionStore stores the raw session id, so a database leak allows session hijacking. Its revoke() deletes the row, isRevoked() treats an absent row as revoked, and user_id is TEXT with no foreign key.'),
    ],
  },
  {
    slug: 'rbac',
    group: 'Security',
    title: 'Roles and permissions',
    summary: 'RbacService, rbacGuard — and where not to put the guard.',
    blocks: [
      p('RbacService is built from a role hierarchy and a role → permissions map. rbacGuard(service, options) produces a middleware. Decorators @Roles(...) and @Permissions(...) declare requirements.'),
      warn('Placing rbacGuard in globalMiddlewares silently authorises every request: dispatch is the last pipeline step, so the required roles and permissions are not yet on ctx.state when a global middleware runs. Attach the guard at @Controller(prefix, guard) or @Get(path, guard) level.'),
      warn('RbacService.hasRole ignores the hierarchy (exact string match). Only hasPermission inherits through the hierarchy, so authorise on permissions, not roles.'),
      warn('The audit "ip" comes from ctx.state.ip or the x-forwarded-for header, which a client can spoof. Set ctx.state.ip from ctx.req.socket.remoteAddress in a global middleware.'),
    ],
  },
  {
    slug: 'passwords',
    group: 'Security',
    title: 'Password hashing',
    summary: 'StreetJS ships no password hasher; use node:crypto scrypt with maxmem.',
    blocks: [
      p('No password hashing ships in the package. Node\'s built-in scrypt works; the parameters matter.'),
      code('scrypt with explicit maxmem', "import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';\n\nconst N = 2 ** 15, r = 8, p = 3;\nconst maxmem = 128 * N * r * 2; // scrypt needs 128*N*r; the default limit is 32 MiB\n\nexport function hashPassword(password: string): Promise<string> {\n  return new Promise((resolve, reject) => {\n    try {\n      const salt = randomBytes(16);\n      scrypt(password, salt, 64, { N, r, p, maxmem }, (err, key) => {\n        if (err) return reject(err);\n        resolve(`${salt.toString('hex')}:${key.toString('hex')}`);\n      });\n    } catch (e) {\n      reject(e); // scrypt can throw synchronously on bad parameters\n    }\n  });\n}"),
      p('Measured on a two-core sandbox with Node 22: N=2^14, r=8, p=1 took about 29 ms; N=2^15, p=1 about 62 ms; N=2^15, p=3 about 165 ms; N=2^16, p=1 about 124 ms; N=2^17, p=1 about 256 ms. Memory does not depend on p. Treat these as one machine\'s numbers, not a benchmark of yours.'),
      warn('scrypt throws RangeError ERR_CRYPTO_INVALID_SCRYPT_PARAMS ("memory limit exceeded") synchronously when maxmem is too low, so wrap the call and always pass maxmem. Compare hashes with timingSafeEqual.'),
    ],
  },
  {
    slug: 'http-hardening',
    group: 'Security',
    title: 'HTTP hardening',
    summary: 'CORS, CSRF and security-header middleware, with their sharp edges.',
    blocks: [
      p('The root exports authMiddleware, requireRoles, securityHeaders, corsMiddleware, csrfMiddleware, buildCsp, computeSecurityHeaders, securityHeadersMiddleware and DEFAULT_CSP. Rate limiting lives in the ratelimit subpath.'),
      warn('csrfMiddleware registered globally makes login impossible: the first POST to /auth/login, register or password-reset has no token yet and gets 403. Write a small middleware that checks CSRF only when ctx.user is present.'),
      warn('corsMiddleware(origins) throws on an empty array, answers OPTIONS with ctx.send(204) without calling next(), and never sets Access-Control-Allow-Credentials or Expose-Headers. If you need those, register your own middleware before it.'),
      warn('securityHeadersMiddleware sends HSTS even over plain HTTP unless you set hstsMaxAge to 0 in development.'),
    ],
  },
  {
    slug: 'jobs',
    group: 'Operations',
    title: 'Jobs, cron and workflows',
    summary: 'JobQueue, CronScheduler, WorkflowEngine and SagaOrchestrator.',
    blocks: [
      p('JobQueue(pool, options) is a Postgres-backed queue. Options: concurrency, pollIntervalMs, workerId, heartbeatIntervalMs, reaperIntervalMs, staleJobThresholdMs. Methods: enqueue({ type, payload?, runAt? }), register(type, handler), registerClass, setRetryPolicy(type, { maxAttempts, initialDelayMs, backoffMultiplier, maxDelayMs }), metrics(), start and stop. metrics() returns { pending, inFlight, failed, succeeded, byType }.'),
      code('Enqueue and handle', "import { JobQueue } from 'streetjs';\n\nconst queue = new JobQueue(pool, { concurrency: 2 });\nqueue.register('email.welcome', async (payload, { jobId, attempt }) => {\n  // do the work; throw to retry\n});\nawait queue.enqueue({ type: 'email.welcome', payload: { userId: '42' } });\nqueue.start();"),
      p('Workers self-heal through a heartbeat and a reaper; the default stale threshold is two minutes. CronScheduler().register(cron, name, fn) validates the expression eagerly and throws CronParseError. WorkflowEngine(pool).define(name, steps) / start(name, input) / resume(id) runs steps with optional compensate, timeoutMs and condition; a step timeout surfaces as WorkflowStepTimeoutError. SagaOrchestrator().execute(steps) is in-memory with reverse compensation.'),
      p('The exported *_MIGRATION_SQL constants (jobs, dead-letter queue, job history, workflows) are all CREATE TABLE IF NOT EXISTS; run them at bootstrap instead of copying their DDL.'),
    ],
  },
  {
    slug: 'health',
    group: 'Operations',
    title: 'Health checks',
    summary: 'registerHealthRoutes serves /health/live and /health/ready.',
    blocks: [
      p('HealthCheckRegistry plus registerHealthRoutes expose GET /health/live and GET /health/ready. Because PgPool connects lazily, liveness can pass while the database is still starting.'),
      warn('Health checks must reject with constant messages. createDbReadinessCheck is unreachable and leaks detail, so write your own readiness check.'),
      p('registerJobMetricsRoute(app, queue) additionally serves GET /api/jobs/metrics. This site\'s Playground page can probe these real routes against a base URL you supply.'),
    ],
  },
  {
    slug: 'config',
    group: 'Operations',
    title: 'Configuration',
    summary: 'validateEnv, @Config and defineConfig — and how they fail.',
    blocks: [
      list(
        'validateEnv(zodSchema) calls process.exit(1) on failure.',
        '@Config(envKey, { encrypted, required }) with loadConfig(instance, kek?) throws on the first missing variable and does no type coercion.',
        'defineConfig(schema) returns a lossy type.',
        'The shipped AppConfig reads PG_HOST, PG_PORT, PG_DATABASE, PG_USER and PG_PASSWORD, while the driver examples above use PGHOST-style names. Pick one and be consistent.',
      ),
      p('bare --flag arguments parse as true in CliKernel / parseArgv.'),
    ],
  },
  {
    slug: 'errors-logging',
    group: 'Operations',
    title: 'Errors and logging',
    summary: 'Exception statuses, what leaks, and Logger metadata rules.',
    blocks: [
      p('Exception classes map to statuses: BadRequest 400, Unauthorized 401, Forbidden 403, NotFound 404, Conflict 409, Unprocessable 422, Internal 500, ServiceUnavailable 503, DatabaseConnectionError 503, FeatureUnavailableInEdgeRuntimeError 501 and RateLimitException 429 (with Retry-After). StreetException.toJSON() nests details.'),
      warn('Framework 5xx exceptions can expose infrastructure detail — DatabaseConnectionError includes the PGHOST and PGPORT variable names. Add a global sanitising middleware keyed on HTTP status and register it early in globalMiddlewares.'),
      warn('Logger spreads metadata last, so message, timestamp, level and service are reserved: a meta key named message overwrites the log message. Nest errors under err. In NODE_ENV=development each line is written twice.'),
      p('correlationMiddleware(logger) reuses or generates an X-Correlation-ID header.'),
      warn('Request bodies are parsed before global middleware runs, so an oversized body produces an opaque 500 rather than a clean 413.'),
    ],
  },
  {
    slug: 'known-traps',
    group: 'Operations',
    title: 'Known traps (checklist)',
    summary: 'Every sharp edge recorded for v1.2.8 in one place.',
    blocks: [
      list(
        'Every Postgres column arrives as a string; map rows before sending them to clients.',
        'SQLSTATE codes are discarded; never catch constraint violations — report outcomes in SQL.',
        'rbacGuard in globalMiddlewares authorises everything; attach it per controller or route.',
        'hasRole ignores hierarchy; authorise on permissions.',
        'No password hashing ships; use scrypt with explicit maxmem.',
        'csrfMiddleware globally breaks login; scope it to authenticated requests.',
        'corsMiddleware throws on an empty origin list and omits credentials headers.',
        'Seeds are tracked by content hash; edited seeds re-run entirely.',
        'Framework 5xx errors leak infrastructure names; sanitise them.',
        'Logger metadata keys can overwrite message, level, timestamp and service.',
        'StreetSessionStore keeps raw session ids.',
        'No TLS on the Postgres or Redis clients.',
      ),
      p('Each item is explained, with its context, on the page for the relevant area.'),
    ],
  },
];

export const GUIDES: readonly GuidePage[] = [
  {
    slug: 'reading-postgres-rows',
    title: 'Reading rows from the Postgres driver',
    summary: 'Turn string-typed rows into real booleans, numbers, bigints and dates.',
    level: 'Beginner',
    blocks: [
      p('Because the driver does no type decoding, convert at the boundary — once, in one function per entity.'),
      code('Mapping a row', "type Row = Record<string, string | null | undefined>;\n\ninterface Product { id: string; name: string; inStock: boolean; priceCents: bigint; createdOn: string; }\n\nfunction toProduct(row: Row): Product {\n  return {\n    id: String(row['id']),\n    name: String(row['name']),\n    inStock: row['in_stock'] === 't',          // 't' / 'f', not truthiness\n    priceCents: BigInt(row['price_cents'] ?? '0'), // bigint-safe\n    createdOn: (row['created_at'] ?? '').slice(0, 10), // '2026-08-19 10:30:00+00' -> '2026-08-19'\n  };\n}"),
      p('Keep money in integer cents (or parse numeric strings with a decimal library) because "1299.00" as a float is unsafe. The Playground has a row decoder you can try.'),
    ],
  },
  {
    slug: 'protect-routes-with-rbac',
    title: 'Protecting routes with RBAC',
    summary: 'Attach the guard where it can actually see the requirement.',
    level: 'Intermediate',
    blocks: [
      p('Build an RbacService with a hierarchy and a role-to-permissions map, create a guard from it, and pass the guard as route-level middleware.'),
      code('Guard at route level', "import { Controller, Get } from 'streetjs';\n// rbacGuard(service, options): construct service once, pass guard per route.\n\n@Controller('/api/admin')\nclass AdminController {\n  // @Get(path, ...middleware): the guard goes here, NOT in globalMiddlewares.\n  @Get('/reports' /*, reportsGuard */)\n  reports(ctx: { json(d: unknown): void }) {\n    ctx.json({ ok: true });\n  }\n}"),
      warn('Authorise on permissions. hasRole matches the exact role string and ignores the hierarchy.'),
    ],
  },
  {
    slug: 'hash-passwords',
    title: 'Hashing passwords with scrypt',
    summary: 'A safe pattern when the framework gives you no hasher.',
    level: 'Beginner',
    blocks: [
      p('Use node:crypto scrypt with a random per-password salt, an explicit maxmem, and timingSafeEqual for comparison. Wrap the call in try/catch inside the promise body, because invalid parameters throw synchronously.'),
      p('The Passwords page lists parameters and timings measured on one machine. Re-measure on your own hardware and pick the largest cost your login path can afford.'),
    ],
  },
  {
    slug: 'migrations-and-seeds',
    title: 'Running migrations and seeds',
    summary: 'Order files, write rollbacks, and make seeds safe to re-run.',
    level: 'Intermediate',
    blocks: [
      p('Name files with zero-padded prefixes (001_create_users.sql). Give every migration a sibling .rollback.sql so rollback never throws. Run them at startup with StreetMigrationRunner.'),
      code('Seed file written for re-execution', "-- seeds/001_roles.sql\nINSERT INTO roles (name, description)\nVALUES ('admin', 'Administrators'), ('member', 'Members')\nON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;", 'sql'),
      warn('Seeds are tracked by content hash. If you edit a seed file, the whole file runs again.'),
    ],
  },
  {
    slug: 'background-jobs-and-health',
    title: 'Background jobs and health routes',
    summary: 'Queue work in Postgres and expose real health endpoints.',
    level: 'Intermediate',
    blocks: [
      p('Create the job tables at bootstrap with the exported migration SQL constants, register handlers, then call start(). Expose registerHealthRoutes for /health/live and /health/ready, and registerJobMetricsRoute for /api/jobs/metrics.'),
      p('Point this site\'s Playground at those routes to see live status without inventing any endpoint.'),
    ],
  },
  {
    slug: 'harden-an-api',
    title: 'Hardening an API',
    summary: 'A checklist built from the recorded middleware traps.',
    level: 'Intermediate',
    blocks: [
      list(
        'Register a sanitising error middleware early so infrastructure names never reach clients.',
        'Set ctx.state.ip from the socket address instead of trusting x-forwarded-for.',
        'Scope CSRF checks to authenticated requests so login still works.',
        'Pass an explicit, non-empty origin list to corsMiddleware and add credentials headers yourself if needed.',
        'Set hstsMaxAge to 0 in development.',
        'Use rate limiting from the ratelimit subpath; the in-memory store is per process, the Redis store uses the ratelimit: key prefix.',
      ),
    ],
  },
];
