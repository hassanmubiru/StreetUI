/**
 * StreetJS website — reference content: API index, examples, plugins,
 * changelog, blog and about. Derived only from the v1.2.8 type declarations
 * recorded in this project's notes. Names listed here were observed; anything
 * not observed is not listed.
 */

import type { ApiGroup, BlogPost, Block, ChangelogEntry, ExampleItem, PluginItem } from './content-types.js';

const p = (text: string): Block => ({ kind: 'p', text });
const list = (...items: string[]): Block => ({ kind: 'list', items });

export const API_GROUPS: readonly ApiGroup[] = [
  {
    id: 'http',
    importPath: 'streetjs/http',
    title: 'HTTP application',
    summary: 'Create and run the server.',
    entries: [
      { name: 'streetApp', signature: 'streetApp(options?: { port, host, globalMiddlewares, requestTimeoutMs, maxBodyBytes, uploadsDir }): StreetHttpApp', note: 'Factory for the HTTP application.' },
      { name: 'StreetHttpApp', signature: 'listen(port?, host?) · close() · registerController(ctor) · use(mw) · openApiSpec() · loadPlugin() · unloadPlugin() · .server', note: 'Imported from streetjs/http, not the root barrel. .server is a Node http.Server.' },
    ],
  },
  {
    id: 'decorators',
    importPath: 'streetjs',
    title: 'Decorators',
    summary: 'Routing, validation and metadata decorators.',
    entries: [
      { name: '@Controller', signature: '@Controller(prefix, ...middleware)', note: 'Marks a class as a controller.' },
      { name: '@Get / @Post / @Put / @Delete / @Patch', signature: '@Get(path, ...middleware)', note: 'Route methods.' },
      { name: '@Validate', signature: '@Validate(schema)', note: 'FieldRule types: string, number, boolean, email, uuid; required, min, max, pattern.' },
      { name: '@ApiOperation', signature: '@ApiOperation({ summary, description, tags, responses })', note: 'OpenAPI metadata for openApiSpec().' },
      { name: '@Config', signature: '@Config(envKey, { encrypted, required })', note: 'Binds a property to an environment variable.' },
      { name: '@Command', signature: '@Command(name, description?)', note: 'CLI command; the class needs a no-argument constructor.' },
      { name: '@Roles / @Permissions', signature: '@Roles(...roles) · @Permissions(...perms)', note: 'Declare authorisation requirements.' },
      { name: '@Job', signature: '@Job(type)', note: 'Declares a job handler class.' },
    ],
  },
  {
    id: 'context',
    importPath: 'streetjs',
    title: 'Context and middleware',
    summary: 'The per-request object.',
    entries: [
      { name: 'StreetContext', signature: 'req, res, path, method, headers, params, query, body, state, user, files, rawBody?, startTime: bigint', note: 'No ctx.db, ctx.request or ctx.status().' },
      { name: 'ctx.json / text / html / send', signature: 'json(data, status?) · text · html · send(status)', note: 'Response helpers; ctx.sent reports completion.' },
      { name: 'cookie / setCookie', signature: 'cookie(name): string | undefined · setCookie(name, value, options)', note: 'Options: maxAge (no expires); secure defaults on only in production.' },
      { name: 'MiddlewareFn', signature: '(ctx, next) => Promise<void>', note: '' },
      { name: 'AuthenticatedUser', signature: '{ id, email, roles }', note: '' },
    ],
  },
  {
    id: 'container',
    importPath: 'streetjs',
    title: 'Container',
    summary: 'Process-wide dependency container.',
    entries: [
      { name: 'container', signature: 'register(ctor, instance) · resolve(ctor) · has(ctor) · reset()', note: 'registerController resolves the controller once through it.' },
    ],
  },
  {
    id: 'validation',
    importPath: 'streetjs',
    title: 'Validation',
    summary: 'Zod-based request validation.',
    entries: [
      { name: 'validate', signature: 'validate({ body, query, params, headers, cookies })', note: 'Builds a middleware from Zod schemas.' },
      { name: 'validated', signature: 'validated(ctx, schemas)', note: 'Validates inside a handler.' },
      { name: 'ValidationError', signature: '{ error: "ValidationError", issues: [{ path, message }] } · HTTP 400', note: 'Root barrel only; no message field.' },
      { name: 'validateEnv / validateArgv', signature: 'validateEnv(zodSchema)', note: 'validateEnv exits the process on failure.' },
    ],
  },
  {
    id: 'database',
    importPath: 'streetjs/database',
    title: 'Database',
    summary: 'Native PostgreSQL driver, pool and repository.',
    entries: [
      { name: 'PgPool', signature: 'new PgPool({ host, port, user, password, database, connectTimeoutMs?, minConnections?, maxConnections?, idleTimeoutMs?, acquireTimeoutMs? })', note: 'All five connection fields required; connects lazily.' },
      { name: 'PgPool methods', signature: 'initialize · ensureInitialized · acquire · release(conn) · query(sql, params?) · stream(sql) · transaction(fn) · close', note: 'Getters: size, idle, waiting, avgAcquireMs.' },
      { name: 'DbResult', signature: '{ rows: Record<string, string | null>[]; rowCount; command }', note: 'Every column is a string.' },
      { name: 'StreetPostgresRepository<T>', signature: 'findById · findAll(limit?, offset?) · create · update · delete · count · streamAll(sql, params?)', note: 'Constructed with a PgPool.' },
      { name: 'LedgerTransactionService', signature: 'new LedgerTransactionService(pool)', note: 'Exported alongside the repository.' },
      { name: 'PgHaClient', signature: 'routing: "primary" | "prefer-replica" | "any"', note: 'No TLS.' },
    ],
  },
  {
    id: 'migrations',
    importPath: 'streetjs/migrations',
    title: 'Migrations and seeding',
    summary: 'Versioned SQL and idempotent-by-hash seeds.',
    entries: [
      { name: 'StreetMigrationRunner', signature: 'new StreetMigrationRunner(pool) · run(dir) · rollback(dir, steps = 1)', note: 'Tracks filenames in street_migrations.' },
      { name: 'StreetSeeder', signature: 'StreetSeeder.run(pool, seedFile): { skipped, hash, name }', note: 'Tracks content hash in street_seed_runs.' },
      { name: 'MigrationDiffer', signature: '', note: 'Emits DROP TABLE for tables with no entity class; avoid on hand-written schemas.' },
    ],
  },
  {
    id: 'security',
    importPath: 'streetjs/security',
    title: 'Security',
    summary: 'Tokens, sessions, authorisation and hardening.',
    entries: [
      { name: 'JwtService', signature: 'new JwtService(secret ≥ 32 chars) · sign · verify · decode', note: '' },
      { name: 'SessionManager', signature: 'new SessionManager(hexKey: 64 hex chars) · encrypt · decrypt', note: 'Authenticated encryption.' },
      { name: 'RbacService / rbacGuard', signature: 'new RbacService(hierarchy, rolePermissions) · rbacGuard(service, options)', note: 'hasRole ignores hierarchy; do not use rbacGuard globally.' },
      { name: 'KeyRing / FieldCipher / generateEncryptionKey', signature: '', note: 'Field-level encryption helpers.' },
      { name: 'timingSafeStringEqual / constantTimeEqual', signature: 'constantTimeEqual(a, b)', note: 'Constant-time comparison.' },
      { name: 'Middleware', signature: 'authMiddleware · requireRoles · securityHeaders · corsMiddleware · csrfMiddleware · securityHeadersMiddleware · sessionRevocationMiddleware · apiKeyMiddleware', note: 'See the HTTP hardening page for edge cases.' },
      { name: 'Other', signature: 'StreetSessionStore · AuditWriter · RefreshTokenService · TokenReplayError · MfaService · verifyTotp · mfaGuard · verifyMfaStepUp · ApiKeyService · buildCsp · computeSecurityHeaders · DEFAULT_CSP', note: 'Names recorded; signatures not inspected.' },
    ],
  },
  {
    id: 'jobs',
    importPath: 'streetjs',
    title: 'Jobs, cron and workflows',
    summary: 'Background processing on Postgres.',
    entries: [
      { name: 'JobQueue', signature: 'new JobQueue(pool, opts) · enqueue({ type, payload?, runAt? }) · register(type, handler) · registerClass · setRetryPolicy · metrics() · start · stop', note: 'metrics(): { pending, inFlight, failed, succeeded, byType }.' },
      { name: 'registerJobMetricsRoute', signature: 'registerJobMetricsRoute(app, queue)', note: 'Serves GET /api/jobs/metrics.' },
      { name: 'CronScheduler', signature: 'register(cron, name, fn) · start · stop', note: 'Throws CronParseError eagerly.' },
      { name: 'WorkflowEngine', signature: 'new WorkflowEngine(pool) · define(name, steps) · start(name, input) · resume(id)', note: 'Step: { name, run, compensate?, timeoutMs?, condition? }.' },
      { name: 'SagaOrchestrator', signature: 'execute(steps)', note: 'In-memory; reverse compensation.' },
    ],
  },
  {
    id: 'health',
    importPath: 'streetjs',
    title: 'Health and observability',
    summary: 'Probes, logging and correlation.',
    entries: [
      { name: 'registerHealthRoutes', signature: 'GET /health/live · GET /health/ready', note: 'Backed by HealthCheckRegistry.' },
      { name: 'Logger / correlationMiddleware', signature: 'correlationMiddleware(logger)', note: 'Metadata spreads last; message/level/timestamp/service are reserved.' },
    ],
  },
  {
    id: 'infra',
    importPath: 'streetjs/ratelimit · streetjs/cache',
    title: 'Rate limiting, Redis and cache',
    summary: 'Supporting infrastructure.',
    entries: [
      { name: 'RateLimiter / RateLimitException', signature: '', note: 'Exception is HTTP 429 with Retry-After.' },
      { name: 'RedisRateLimitStore / InMemoryRateLimitStore', signature: '', note: 'Redis prefix "ratelimit:"; in-memory is per process.' },
      { name: 'RedisClient', signature: 'connect · command · get · set(k, v, ttl?) · del · publish · subscribe · close', note: 'Minimal RESP2; no TLS, reconnect or timeout.' },
      { name: 'cache', signature: '', note: 'An LRU only.' },
    ],
  },
  {
    id: 'subpaths',
    importPath: 'package exports',
    title: 'Subpath exports',
    summary: 'Every subpath listed in package.json exports.',
    entries: [
      { name: 'Subpaths', signature: '. · /http · /router · /database · /pool · /repository · /migrations · /security · /session · /vault · /ratelimit · /xss · /websocket · /sse · /cache · /telemetry · /cluster · /cli · /multipart · /webhook · /exceptions · /browser · /resilience · /redis-cluster · /pg-ha', note: 'Only http, database, pool, repository, migrations, security, session, ratelimit and cache were read; the rest are listed for existence only.' },
    ],
  },
];

