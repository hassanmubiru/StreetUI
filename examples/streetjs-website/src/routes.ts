import { type PageDSL } from 'streetui';
import {
  heroSection, heroBadge, heroTitle, heroSubtitle, heroActions,
  btnPrimary, btnSecondary, codeBlock, featuresGrid, featureCard,
  featureIcon, featureTitle, featureDesc, sectionHeading, sectionSubheading,
  pageTitle, bodyText, inlineCode, card, mainContent,
} from './design-system.js';
import { docSections, getDocSection } from './docs-content.js';

const INSTALL_CODE = `npm install @streetjs/core

# Create a new app
npx streetjs create my-app
cd my-app && npm install && npm run dev`;

const CONTROLLER_CODE = `import { Controller, Get, Post, StreetContext } from '@streetjs/core';

@Controller('/users')
export class UserController {
  @Get('/')
  async listUsers(ctx: StreetContext) {
    const users = await ctx.db.query('SELECT * FROM users');
    ctx.json(users.rows);
  }

  @Post('/')
  async createUser(ctx: StreetContext) {
    const { name, email } = ctx.request.body;
    await ctx.db.query(
      'INSERT INTO users (name, email) VALUES ($1, $2)',
      [name, email]
    );
    ctx.status(201).json({ message: 'User created' });
  }
}`;

const BOOTSTRAP_CODE = `import { streetApp } from '@streetjs/core';
import { UserController } from './controllers/user.js';

const app = streetApp({
  controllers: [UserController],
  database: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    // ⚠️ CRITICAL: All columns return as strings
    // Boolean: 't' or 'f', not true/false
    // Integer: '42', not 42
  },
});

app.listen(3000);`;

const AUTH_CODE = `import { Controller, Get, Post, Roles } from '@streetjs/core';
import { JwtService } from '@streetjs/core';

@Controller('/auth')
export class AuthController {
  constructor(private jwt: JwtService) {}

  @Post('/login')
  async login(ctx: StreetContext) {
    const { email, password } = ctx.request.body;
    // ⚠️ No password hashing ships with StreetJS
    const user = await this.validateUser(email, password);
    const token = this.jwt.sign({ userId: user.id });
    ctx.json({ token });
  }

  @Get('/profile')
  @Roles('user')
  async profile(ctx: StreetContext) {
    // Requires authentication middleware
    ctx.json({ user: ctx.state.user });
  }
}`;

