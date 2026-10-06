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

export function guidesPage(page: PageDSL) {
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