export const EXAMPLES: readonly ExampleItem[] = [
  {
    slug: 'hello-controller',
    title: 'A minimal controller',
    summary: 'streetApp, @Controller and @Get.',
    sample: { label: 'src/main.ts', language: 'ts', code: "import 'reflect-metadata';\nimport { Controller, Get } from 'streetjs';\nimport { streetApp } from 'streetjs/http';\n\n@Controller('/api/hello')\nclass HelloController {\n  @Get('/')\n  hello(ctx: { json(data: unknown, status?: number): void }) {\n    ctx.json({ message: 'hello' });\n  }\n}\n\nconst app = streetApp({ port: 3000 });\napp.registerController(HelloController);\nawait app.listen();" },
  },
  {
    slug: 'validated-body',
    title: 'Validating a request body',
    summary: '@Validate with FieldRule types.',
    sample: { label: 'Controller method', language: 'ts', code: "@Post('/')\n@Validate({ body: {\n  email: { type: 'email', required: true },\n  name:  { type: 'string', required: true, min: 1, max: 80 },\n} })\ncreate(ctx: { body: unknown; json(d: unknown, s?: number): void }) {\n  ctx.json({ created: true }, 201);\n}" },
  },
  {
    slug: 'pool-transaction',
    title: 'A Postgres transaction',
    summary: 'PgPool.transaction with a guard checked via rowCount.',
    sample: { label: 'Transfer with a WHERE guard', language: 'ts', code: "await pool.transaction(async (conn) => {\n  const debit = await conn.query(\n    'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1',\n    ['500', 'a1'],\n  );\n  if (debit.rowCount !== 1) throw new Error('insufficient funds');\n  await conn.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', ['500', 'b2']);\n});" },
  },
  {
    slug: 'run-migrations',
    title: 'Running migrations at startup',
    summary: 'StreetMigrationRunner with a migrations directory.',
    sample: { label: 'bootstrap.ts', language: 'ts', code: "import { StreetMigrationRunner } from 'streetjs';\n\nawait new StreetMigrationRunner(pool).run('./migrations');\n// ./migrations/001_create_users.sql\n// ./migrations/001_create_users.rollback.sql" },
  },
  {
    slug: 'job-queue',
    title: 'A background job',
    summary: 'JobQueue.register, enqueue and a retry policy.',
    sample: { label: 'jobs.ts', language: 'ts', code: "const queue = new JobQueue(pool, { concurrency: 2 });\nqueue.setRetryPolicy('email.welcome', {\n  maxAttempts: 5, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 60000,\n});\nqueue.register('email.welcome', async (payload, { attempt }) => { /* ... */ });\nawait queue.enqueue({ type: 'email.welcome', payload: { userId: '42' } });\nqueue.start();" },
  },
  {
    slug: 'health-routes',
    title: 'Health and job metrics routes',
    summary: 'registerHealthRoutes and registerJobMetricsRoute.',
    sample: { label: 'routes', language: 'ts', code: "// registerHealthRoutes(app, registry)  -> GET /health/live, GET /health/ready\n// registerJobMetricsRoute(app, queue)    -> GET /api/jobs/metrics\n// Argument shapes beyond (app, ...) were not inspected; check your .d.ts." },
  },
];