export function homePage(page: PageDSL) {
  page.head({
    title: 'StreetJS — TypeScript-first Backend Framework',
    description: 'Build scalable Node.js backends with decorators, native PostgreSQL, background jobs, and JWT auth.'
  });
  page.container('home', (home) => {
    // Hero
    home.container('hero', (h) => {
      h.text('StreetJS v1.2.8', { id: 'hero-badge', class: heroBadge });
      h.heading('The TypeScript-first backend framework', { level: 1, id: 'hero-title', class: heroTitle });
      h.text('Build production-ready Node.js applications with decorators, native PostgreSQL wire protocol, background jobs, and JWT authentication. No dependencies on heavy ORMs.', { id: 'hero-subtitle', class: heroSubtitle });
      h.container('hero-actions', (a) => {
        a.link('Get Started', { href: '/getting-started', id: 'cta-start', class: btnPrimary });
        a.link('View on GitHub', { href: 'https://github.com/streetjs/streetjs', id: 'cta-github', class: btnSecondary });
      }, { id: 'hero-actions', class: heroActions });
    }, { id: 'hero', class: heroSection });

    // Code example
    home.container('code-section', (cs) => {
      cs.heading('Start building in 30 seconds', { level: 2, id: 'code-title', class: sectionHeading });
      cs.code(CONTROLLER_CODE, { id: 'controller-code', class: codeBlock });
    }, { id: 'code-section', class: mainContent });

    // Features
    home.container('features', (f) => {
      f.heading('Everything you need', { level: 2, id: 'features-title', class: sectionHeading });
      f.text('One install. Production-ready. Enterprise-grade patterns.', { id: 'features-sub', class: sectionSubheading });
      f.container('features-grid', (grid) => {
        const features = [
          ['🎯', 'Decorator-based routing', '@Get, @Post, @Put, @Delete with path params, query strings, and body parsing.'],
          ['🐘', 'Native PostgreSQL', 'Wire-protocol client with connection pooling. No pg dependency. ⚠️ All columns return as strings.'],
          ['🔒', 'JWT + RBAC', 'Built-in JWT service and role-based access control with hierarchy. ⚠️ No password hashing included.'],
          ['⚙️', 'Background jobs', 'JobQueue, CronScheduler, and WorkflowEngine for async tasks and scheduled work.'],
          ['🗄️', 'Migrations', 'Schema versioning with rollback support. Migration runner tracks applied migrations.'],
          ['✅', 'Validation', 'Zod-based validation with @Validate decorator. Type-safe schemas integrated with TypeScript.'],
        ] as const;
        for (const [icon, title, desc] of features) {
          grid.container(`feat-${title.replace(/\s/g,'-').toLowerCase()}`, (fc) => {
            fc.text(icon, { id: `feat-icon-${title.slice(0,4)}`, class: featureIcon });
            fc.heading(title, { level: 3, id: `feat-title-${title.slice(0,4)}`, class: featureTitle });
            fc.text(desc, { id: `feat-desc-${title.slice(0,4)}`, class: featureDesc });
          }, { id: `feat-${title.slice(0,4)}`, class: featureCard });
        }
      }, { id: 'features-grid', class: featuresGrid });
    }, { id: 'features', class: mainContent });
  }, { id: 'home-page' });
}

export function gettingStartedPage(page: PageDSL) {
  page.head({ title: 'Getting Started — StreetJS', description: 'Install StreetJS and build your first backend in minutes.' });
  page.container('gs', (gs) => {
    gs.heading('Getting Started', { level: 1, id: 'gs-title', class: pageTitle });
    gs.text('Install StreetJS and build your first production-ready backend.', { id: 'gs-intro', class: bodyText });

    gs.heading('Requirements', { level: 2, id: 'gs-req-title', class: sectionHeading });
    gs.text('Node.js 22+ (uses native fetch, ES modules)', { id: 'gs-req', class: bodyText });
    gs.text('PostgreSQL 14+ (no TLS support)', { id: 'gs-pg', class: bodyText });

    gs.heading('Installation', { level: 2, id: 'gs-install-title', class: sectionHeading });
    gs.code('npm install @streetjs/core', { id: 'gs-install', class: codeBlock });

    gs.heading('Create your first controller', { level: 2, id: 'gs-controller-title', class: sectionHeading });
    gs.code(CONTROLLER_CODE, { id: 'gs-controller', class: codeBlock });

    gs.heading('Bootstrap your application', { level: 2, id: 'gs-bootstrap-title', class: sectionHeading });
    gs.code(BOOTSTRAP_CODE, { id: 'gs-bootstrap', class: codeBlock });

    gs.heading('⚠️ Critical: String column trap', { level: 2, id: 'gs-trap-title', class: sectionHeading });
    gs.text('The PostgreSQL driver requests text format for all columns. Every value returns as string | null:', { id: 'gs-trap-intro', class: bodyText });
    gs.code(`// WRONG\nif (row.active) { } // 'f' is truthy!\nif (row.count > 10) { } // '9' > '10' is true\n\n// RIGHT\nif (row.active === 't') { }\nif (Number(row.count) > 10) { }`, { id: 'gs-trap', class: codeBlock });
  }, { id: 'getting-started', class: mainContent });
}

