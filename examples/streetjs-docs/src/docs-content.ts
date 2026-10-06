// Real StreetJS v1.2.8 documentation content
// All content verified from actual API surface

export interface DocSection {
  id: string;
  title: string;
  content: string;
  code?: string;
}

export const docSections: DocSection[] = [
  {
    id: 'installation',
    title: 'Installation',
    content: `StreetJS requires Node.js 22+ and npm 10+. The framework uses ES modules exclusively.

Install StreetJS and its CLI:

\`\`\`bash
npm install streetjs
npm install -D @streetjs/cli typescript
\`\`\`

**Important:** StreetJS bundles Zod (^4.4.3) internally. Do not add Zod as a separate dependency.

Your package.json must use ES modules:

\`\`\`json
{
  "type": "module"
}
\`\`\`

TypeScript configuration requires:
- \`experimentalDecorators: true\`
- \`emitDecoratorMetadata: true\`
- \`target: "ES2022"\` or higher`,
  },
  {
    id: 'bootstrap',
    title: 'Application Bootstrap',
    content: `Create your application entry point:

import 'reflect-metadata';
import { streetApp } from 'streetjs/http';
import { UserController } from './controllers/user.controller.js';

const app = streetApp({ 
  port: 3000,
  globalMiddlewares: [],
  requestTimeoutMs: 30000,
  maxBodyBytes: 1024 * 1024 // 1MB
});

app.registerController(UserController);

await app.listen();
console.log('Server running on http://localhost:3000');

The \`streetApp()\` function returns a \`StreetHttpApp\` with:
- \`listen(port?, host?)\` - Start HTTP server
- \`close()\` - Shutdown gracefully  
- \`registerController(ctor)\` - Register controller class
- \`use(middleware)\` - Add global middleware
- \`openApiSpec()\` - Generate OpenAPI specification
- \`server\` - Access underlying Node.js http.Server`,
  },
  {
    id: 'controllers',
    title: 'Controllers and Routing',
    content: `Controllers use TypeScript decorators for declarative routing.

**Available decorators:**
- \`@Controller(prefix)\` - Class decorator, sets base path
- \`@Get(path)\`, \`@Post(path)\`, \`@Put(path)\`, \`@Delete(path)\`, \`@Patch(path)\` - HTTP methods
- \`@Validate(schema)\` - Request validation
- \`@ApiOperation({...})\` - OpenAPI metadata
- \`@Roles(...roles)\` - RBAC authorization
- \`@Permissions(...perms)\` - Permission check

Example:

\`\`\`typescript
import { Controller, Get, Post, Validate } from 'streetjs';
import { z } from 'zod';

@Controller('/api/users')
export class UserController {
  constructor(private pool: PgPool) {}
  
  @Get('/')
  async list(ctx: StreetContext) {
    const result = await this.pool.query(
      'SELECT id, email FROM users LIMIT $1',
      [100]
    );
    ctx.json(result.rows);
  }
  
  @Post('/')
  @Validate({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(8)
    })
  })
  async create(ctx: StreetContext) {
    const { email, password } = ctx.body;
    // Implementation
    ctx.json({ id: newId, email }, 201);
  }
}
\`\`\`

**Important:** Controllers are resolved via dependency injection. Constructor parameters are automatically injected if registered in the container.`,
  },
  {
    id: 'context',
    title: 'Request Context',
    content: `Every route handler receives a \`StreetContext\` object:

**Readonly properties:**
- \`ctx.req\` - Node.js IncomingMessage
- \`ctx.res\` - Node.js ServerResponse  
- \`ctx.path\` - Request path
- \`ctx.method\` - HTTP method
- \`ctx.headers\` - Request headers
- \`ctx.startTime\` - Request start time (bigint)

**Mutable properties:**
- \`ctx.params\` - Route parameters
- \`ctx.query\` - Query string parsed
- \`ctx.body\` - Parsed request body
- \`ctx.state\` - Request-scoped state
- \`ctx.user\` - Authenticated user (if set)
- \`ctx.files\` - Uploaded files
- \`ctx.rawBody\` - Original body string (for webhook signatures)

**Response methods:**
- \`ctx.json(data, status?)\` - Send JSON
- \`ctx.text(string, status?)\` - Send plain text
- \`ctx.html(string, status?)\` - Send HTML
- \`ctx.send(status)\` - Send empty response
- \`ctx.setHeader(name, value)\`
- \`ctx.cookie(name)\` - Get cookie
- \`ctx.setCookie(name, value, opts)\` - Set cookie

**Important:** Cookies are secure-by-default with \`httpOnly: true\`, \`secure\` in production, and \`sameSite: 'Lax'\`.`,
  },
  {
    id: 'database',
    title: 'Database - Native PostgreSQL',
    content: `StreetJS includes a native PostgreSQL wire protocol driver with **no pg dependency**.

### ⚠️ CRITICAL: All columns return as strings

The driver requests text format for all columns. Every value comes back as \`string | null\`:

| PostgreSQL Type | JavaScript Receives | The Trap |
|---|---|---|
| BOOLEAN | \`'t'\` or \`'f'\` | \`Boolean('f') === true\` |
| INTEGER | \`'5'\` | \`'10' < '9'\` is true |
| BIGINT | \`'9007199254740993'\` | Exceeds Number.MAX_SAFE_INTEGER |
| NUMERIC | \`'1299.00'\` | Number() is a float, wrong for money |
| TIMESTAMPTZ | \`'2026-08-19 10:00:00+00'\` | Needs \`new Date()\` |
| JSONB | \`'{"a":1}'\` | Needs \`JSON.parse()\` |

**You must decode every column explicitly.** Never use \`row.column\` directly.

### Connection

\`\`\`typescript
import { PgPool } from 'streetjs/pool';

const pool = new PgPool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'secret',
  database: 'myapp',
  minConnections: 2,
  maxConnections: 20
});

await pool.initialize();
\`\`\`

**Important:** Connection options are discrete fields, not a connection string. No DATABASE_URL support.

### ⚠️ No TLS Support

The PostgreSQL driver uses plain TCP (\`node:net\` only). Fine for localhost, but for remote databases you need an external tunnel (cloud-sql-proxy, SSH, WireGuard, or pgbouncer with TLS).

### Queries

\`\`\`typescript
// Parameterized query (SQL injection safe)
const result = await pool.query(
  'SELECT id, email, created_at FROM users WHERE id = $1',
  [userId]
);

// Decode the results
for (const row of result.rows) {
  const id = parseInt(row.id!, 10);
  const email = row.email!;
  const createdAt = new Date(row.created_at!);
  // Use decoded values
}
\`\`\`

### Transactions

\`\`\`typescript
await pool.transaction(async (conn) => {
  await conn.query('INSERT INTO users (email) VALUES ($1)', [email]);
  await conn.query('INSERT INTO profiles (user_id) VALUES ($1)', [userId]);
  // Automatically commits, or rolls back on throw
});
\`\`\``,
  },
  {
    id: 'migrations',
    title: 'Database Migrations',
    content: `StreetJS includes a migration runner that tracks applied migrations by filename.

### Migration Files

Create \`.sql\` files with numeric prefixes for ordering:

\`\`\`
migrations/
├── 0001_create_users.sql
├── 0001_create_users.rollback.sql
├── 0002_create_posts.sql
└── 0002_create_posts.rollback.sql
\`\`\`

**Important:** Files are sorted lexicographically. Use zero-padded prefixes (0001, 0002, etc.).

### Running Migrations

\`\`\`typescript
import { StreetMigrationRunner } from 'streetjs/migrations';

const runner = new StreetMigrationRunner(pool);
await runner.run('./migrations');
\`\`\`

### Rollback

\`\`\`typescript
// Rollback last migration
await runner.rollback('./migrations', 1);

// Rollback last 3 migrations
await runner.rollback('./migrations', 3);
\`\`\`

**Important:** Every migration must have a corresponding \`.rollback.sql\` file or rollback will fail.

### Behavior

- Tracks applied migrations in \`street_migrations\` table
- Each file runs in its own transaction
- Multi-statement files are safe (uses simple query protocol)
- Rollbacks run newest-first
- Never rename an applied migration`,
  },
  {
    id: 'validation',
    title: 'Request Validation',
    content: `StreetJS uses Zod for request validation.

### Validation Middleware

\`\`\`typescript
import { validate } from 'streetjs/security';
import { z } from 'zod';

const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    age: z.number().int().min(18).optional()
  }),
  query: z.object({
    sendEmail: z.boolean().optional()
  })
};

@Post('/users')
@Validate(createUserSchema)
async create(ctx: StreetContext) {
  // ctx.body is now typed and validated
  const { email, password, age } = ctx.body;
}
\`\`\`

### Validation Errors

Validation failures throw \`ValidationError\` (HTTP 400) with structured issues:

\`\`\`json
{
  "error": "ValidationError",
  "issues": [
    {
      "path": "body.email",
      "message": "Invalid email"
    }
  ]
}
\`\`\`

**Important:** Never wrap ValidationError in custom error handling. It already provides the correct sanitized response.`,
  },
  {
    id: 'authentication',
    title: 'Authentication - JWT',
    content: `StreetJS includes JWT support with signing and verification.

### JWT Service

\`\`\`typescript
import { JwtService } from 'streetjs/security';

// Secret must be >= 32 characters
// Generate with: openssl rand -base64 48
const jwt = new JwtService(process.env.JWT_SECRET!);

// Sign a token
const token = await jwt.sign(
  { sub: user.id, email: user.email },
  { expiresIn: '1h' }
);

// Verify and decode
try {
  const payload = await jwt.verify(token);
  // payload.sub, payload.email, payload.exp
} catch (err) {
  // Invalid or expired token
}
\`\`\`

### Auth Middleware

\`\`\`typescript
import { authMiddleware } from 'streetjs';

@Controller('/api/protected')
export class ProtectedController {
  constructor(private jwt: JwtService) {}
  
  @Get('/profile')
  async getProfile(ctx: StreetContext) {
    // authMiddleware sets ctx.user
    const user = ctx.user; // { id, email, roles }
    ctx.json(user);
  }
}

// Register middleware globally
app.use(authMiddleware(jwt));
\`\`\``,
  },
  {
    id: 'rbac',
    title: 'Authorization - RBAC',
    content: `Role-Based Access Control with role hierarchy support.

### RBAC Service

\`\`\`typescript
import { RbacService } from 'streetjs/security';

// Define role hierarchy
const hierarchy = {
  admin: ['moderator', 'user'],
  moderator: ['user'],
  user: []
};

// Define permissions
const permissions = {
  admin: ['users:delete', 'posts:delete'],
  moderator: ['posts:edit'],
  user: ['posts:create']
};

const rbac = new RbacService(hierarchy, permissions);

// Check role (respects hierarchy)
rbac.hasRole(['moderator'], 'user'); // true
rbac.hasRole(['user'], 'admin'); // false

// Check permission
rbac.hasPermission(['moderator'], 'posts:edit'); // true
\`\`\`

### RBAC Guard

\`\`\`typescript
import { rbacGuard, Roles } from 'streetjs';

@Controller('/api/admin')
export class AdminController {
  @Delete('/users/:id')
  @Roles('admin')
  async deleteUser(ctx: StreetContext) {
    // Only admins can access
  }
}

// Or as middleware
app.use(rbacGuard(rbac, { role: 'admin' }));
\`\`\`

### ⚠️ Important: Global Position Trap

Do NOT register rbacGuard as a global middleware. It silently allows all requests when no specific role is required. Use it per-route or per-controller only.`,
  },
  {
    id: 'background-jobs',
    title: 'Background Jobs',
    content: `Database-backed job queue with retries, dead letter queue, and no Redis requirement.

### Setup

First, run the migration SQL:

\`\`\`typescript
import { 
  STREET_JOBS_MIGRATION_SQL,
  STREET_DLQ_MIGRATION_SQL,
  STREET_JOB_HISTORY_MIGRATION_SQL 
} from 'streetjs';

await pool.query(STREET_JOBS_MIGRATION_SQL);
await pool.query(STREET_DLQ_MIGRATION_SQL);
await pool.query(STREET_JOB_HISTORY_MIGRATION_SQL);
\`\`\`

### Job Queue

\`\`\`typescript
import { JobQueue } from 'streetjs';

const queue = new JobQueue(pool, {
  concurrency: 5,
  pollIntervalMs: 1000,
  workerId: 'worker-1'
});

// Enqueue a job
await queue.enqueue({
  type: 'send_email',
  payload: {
    to: 'user@example.com',
    subject: 'Welcome',
    body: 'Thanks for signing up!'
  },
  runAt: new Date(Date.now() + 60000) // Run in 1 minute
});

// Register handler
queue.register('send_email', async (payload, ctx) => {
  await sendEmail(payload);
});

// Set retry policy
queue.setRetryPolicy('send_email', {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 60000
});

// Start processing
await queue.start();
\`\`\`

### Cron Scheduler

\`\`\`typescript
import { CronScheduler } from 'streetjs';

const scheduler = new CronScheduler();

// Schedule recurring job
scheduler.register(
  '0 9 * * *', // Every day at 9 AM
  'daily-report',
  async () => {
    const report = await generateDailyReport();
    await sendReport(report);
  }
);

await scheduler.start();
\`\`\`

### Workflow Engine

\`\`\`typescript
import { WorkflowEngine } from 'streetjs';

const engine = new WorkflowEngine(pool);

engine.define('user-onboarding', [
  {
    name: 'send-welcome-email',
    run: async (input) => {
      await sendWelcomeEmail(input.userId);
      return { emailSent: true };
    },
    compensate: async () => {
      // Rollback logic
    }
  },
  {
    name: 'create-trial',
    run: async (input) => {
      const trial = await createTrial(input.userId);
      return { trialId: trial.id };
    },
    compensate: async (output) => {
      await deleteTrial(output.trialId);
    }
  }
]);

// Start workflow
const workflowId = await engine.start('user-onboarding', { userId });
\`\`\``,
  },
];

export function getDocSection(id: string): DocSection | undefined {
  return docSections.find(s => s.id === id);
}

export function getAllDocSections(): DocSection[] {
  return docSections;
}