export const PLUGINS: readonly PluginItem[] = [
  {
    id: 'loadPlugin',
    title: 'StreetHttpApp.loadPlugin / unloadPlugin',
    summary: 'The application object exposes loadPlugin() and unloadPlugin(). Their parameter types were not inspected.',
    status: 'Present in v1.2.8',
  },
  {
    id: 'scoped-packages',
    title: 'Scoped @streetjs/* packages',
    summary: 'Twenty-one scoped packages (router, postgres, pool, repository, migrations, session, security, context, container, cache, cluster, exceptions, multipart, ratelimit, telemetry, webhook-dispatcher, websocket, xss, store, diagnostics, schema-inspector) are the framework\'s own modules, not third-party plugins.',
    status: 'First-party packages',
  },
];

export const PLUGINS_NOTE =
  'No official third-party plugin registry, marketplace or plugin list was found in the v1.2.8 package, so none is shown. This page will not list community plugins that cannot be verified.';

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '1.2.8',
    summary: 'The version this website was checked against.',
    items: [
      'This is the only StreetJS version recorded here.',
      'No release notes or git history were available, so earlier versions and per-release changes are not listed.',
      'The package ships README.md and two example migrations (001_create_users.sql and its rollback).',
      'For release history, see the official documentation at https://hassanmubiru.github.io/StreetJS/.',
    ],
  },
];

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: 'every-column-is-a-string',
    title: 'Every Postgres column is a string',
    summary: 'The native driver does no type decoding. What that does to booleans, integers and dates.',
    tag: 'Database',
    blocks: [
      p('StreetJS ships its own PostgreSQL wire driver. It requests the text format and returns every column as a string or null. That is simple and fast to implement, and it has consequences you meet quickly.'),
      list(
        'A boolean is "t" or "f", so Boolean("f") is true.',
        'An integer is "5", and "10" < "9" is true when you sort strings.',
        'numeric stays "1299.00", unsafe as a float for money.',
        'A bigint can exceed Number.MAX_SAFE_INTEGER.',
        'A timestamptz looks like "2026-08-19 10:30:00+00", which is not ISO 8601.',
      ),
      p('Convert once, at the boundary, and never return res.rows directly from an endpoint: it leaks snake_case column names and string values to clients.'),
    ],
  },
  {
    slug: 'global-rbac-guard',
    title: 'The global rbacGuard that allows everything',
    summary: 'Why an authorisation guard in globalMiddlewares quietly lets every request through.',
    tag: 'Security',
    blocks: [
      p('Dispatch is the last step in the middleware pipeline. The required roles and permissions are written to ctx.state when the matching route is dispatched, so a guard placed in globalMiddlewares runs before they exist and finds nothing to enforce.'),
      p('Attach the guard at @Controller(prefix, guard) or @Get(path, guard). Prefer a guard that takes its permissions explicitly at the call site, and check permissions rather than roles, because hasRole ignores the hierarchy.'),
    ],
  },
  {
    slug: 'csrf-and-login',
    title: 'Why global CSRF protection breaks login',
    summary: 'The first POST has no token yet.',
    tag: 'Security',
    blocks: [
      p('csrfMiddleware registered globally rejects any state-changing request without a token. Login, registration and password reset are exactly the requests a visitor makes before they have one, so each returns 403.'),
      p('A short custom middleware that only enforces CSRF when ctx.user is set solves it in about a dozen lines.'),
    ],
  },
  {
    slug: 'seeds-by-hash',
    title: 'Seeds are tracked by content hash',
    summary: 'Edit a seed and the whole file runs again.',
    tag: 'Database',
    blocks: [
      p('StreetSeeder records a hash of each seed file. Unchanged files are skipped; edited files execute in full again. Idempotent here means it will not run twice — not that running it twice is harmless.'),
      p('Write every statement with ON CONFLICT ... DO UPDATE. Keep a way to force a re-run, since the hash cannot tell that rows were deleted by hand.'),
    ],
  },
  {
    slug: 'scrypt-maxmem',
    title: 'scrypt throws when maxmem is too low',
    summary: 'No password hasher ships; here is what to watch for when you use node:crypto.',
    tag: 'Security',
    blocks: [
      p('Node\'s scrypt defaults to a 32 MiB memory limit, while it needs about 128 × N × r bytes. With N = 2^15 and r = 8 that already exceeds the limit, and Node throws RangeError ERR_CRYPTO_INVALID_SCRYPT_PARAMS synchronously — outside any callback.'),
      p('Wrap the call in try/catch inside the promise body and always pass maxmem. Memory use does not grow with p, so raising p is a cheap way to add cost.'),
    ],
  },
  {
    slug: 'errors-leak-infrastructure',
    title: 'Framework 5xx errors can leak infrastructure names',
    summary: 'DatabaseConnectionError exposes PG variable names.',
    tag: 'Operations',
    blocks: [
      p('When the database is unreachable, DatabaseConnectionError carries the PGHOST and PGPORT variable names in its details. Without a sanitising middleware those reach the client.'),
      p('Register a global middleware that trusts the HTTP status and replaces the body for 5xx responses. Place it early in globalMiddlewares.'),
    ],
  },
  {
    slug: 'logger-metadata-clobber',
    title: 'Logger metadata can overwrite the message',
    summary: 'message, level, timestamp and service are reserved.',
    tag: 'Operations',
    blocks: [
      p('Logger spreads your metadata object last. If it contains a key called message, level, timestamp or service, it replaces the real value in the output line. Nest error objects under err, and expect each line twice when NODE_ENV is development.'),
    ],
  },
];

export const ABOUT_FACTS: readonly { label: string; value: string }[] = [
  { label: 'npm package', value: 'streetjs' },
  { label: 'CLI package', value: '@streetjs/cli' },
  { label: 'Version covered', value: '1.2.8' },
  { label: 'Runtime', value: 'Node >= 22, npm >= 10, ESM' },
  { label: 'Bundled', value: 'zod, reflect-metadata, ws' },
  { label: 'Peer dependency', value: 'typescript >= 5' },
  { label: 'Official docs', value: 'https://hassanmubiru.github.io/StreetJS/' },
];

export const ABOUT_UNVERIFIED: readonly string[] = [
  'Licence terms',
  'Repository URL, contributor list and release cadence',
  'Production users and adoption numbers',
  'Benchmark figures',
  'A scaffolding command (npx streetjs create)',
];