export function docsPage(page: PageDSL, ctx?: { params?: { section?: string } }) {
  const section = ctx?.params?.section;

  if (section) {
    const doc = getDocSection(section);
    if (doc) {
      page.head({ title: `${doc.title} — StreetJS Documentation`, description: doc.content.slice(0, 150) });
      page.container('doc-detail', (d) => {
        d.heading(doc.title, { level: 1, id: 'doc-title', class: pageTitle });
        d.text(doc.content, { id: 'doc-content', class: bodyText });
        if (doc.code) {
          d.code(doc.code, { id: 'doc-code', class: codeBlock });
        }
      }, { id: 'doc-page', class: mainContent });
      return;
    }
  }

  page.head({ title: 'Documentation — StreetJS', description: 'Complete StreetJS documentation — controllers, database, auth, jobs, and more.' });
  page.container('docs', (d) => {
    d.heading('Documentation', { level: 1, id: 'docs-title', class: pageTitle });
    d.text('Everything you need to build production backends with StreetJS v1.2.8.', { id: 'docs-intro', class: bodyText });

    d.container('docs-grid', (grid) => {
      for (const doc of docSections) {
        grid.container(`doc-${doc.id}`, (dc) => {
          dc.heading(doc.title, { level: 3, id: `doc-title-${doc.id}`, class: featureTitle });
          dc.text(doc.content.slice(0, 120) + '...', { id: `doc-desc-${doc.id}`, class: featureDesc });
          dc.link('Read →', { href: `/docs/${doc.id}`, id: `doc-link-${doc.id}`, class: inlineCode });
        }, { id: `doc-card-${doc.id}`, class: featureCard });
      }
    }, { id: 'docs-grid', class: featuresGrid });
  }, { id: 'docs-page', class: mainContent });
}

export function apiPage(page: PageDSL) {
  page.head({ title: 'API Reference — StreetJS', description: 'Complete StreetJS API reference for all decorators, services, and utilities.' });
  page.container('api', (a) => {
    a.heading('API Reference', { level: 1, id: 'api-title', class: pageTitle });
    a.text('All public exports from @streetjs/core v1.2.8.', { id: 'api-intro', class: bodyText });

    const modules = [
      ['Decorators', ['@Controller(path)', '@Get(path)', '@Post(path)', '@Put(path)', '@Delete(path)', '@Patch(path)', '@Validate(schema)', '@Roles(...roles)', '@UseMiddleware(mw)', '@Injectable()', '@Inject(token)']],
      ['Context', ['ctx.request.body', 'ctx.request.query', 'ctx.request.params', 'ctx.request.headers', 'ctx.json(data)', 'ctx.status(code)', 'ctx.redirect(url)', 'ctx.state', 'ctx.db']],
      ['Database', ['PgPool', 'query(sql, params)', 'transaction(callback)', '⚠️ All columns return as strings']],
      ['Authentication', ['JwtService', 'sign(payload, secret)', 'verify(token, secret)', 'RbacService', 'hasRole(user, role)', 'rbacGuard(roles)']],
      ['Background Jobs', ['JobQueue', 'CronScheduler', 'WorkflowEngine', 'enqueue(job)', 'schedule(cron, handler)']],
      ['Migrations', ['StreetMigrationRunner', 'up()', 'down()', 'pending()', 'applied()']],
    ] as const;

    for (const [modName, exports] of modules) {
      a.container(`api-${modName.toLowerCase()}`, (m) => {
        m.heading(modName, { level: 2, id: `api-mod-${modName.toLowerCase()}`, class: sectionHeading });
        for (const exp of exports) {
          m.code(exp, { id: `api-${exp.slice(0,10).replace(/[^a-z]/gi,'-')}`, class: inlineCode });
        }
      }, { id: `api-section-${modName.toLowerCase()}`, class: card });
    }
  }, { id: 'api-page', class: mainContent });
}

export function examplesPage(page: PageDSL) {
  page.head({ title: 'Examples — StreetJS', description: 'Real-world StreetJS examples and code samples.' });
  page.container('examples', (ex) => {
    ex.heading('Examples', { level: 1, id: 'examples-title', class: pageTitle });
    ex.text('Real patterns from production StreetJS applications.', { id: 'examples-intro', class: bodyText });

    ex.heading('Controller with validation', { level: 2, id: 'ex-controller-title', class: sectionHeading });
    ex.code(CONTROLLER_CODE, { id: 'ex-controller', class: codeBlock });

    ex.heading('Authentication', { level: 2, id: 'ex-auth-title', class: sectionHeading });
    ex.code(AUTH_CODE, { id: 'ex-auth', class: codeBlock });

    ex.heading('Bootstrap with database', { level: 2, id: 'ex-bootstrap-title', class: sectionHeading });
    ex.code(BOOTSTRAP_CODE, { id: 'ex-bootstrap', class: codeBlock });

    ex.heading('⚠️ Decoding string columns correctly', { level: 2, id: 'ex-decode-title', class: sectionHeading });
    ex.code(`// All PgPool columns return strings\nconst result = await ctx.db.query('SELECT id, active, count FROM users');\n\nfor (const row of result.rows) {\n  const id = Number(row.id);        // '42' → 42\n  const active = row.active === 't'; // 't' → true, 'f' → false\n  const count = Number(row.count);   // '10' → 10\n}`, { id: 'ex-decode', class: codeBlock });
  }, { id: 'examples-page', class: mainContent });
}

export function guidesPage(page: PageDSL, ctx?: { params?: { slug?: string } }) {
  const slug = ctx?.params?.slug;

  // Individual guide pages
  if (slug === 'rest-api') {
    page.head({ title: 'Building a REST API — StreetJS Guides', description: 'Learn how to build RESTful APIs with StreetJS controllers, validation, and error handling.' });
    page.container('guide-detail', (g) => {
      g.heading('Building a REST API', { level: 1, id: 'guide-title', class: pageTitle });
      g.text('Learn how to build production-ready RESTful APIs with StreetJS.', { id: 'guide-intro', class: bodyText });

      g.heading('Controllers', { level: 2, id: 'guide-controllers', class: sectionHeading });
      g.text('Use the @Controller decorator to define route prefixes:', { id: 'guide-cont-desc', class: bodyText });
      g.code(`@Controller('/api/users')\nexport class UserController {\n  @Get('/')\n  async list(ctx: StreetContext) {\n    const users = await ctx.db.query('SELECT * FROM users');\n    ctx.json(users.rows);\n  }\n}`, { id: 'guide-cont-code', class: codeBlock });

      g.heading('Validation', { level: 2, id: 'guide-validation', class: sectionHeading });
      g.text('Use @Validate with Zod schemas:', { id: 'guide-val-desc', class: bodyText });
      g.code(`import { z } from 'zod';\n\nconst createUserSchema = z.object({\n  name: z.string().min(1),\n  email: z.string().email(),\n});\n\n@Post('/')\n@Validate(createUserSchema)\nasync create(ctx: StreetContext) {\n  const { name, email } = ctx.request.body;\n  // Validated data\n}`, { id: 'guide-val-code', class: codeBlock });

      g.heading('Error Handling', { level: 2, id: 'guide-errors', class: sectionHeading });
      g.text('Return appropriate HTTP status codes:', { id: 'guide-err-desc', class: bodyText });
      g.code(`try {\n  const user = await findUser(id);\n  if (!user) return ctx.status(404).json({ error: 'Not found' });\n  ctx.json(user);\n} catch (err) {\n  ctx.status(500).json({ error: 'Internal error' });\n}`, { id: 'guide-err-code', class: codeBlock });
    }, { id: 'guide-page', class: mainContent });
    return;
  }

  if (slug === 'database') {
    page.head({ title: 'Database Patterns — StreetJS Guides', description: 'Master StreetJS database patterns including the critical string column trap.' });
    page.container('guide-detail', (g) => {
      g.heading('Database Patterns', { level: 1, id: 'guide-title', class: pageTitle });
      g.text('Master queries, transactions, and the critical string column trap.', { id: 'guide-intro', class: bodyText });

      g.heading('⚠️ Critical: String Column Trap', { level: 2, id: 'guide-trap', class: sectionHeading });
      g.text('ALL columns return as strings. You must convert them explicitly:', { id: 'guide-trap-desc', class: bodyText });
      g.code(`const result = await ctx.db.query('SELECT id, active, count FROM users WHERE id = $1', [userId]);\nconst row = result.rows[0];\n\n// WRONG\nif (row.active) { } // 'f' is truthy!\nif (row.count > 10) { } // '9' > '10' is true\n\n// RIGHT\nif (row.active === 't') { }\nif (Number(row.count) > 10) { }`, { id: 'guide-trap-code', class: codeBlock });

      g.heading('Transactions', { level: 2, id: 'guide-tx', class: sectionHeading });
      g.text('Use ctx.db.transaction for atomic operations:', { id: 'guide-tx-desc', class: bodyText });
      g.code(`await ctx.db.transaction(async (tx) => {\n  await tx.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);\n  await tx.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);\n  // Auto-commit on success, rollback on error\n});`, { id: 'guide-tx-code', class: codeBlock });
    }, { id: 'guide-page', class: mainContent });
    return;
  }

  if (slug === 'auth') {
    page.head({ title: 'Authentication — StreetJS Guides', description: 'Implement JWT authentication and RBAC in StreetJS.' });
    page.container('guide-detail', (g) => {
      g.heading('Authentication', { level: 1, id: 'guide-title', class: pageTitle });
      g.text('Implement JWT tokens and role-based access control.', { id: 'guide-intro', class: bodyText });

      g.heading('JWT Tokens', { level: 2, id: 'guide-jwt', class: sectionHeading });
      g.text('Use JwtService to sign and verify tokens:', { id: 'guide-jwt-desc', class: bodyText });
      g.code(`import { JwtService } from '@streetjs/core';\n\nconst jwt = new JwtService();\nconst token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);\nctx.json({ token });`, { id: 'guide-jwt-code', class: codeBlock });

      g.heading('Protected Routes', { level: 2, id: 'guide-protected', class: sectionHeading });
      g.text('Use @Roles decorator to protect routes:', { id: 'guide-prot-desc', class: bodyText });
      g.code(`@Get('/admin')\n@Roles('admin')\nasync adminOnly(ctx: StreetContext) {\n  // Only users with 'admin' role can access\n  ctx.json({ data: 'secret' });\n}`, { id: 'guide-prot-code', class: codeBlock });

      g.heading('⚠️ Password Hashing', { level: 2, id: 'guide-pass', class: sectionHeading });
      g.text('StreetJS does NOT include password hashing. Use bcrypt or argon2:', { id: 'guide-pass-desc', class: bodyText });
      g.code(`import bcrypt from 'bcrypt';\n\nconst hash = await bcrypt.hash(password, 10);\nconst valid = await bcrypt.compare(password, hash);`, { id: 'guide-pass-code', class: codeBlock });
    }, { id: 'guide-page', class: mainContent });
    return;
  }

  if (slug === 'jobs') {
    page.head({ title: 'Background Jobs — StreetJS Guides', description: 'Use JobQueue, CronScheduler, and WorkflowEngine for async tasks.' });
    page.container('guide-detail', (g) => {
      g.heading('Background Jobs', { level: 1, id: 'guide-title', class: pageTitle });
      g.text('Handle async tasks with JobQueue, CronScheduler, and WorkflowEngine.', { id: 'guide-intro', class: bodyText });

      g.heading('JobQueue', { level: 2, id: 'guide-queue', class: sectionHeading });
      g.text('Enqueue tasks for async processing:', { id: 'guide-queue-desc', class: bodyText });
      g.code(`import { JobQueue } from '@streetjs/core';\n\nconst queue = new JobQueue();\nawait queue.enqueue('send-email', { to: user.email, subject: 'Welcome' });`, { id: 'guide-queue-code', class: codeBlock });

      g.heading('CronScheduler', { level: 2, id: 'guide-cron', class: sectionHeading });
      g.text('Schedule recurring tasks with cron expressions:', { id: 'guide-cron-desc', class: bodyText });
      g.code(`import { CronScheduler } from '@streetjs/core';\n\nconst scheduler = new CronScheduler();\nscheduler.schedule('0 0 * * *', async () => {\n  // Runs daily at midnight\n  await cleanupOldData();\n});`, { id: 'guide-cron-code', class: codeBlock });
    }, { id: 'guide-page', class: mainContent });
    return;
  }

  if (slug === 'testing') {
    page.head({ title: 'Testing — StreetJS Guides', description: 'Write unit and integration tests for StreetJS applications.' });
    page.container('guide-detail', (g) => {
      g.heading('Testing', { level: 1, id: 'guide-title', class: pageTitle });
      g.text('Write reliable tests for your StreetJS application.', { id: 'guide-intro', class: bodyText });
      g.text('🚧 Comprehensive testing guide coming soon.', { id: 'guide-wip', class: bodyText });
    }, { id: 'guide-page', class: mainContent });
    return;
  }

  if (slug === 'deployment') {
    page.head({ title: 'Deployment — StreetJS Guides', description: 'Deploy StreetJS applications to production.' });
    page.container('guide-detail', (g) => {
      g.heading('Deployment', { level: 1, id: 'guide-title', class: pageTitle });
      g.text('Deploy your StreetJS application to production.', { id: 'guide-intro', class: bodyText });

      g.heading('Environment Variables', { level: 2, id: 'guide-env', class: sectionHeading });
      g.text('Configure your app with environment variables:', { id: 'guide-env-desc', class: bodyText });
      g.code(`// .env\nPORT=3000\nDATABASE_URL=postgresql://localhost/myapp\nJWT_SECRET=your-secret-key\nREDIS_URL=redis://localhost:6379`, { id: 'guide-env-code', class: codeBlock });

      g.heading('⚠️ No TLS Support', { level: 2, id: 'guide-tls', class: sectionHeading });
      g.text('StreetJS does not support TLS for PostgreSQL or Redis. Use connection poolers (PgBouncer) or SSH tunnels in production.', { id: 'guide-tls-desc', class: bodyText });
    }, { id: 'guide-page', class: mainContent });
    return;
  }

  // Guides index
  page.head({ title: 'Guides — StreetJS', description: 'Step-by-step guides for common StreetJS patterns.' });
  page.container('guides', (g) => {
    g.heading('Guides', { level: 1, id: 'guides-title', class: pageTitle });
    g.text('Step-by-step guides for building with StreetJS.', { id: 'guides-intro', class: bodyText });

    const guides = [
      ['Building a REST API', 'Controllers, validation, error handling, and response formatting.', '/guides/rest-api'],
      ['Database patterns', 'Queries, transactions, migrations, and the string column trap.', '/guides/database'],
      ['Authentication', 'JWT tokens, password handling, and protecting routes.', '/guides/auth'],
      ['Background jobs', 'Queue workers, cron schedules, and workflows.', '/guides/jobs'],
      ['Testing', 'Unit tests, integration tests, and test database setup.', '/guides/testing'],
      ['Deployment', 'Production setup, environment variables, and process management.', '/guides/deployment'],
    ] as const;

    g.container('guides-grid', (grid) => {
      for (const [title, desc, href] of guides) {
        grid.container(`guide-${title.replace(/\s/g,'-').toLowerCase()}`, (gc) => {
          gc.heading(title, { level: 3, id: `guide-title-${title.slice(0,5)}`, class: featureTitle });
          gc.text(desc, { id: `guide-desc-${title.slice(0,5)}`, class: featureDesc });
          gc.link('Read guide →', { href, id: `guide-link-${title.slice(0,5)}`, class: inlineCode });
        }, { id: `guide-${title.slice(0,5)}`, class: featureCard });
      }
    }, { id: 'guides-grid', class: featuresGrid });
  }, { id: 'guides-page', class: mainContent });
}

export function notFoundPage(page: PageDSL) {
  page.head({ title: '404 — StreetJS' });
  page.container('nf', (nf) => {
    nf.heading('404 — Not Found', { level: 1, id: 'nf-title', class: pageTitle });
    nf.text('The page you are looking for does not exist.', { id: 'nf-body', class: bodyText });
    nf.link('← Back to home', { href: '/', id: 'nf-back', class: btnPrimary });
  }, { id: 'not-found', class: mainContent });
}

export function placeholderPage(title: string) {
  return (page: PageDSL) => {
    page.head({ title: `${title} — StreetJS` });
    page.container('placeholder', (pl) => {
      pl.heading(title, { level: 1, id: 'ph-title', class: pageTitle });
      pl.text('This page is coming soon.', { id: 'ph-body', class: bodyText });
    }, { id: 'placeholder-page', class: mainContent });
  };
}

export function playgroundPage(page: PageDSL) {
  page.head({ title: 'Playground — StreetJS', description: 'Try StreetJS code snippets in an interactive playground.' });
  page.container('playground', (pg) => {
    pg.heading('Interactive Playground', { level: 1, id: 'pg-title', class: pageTitle });
    pg.text('Try StreetJS code snippets and see results in real-time.', { id: 'pg-intro', class: bodyText });
    pg.text('🚧 Coming soon: Interactive code editor with live execution.', { id: 'pg-wip', class: bodyText });
  }, { id: 'playground-page', class: mainContent });
}

export function pluginsPage(page: PageDSL) {
  page.head({ title: 'Plugins — StreetJS', description: 'Extend StreetJS with community and official plugins.' });
  page.container('plugins', (pl) => {
    pl.heading('Plugins', { level: 1, id: 'pl-title', class: pageTitle });
    pl.text('Extend StreetJS with plugins for authentication, caching, logging, and more.', { id: 'pl-intro', class: bodyText });
    
    pl.heading('What is a StreetJS Plugin?', { level: 2, id: 'pl-what-title', class: sectionHeading });
    pl.text('Plugins are modular extensions that add functionality to StreetJS applications. They can provide middleware, decorators, services, or custom behavior.', { id: 'pl-what', class: bodyText });
    
    pl.heading('Creating a Plugin', { level: 2, id: 'pl-create-title', class: sectionHeading });
    pl.code(`// plugin.ts\nexport interface StreetJSPlugin {\n  name: string;\n  version: string;\n  install(app: StreetHttpApp): void;\n}\n\nexport const myPlugin: StreetJSPlugin = {\n  name: 'my-plugin',\n  version: '1.0.0',\n  install(app) {\n    // Add middleware, services, etc.\n  },\n};`, { id: 'pl-create-code', class: codeBlock });
  }, { id: 'plugins-page', class: mainContent });
}

export function changelogPage(page: PageDSL) {
  page.head({ title: 'Changelog — StreetJS', description: 'Release history and changelog for StreetJS.' });
  page.container('changelog', (cl) => {
    cl.heading('Changelog', { level: 1, id: 'cl-title', class: pageTitle });
    cl.text('Release history and notable changes for StreetJS.', { id: 'cl-intro', class: bodyText });
    
    cl.heading('v1.2.8 (Current)', { level: 2, id: 'cl-128-title', class: sectionHeading });
    cl.text('Latest stable release with full decorator support, native PostgreSQL driver, JWT authentication, RBAC, and background jobs.', { id: 'cl-128', class: bodyText });
    
    cl.heading('Key Features', { level: 3, id: 'cl-features-title', class: sectionHeading });
    const features = [
      'Native PostgreSQL wire protocol (no pg dependency)',
      'JWT authentication with JwtService',
      'Role-based access control (RBAC) with hierarchy',
      'Background jobs (JobQueue, CronScheduler, WorkflowEngine)',
      'Database migrations with StreetMigrationRunner',
      'Zod-based validation with @Validate decorator',
      'Full TypeScript support with decorators',
    ];
    for (const feature of features) {
      cl.text(`• ${feature}`, { id: `cl-feat-${features.indexOf(feature)}`, class: bodyText });
    }
    
    cl.heading('Known Issues', { level: 3, id: 'cl-issues-title', class: sectionHeading });
    cl.text('⚠️ All PostgreSQL columns return as strings (no type conversion)', { id: 'cl-issue-1', class: bodyText });
    cl.text('⚠️ No TLS support for PostgreSQL or Redis connections', { id: 'cl-issue-2', class: bodyText });
    cl.text('⚠️ No password hashing utilities included (use bcrypt/argon2)', { id: 'cl-issue-3', class: bodyText });
  }, { id: 'changelog-page', class: mainContent });
}

export function blogPage(page: PageDSL) {
  page.head({ title: 'Blog — StreetJS', description: 'Tutorials, announcements, and best practices for StreetJS.' });
  page.container('blog', (bl) => {
    bl.heading('Blog', { level: 1, id: 'bl-title', class: pageTitle });
    bl.text('Tutorials, announcements, and best practices for building with StreetJS.', { id: 'bl-intro', class: bodyText });
    bl.text('📝 Blog posts coming soon. Follow us on GitHub for updates.', { id: 'bl-wip', class: bodyText });
  }, { id: 'blog-page', class: mainContent });
}

export function aboutPage(page: PageDSL) {
  page.head({ title: 'About — StreetJS', description: 'Learn about the StreetJS framework, its philosophy, and the team behind it.' });
  page.container('about', (ab) => {
    ab.heading('About StreetJS', { level: 1, id: 'ab-title', class: pageTitle });
    
    ab.heading('What is StreetJS?', { level: 2, id: 'ab-what-title', class: sectionHeading });
    ab.text('StreetJS is a TypeScript-first backend framework for Node.js 22+ that embraces decorators, native protocols, and zero-dependency philosophy.', { id: 'ab-what', class: bodyText });
    
    ab.heading('Philosophy', { level: 2, id: 'ab-phil-title', class: sectionHeading });
    ab.text('StreetJS is built on three core principles:', { id: 'ab-phil-intro', class: bodyText });
    ab.text('1. TypeScript-first: Decorators, types, and modern ECMAScript features are first-class citizens.', { id: 'ab-phil-1', class: bodyText });
    ab.text('2. Native protocols: Direct wire-protocol implementations for PostgreSQL and Redis eliminate heavy dependencies.', { id: 'ab-phil-2', class: bodyText });
    ab.text('3. Production-ready patterns: JWT, RBAC, background jobs, and migrations are built-in, not bolted-on.', { id: 'ab-phil-3', class: bodyText });
    
    ab.heading('Trade-offs', { level: 2, id: 'ab-trade-title', class: sectionHeading });
    ab.text('StreetJS makes deliberate trade-offs:', { id: 'ab-trade-intro', class: bodyText });
    ab.text('✅ No ORM bloat — direct SQL with native driver', { id: 'ab-trade-1', class: bodyText });
    ab.text('✅ No middleware framework — decorators define behavior', { id: 'ab-trade-2', class: bodyText });
    ab.text('⚠️ All database columns return as strings (explicit type conversion required)', { id: 'ab-trade-3', class: bodyText });
    ab.text('⚠️ No TLS for PostgreSQL/Redis (use connection poolers or tunnels)', { id: 'ab-trade-4', class: bodyText });
    
    ab.heading('License', { level: 2, id: 'ab-license-title', class: sectionHeading });
    ab.text('StreetJS is open source software. Check the GitHub repository for license details.', { id: 'ab-license', class: bodyText });
    ab.link('View on GitHub', { href: 'https://github.com/streetjs/streetjs', id: 'ab-github', class: btnPrimary });
  }, { id: 'about-page', class: mainContent });
}
