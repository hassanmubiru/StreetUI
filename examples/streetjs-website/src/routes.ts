import { div, h1, h2, h3, p, a, code, pre, ul, li, section, article } from 'streetui';
import { ds, commonStyles } from './design-system.js';

// Home page
export function HomePage() {
  return div(
    { class: 'home-page' },
    
    // Hero section
    section(
      {
        style: {
          paddingBlock: ds.spacing[20],
          background: `linear-gradient(135deg, ${ds.colors.primary} 0%, ${ds.colors.primaryLight} 100%)`,
          color: '#ffffff',
        },
      },
      div(
        { class: commonStyles.container },
        h1(
          {
            style: {
              fontSize: ds.fontSizes['6xl'],
              fontWeight: ds.fontWeights.bold,
              marginBottom: ds.spacing[6],
              lineHeight: ds.lineHeights.tight,
            },
          },
          'StreetJS'
        ),
        p(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              marginBottom: ds.spacing[8],
              maxWidth: '48rem',
              lineHeight: ds.lineHeights.relaxed,
              opacity: '0.95',
            },
          },
          'Production-grade TypeScript backend framework with native PostgreSQL, JWT, WebSockets, and zero dependencies on Express or Prisma.'
        ),
        
        // Installation
        pre(
          {
            style: {
              ...commonStyles.codeBlock.style,
              marginBottom: ds.spacing[8],
              maxWidth: '32rem',
            },
          },
          code('npm install streetjs')
        ),
        
        // CTAs
        div(
          {
            style: {
              display: 'flex',
              gap: ds.spacing[4],
              flexWrap: 'wrap',
            },
          },
          a(
            {
              href: '/getting-started',
              class: commonStyles.button + ' ' + commonStyles.buttonAccent,
            },
            'Get Started'
          ),
          a(
            {
              href: 'https://github.com/hassanmubiru/StreetJS',
              class: commonStyles.button + ' ' + commonStyles.buttonOutline,
              style: {
                borderColor: '#ffffff',
                color: '#ffffff',
                '&:hover': {
                  backgroundColor: '#ffffff',
                  color: ds.colors.primary,
                },
              },
              target: '_blank',
              rel: 'noopener noreferrer',
            },
            'View on GitHub'
          )
        )
      )
    ),
    
    // Features section
    section(
      {
        style: {
          paddingBlock: ds.spacing[20],
        },
      },
      div(
        { class: commonStyles.container },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['4xl'],
              fontWeight: ds.fontWeights.bold,
              marginBottom: ds.spacing[12],
              textAlign: 'center',
            },
          },
          'Core Features'
        ),
        
        div(
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: ds.spacing[8],
            },
          },
          
          // Feature cards
          FeatureCard(
            'Native PostgreSQL',
            'Custom wire protocol driver with no dependency on pg. Parameterized queries, connection pooling, and transactions built-in.',
            '🗄️'
          ),
          FeatureCard(
            'Type-Safe Decorators',
            '@Controller, @Get, @Post, @Validate with full TypeScript support and reflection-based dependency injection.',
            '🎯'
          ),
          FeatureCard(
            'Built-in Security',
            'JWT, RBAC, sessions, CSRF protection, rate limiting, and field-level encryption out of the box.',
            '🔒'
          ),
          FeatureCard(
            'Background Jobs',
            'Database-backed job queue with retries, dead letter queue, and cron scheduling. No Redis required.',
            '⚙️'
          ),
          FeatureCard(
            'WebSockets & SSE',
            'First-class WebSocket and Server-Sent Events support with automatic connection management.',
            '🔌'
          ),
          FeatureCard(
            'Zero Express',
            'Custom HTTP server built on Node.js http module. No Express middleware complexity.',
            '⚡'
          )
        )
      )
    ),
    
    // Code example section
    section(
      {
        style: {
          paddingBlock: ds.spacing[20],
          backgroundColor: ds.colors.bgAlt,
        },
      },
      div(
        { class: commonStyles.container },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['4xl'],
              fontWeight: ds.fontWeights.bold,
              marginBottom: ds.spacing[12],
              textAlign: 'center',
            },
          },
          'Quick Example'
        ),
        
        pre(
          {
            class: commonStyles.codeBlock,
            style: {
              maxWidth: '56rem',
              marginInline: 'auto',
            },
          },
          code(`import { Controller, Get, Post, Validate } from 'streetjs';
import { z } from 'zod';

@Controller('/api/users')
export class UserController {
  constructor(private pool: PgPool) {}
  
  @Get('/')
  async list(ctx: StreetContext) {
    const users = await this.pool.query(
      'SELECT id, email FROM users LIMIT $1',
      [100]
    );
    ctx.json(users.rows);
  }
  
  @Post('/')
  @Validate({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(8),
    })
  })
  async create(ctx: StreetContext) {
    const { email, password } = ctx.body;
    // ... hash password, insert user
    ctx.json({ id: newId, email }, 201);
  }
}`)
        )
      )
    )
  );
}

function FeatureCard(title: string, description: string, emoji: string) {
  return article(
    {
      class: commonStyles.card,
      style: {
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: ds.shadows.lg,
        },
      },
    },
    div(
      {
        style: {
          fontSize: ds.fontSizes['4xl'],
          marginBottom: ds.spacing[4],
        },
      },
      emoji
    ),
    h3(
      {
        style: {
          fontSize: ds.fontSizes.xl,
          fontWeight: ds.fontWeights.semibold,
          marginBottom: ds.spacing[3],
        },
      },
      title
    ),
    p(
      {
        style: {
          color: ds.colors.textMuted,
          lineHeight: ds.lineHeights.relaxed,
        },
      },
      description
    )
  );
}

// Getting Started page
export function GettingStartedPage() {
  return div(
    { class: 'getting-started-page' },
    div(
      {
        class: commonStyles.container,
        style: {
          paddingBlock: ds.spacing[12],
          maxWidth: '48rem',
        },
      },
      h1(
        {
          style: {
            fontSize: ds.fontSizes['5xl'],
            fontWeight: ds.fontWeights.bold,
            marginBottom: ds.spacing[8],
          },
        },
        'Getting Started'
      ),
      
      section(
        {
          style: {
            marginBottom: ds.spacing[12],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['3xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'Installation'
        ),
        p(
          {
            style: {
              marginBottom: ds.spacing[4],
              lineHeight: ds.lineHeights.relaxed,
            },
          },
          'StreetJS requires Node.js 22+ and npm 10+. Install the framework and CLI:'
        ),
        pre(
          {
            class: commonStyles.codeBlock,
            style: {
              marginBottom: ds.spacing[4],
            },
          },
          code('npm install streetjs\nnpm install -D @streetjs/cli typescript')
        )
      ),
      
      section(
        {
          style: {
            marginBottom: ds.spacing[12],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['3xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'Create Your First Controller'
        ),
        pre(
          {
            class: commonStyles.codeBlock,
          },
          code(`import { Controller, Get } from 'streetjs';

@Controller('/api')
export class AppController {
  @Get('/health')
  health(ctx: StreetContext) {
    ctx.json({ status: 'ok' });
  }
}`)
        )
      ),
      
      section(
        {
          style: {
            marginBottom: ds.spacing[12],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['3xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'Bootstrap Your Application'
        ),
        pre(
          {
            class: commonStyles.codeBlock,
          },
          code(`import 'reflect-metadata';
import { streetApp } from 'streetjs/http';
import { AppController } from './controllers/app.controller.js';

const app = streetApp({ port: 3000 });
app.registerController(AppController);

await app.listen();
console.log('Server running on http://localhost:3000');`)
        )
      ),
      
      div(
        {
          style: {
            marginTop: ds.spacing[12],
            paddingTop: ds.spacing[8],
            borderTop: `1px solid ${ds.colors.border}`,
          },
        },
        p(
          {
            style: {
              marginBottom: ds.spacing[4],
            },
          },
          'Next steps:'
        ),
        ul(
          {
            style: {
              paddingLeft: ds.spacing[6],
              lineHeight: ds.lineHeights.relaxed,
            },
          },
          li(a({ href: '/docs/database' }, 'Set up PostgreSQL connection')),
          li(a({ href: '/docs/validation' }, 'Add request validation')),
          li(a({ href: '/docs/security' }, 'Configure authentication')),
          li(a({ href: '/docs/migrations' }, 'Run database migrations'))
        )
      )
    )
  );
}

// Docs page
export function DocsPage() {
  return div(
    { class: 'docs-page' },
    div(
      {
        class: commonStyles.container,
        style: {
          paddingBlock: ds.spacing[12],
        },
      },
      h1(
        {
          style: {
            fontSize: ds.fontSizes['5xl'],
            fontWeight: ds.fontWeights.bold,
            marginBottom: ds.spacing[8],
          },
        },
        'Documentation'
      ),
      p('Full documentation coming soon. See the getting started guide for now.')
    )
  );
}

// 404 page
export function NotFoundPage() {
  return div(
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
      },
    },
    h1(
      {
        style: {
          fontSize: ds.fontSizes['6xl'],
          fontWeight: ds.fontWeights.bold,
          marginBottom: ds.spacing[4],
        },
      },
      '404'
    ),
    p(
      {
        style: {
          fontSize: ds.fontSizes.xl,
          color: ds.colors.textMuted,
          marginBottom: ds.spacing[8],
        },
      },
      'Page not found'
    ),
    a(
      {
        href: '/',
        class: commonStyles.button + ' ' + commonStyles.buttonPrimary,
      },
      'Go Home'
    )
  );
}

// Examples page
export function ExamplesPage() {
  return div(
    { class: 'examples-page' },
    div(
      {
        class: commonStyles.container,
        style: {
          paddingBlock: ds.spacing[12],
        },
      },
      h1(
        {
          style: {
            fontSize: ds.fontSizes['5xl'],
            fontWeight: ds.fontWeights.bold,
            marginBottom: ds.spacing[8],
          },
        },
        'Examples'
      ),
      
      p(
        {
          style: {
            fontSize: ds.fontSizes.xl,
            marginBottom: ds.spacing[12],
            color: ds.colors.textMuted,
          },
        },
        'Real-world examples showing StreetJS capabilities'
      ),
      
      // REST API Example
      section(
        {
          class: commonStyles.card,
          style: {
            marginBottom: ds.spacing[8],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'REST API with Validation'
        ),
        p(
          {
            style: {
              marginBottom: ds.spacing[4],
              color: ds.colors.textMuted,
            },
          },
          'Complete CRUD API with Zod validation and PostgreSQL'
        ),
        pre(
          { class: commonStyles.codeBlock },
          code(`import { Controller, Get, Post, Put, Delete, Validate } from 'streetjs';
import { z } from 'zod';

const ProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  description: z.string().optional(),
});

@Controller('/api/products')
export class ProductController {
  constructor(private pool: PgPool) {}
  
  @Get('/')
  async list(ctx: StreetContext) {
    const result = await this.pool.query(
      'SELECT * FROM products ORDER BY created_at DESC'
    );
    ctx.json(result.rows);
  }
  
  @Get('/:id')
  async getOne(ctx: StreetContext) {
    const result = await this.pool.query(
      'SELECT * FROM products WHERE id = $1',
      [ctx.params.id]
    );
    if (result.rows.length === 0) {
      ctx.status(404).json({ error: 'Product not found' });
      return;
    }
    ctx.json(result.rows[0]);
  }
  
  @Post('/')
  @Validate({ body: ProductSchema })
  async create(ctx: StreetContext) {
    const { name, price, description } = ctx.body;
    const result = await this.pool.query(
      'INSERT INTO products (name, price, description) VALUES ($1, $2, $3) RETURNING *',
      [name, price, description]
    );
    ctx.status(201).json(result.rows[0]);
  }
}`)
        )
      ),
      
      // Authentication Example
      section(
        {
          class: commonStyles.card,
          style: {
            marginBottom: ds.spacing[8],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'JWT Authentication'
        ),
        p(
          {
            style: {
              marginBottom: ds.spacing[4],
              color: ds.colors.textMuted,
            },
          },
          'Login endpoint with JWT token generation'
        ),
        pre(
          { class: commonStyles.codeBlock },
          code(`import { Controller, Post, Validate } from 'streetjs';
import { JwtService } from 'streetjs/security';
import { z } from 'zod';

@Controller('/auth')
export class AuthController {
  constructor(
    private pool: PgPool,
    private jwt: JwtService
  ) {}
  
  @Post('/login')
  @Validate({
    body: z.object({
      email: z.string().email(),
      password: z.string(),
    })
  })
  async login(ctx: StreetContext) {
    const { email, password } = ctx.body;
    
    const result = await this.pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      ctx.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      ctx.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    const token = await this.jwt.sign({
      sub: user.id,
      email: user.email,
    });
    
    ctx.json({ token, user: { id: user.id, email: user.email } });
  }
}`)
        )
      ),
      
      // Background Jobs Example
      section(
        {
          class: commonStyles.card,
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'Background Jobs'
        ),
        p(
          {
            style: {
              marginBottom: ds.spacing[4],
              color: ds.colors.textMuted,
            },
          },
          'Queue jobs and schedule with cron expressions'
        ),
        pre(
          { class: commonStyles.codeBlock },
          code(`import { JobQueue, CronScheduler } from 'streetjs/jobs';

const queue = new JobQueue(pool, 'email_queue');
const scheduler = new CronScheduler(pool);

// Enqueue a one-time job
await queue.enqueue('send_email', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Thanks for signing up!',
});

// Schedule recurring job with cron
await scheduler.schedule('daily_report', '0 9 * * *', async () => {
  const report = await generateDailyReport();
  await sendEmail(report);
});

// Process jobs
queue.process('send_email', async (job) => {
  await sendEmail(job.data);
});`)
        )
      )
    )
  );
}

// API Reference page
export function ApiPage() {
  return div(
    { class: 'api-page' },
    div(
      {
        class: commonStyles.container,
        style: {
          paddingBlock: ds.spacing[12],
        },
      },
      h1(
        {
          style: {
            fontSize: ds.fontSizes['5xl'],
            fontWeight: ds.fontWeights.bold,
            marginBottom: ds.spacing[8],
          },
        },
        'API Reference'
      ),
      
      p(
        {
          style: {
            fontSize: ds.fontSizes.xl,
            marginBottom: ds.spacing[12],
            color: ds.colors.textMuted,
          },
        },
        'Complete API documentation for StreetJS v1.2.8'
      ),
      
      // Decorators
      section(
        {
          class: commonStyles.card,
          style: {
            marginBottom: ds.spacing[8],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[6],
            },
          },
          'Decorators'
        ),
        
        div(
          {
            style: {
              display: 'grid',
              gap: ds.spacing[6],
            },
          },
          
          ApiItem(
            '@Controller(path: string)',
            'Marks a class as a controller and sets the base path for all routes'
          ),
          ApiItem(
            '@Get(path?: string)',
            'Registers a GET route handler'
          ),
          ApiItem(
            '@Post(path?: string)',
            'Registers a POST route handler'
          ),
          ApiItem(
            '@Put(path?: string)',
            'Registers a PUT route handler'
          ),
          ApiItem(
            '@Delete(path?: string)',
            'Registers a DELETE route handler'
          ),
          ApiItem(
            '@Patch(path?: string)',
            'Registers a PATCH route handler'
          ),
          ApiItem(
            '@Validate(schema: ValidationSchema)',
            'Validates request body, query, or params with Zod schema'
          )
        )
      ),
      
      // Core Classes
      section(
        {
          class: commonStyles.card,
          style: {
            marginBottom: ds.spacing[8],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[6],
            },
          },
          'Core Classes'
        ),
        
        div(
          {
            style: {
              display: 'grid',
              gap: ds.spacing[6],
            },
          },
          
          ApiItem(
            'StreetContext',
            'Request context with req, res, params, query, body, state, user'
          ),
          ApiItem(
            'PgPool',
            'PostgreSQL connection pool with query(), transaction(), acquire(), release()'
          ),
          ApiItem(
            'JwtService',
            'JWT token signing and verification'
          ),
          ApiItem(
            'RbacService',
            'Role-based access control with hierarchy'
          ),
          ApiItem(
            'SessionManager',
            'Session management with AEAD encryption'
          ),
          ApiItem(
            'JobQueue',
            'Database-backed job queue with retries'
          ),
          ApiItem(
            'CronScheduler',
            'Cron-based task scheduling'
          )
        )
      ),
      
      // Middleware
      section(
        {
          class: commonStyles.card,
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[6],
            },
          },
          'Middleware'
        ),
        
        div(
          {
            style: {
              display: 'grid',
              gap: ds.spacing[6],
            },
          },
          
          ApiItem(
            'validate(schema)',
            'Request validation middleware'
          ),
          ApiItem(
            'jwtMiddleware(options)',
            'JWT authentication middleware'
          ),
          ApiItem(
            'rbacGuard(permission)',
            'RBAC authorization middleware'
          ),
          ApiItem(
            'rateLimiter(config)',
            'Rate limiting middleware'
          ),
          ApiItem(
            'csrfMiddleware()',
            'CSRF protection middleware'
          ),
          ApiItem(
            'securityHeadersMiddleware()',
            'Security headers (CSP, HSTS, etc.)'
          )
        )
      )
    )
  );
}

function ApiItem(signature: string, description: string) {
  return div(
    {
      style: {
        paddingBottom: ds.spacing[4],
        borderBottom: `1px solid ${ds.colors.border}`,
      },
    },
    code(
      {
        class: commonStyles.inlineCode,
        style: {
          display: 'block',
          marginBottom: ds.spacing[2],
        },
      },
      signature
    ),
    p(
      {
        style: {
          color: ds.colors.textMuted,
        },
      },
      description
    )
  );
}

// Guides page
export function GuidesPage() {
  return div(
    { class: 'guides-page' },
    div(
      {
        class: commonStyles.container,
        style: {
          paddingBlock: ds.spacing[12],
        },
      },
      h1(
        {
          style: {
            fontSize: ds.fontSizes['5xl'],
            fontWeight: ds.fontWeights.bold,
            marginBottom: ds.spacing[8],
          },
        },
        'Guides'
      ),
      
      p(
        {
          style: {
            fontSize: ds.fontSizes.xl,
            marginBottom: ds.spacing[12],
            color: ds.colors.textMuted,
          },
        },
        'Step-by-step guides for common tasks'
      ),
      
      div(
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: ds.spacing[6],
          },
        },
        
        GuideCard(
          'Database Setup',
          'Configure PostgreSQL connection and connection pooling',
          '/docs/database'
        ),
        GuideCard(
          'Authentication',
          'Implement JWT authentication and session management',
          '/docs/auth'
        ),
        GuideCard(
          'Authorization',
          'Set up RBAC with roles and permissions',
          '/docs/rbac'
        ),
        GuideCard(
          'Validation',
          'Validate requests with Zod schemas',
          '/docs/validation'
        ),
        GuideCard(
          'Database Migrations',
          'Create and run database migrations',
          '/docs/migrations'
        ),
        GuideCard(
          'Background Jobs',
          'Queue and schedule background tasks',
          '/docs/jobs'
        ),
        GuideCard(
          'WebSockets',
          'Real-time communication with WebSockets',
          '/docs/websockets'
        ),
        GuideCard(
          'Testing',
          'Write tests for your controllers and services',
          '/docs/testing'
        ),
        GuideCard(
          'Deployment',
          'Deploy your StreetJS application to production',
          '/docs/deployment'
        )
      )
    )
  );
}

function GuideCard(title: string, description: string, href: string) {
  return a(
    {
      href,
      class: commonStyles.card,
      style: {
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: ds.shadows.lg,
        },
      },
    },
    h3(
      {
        style: {
          fontSize: ds.fontSizes.xl,
          fontWeight: ds.fontWeights.semibold,
          marginBottom: ds.spacing[3],
        },
      },
      title
    ),
    p(
      {
        style: {
          color: ds.colors.textMuted,
          lineHeight: ds.lineHeights.relaxed,
        },
      },
      description
    )
  );
}

// Community page
export function CommunityPage() {
  return div(
    { class: 'community-page' },
    div(
      {
        class: commonStyles.container,
        style: {
          paddingBlock: ds.spacing[12],
        },
      },
      h1(
        {
          style: {
            fontSize: ds.fontSizes['5xl'],
            fontWeight: ds.fontWeights.bold,
            marginBottom: ds.spacing[8],
          },
        },
        'Community'
      ),
      
      p(
        {
          style: {
            fontSize: ds.fontSizes.xl,
            marginBottom: ds.spacing[12],
            color: ds.colors.textMuted,
          },
        },
        'Join the StreetJS community and get help'
      ),
      
      section(
        {
          class: commonStyles.card,
          style: {
            marginBottom: ds.spacing[8],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[6],
            },
          },
          'Get Help'
        ),
        
        div(
          {
            style: {
              display: 'grid',
              gap: ds.spacing[4],
            },
          },
          
          CommunityLink(
            'GitHub Issues',
            'Report bugs and request features',
            'https://github.com/hassanmubiru/StreetJS/issues'
          ),
          CommunityLink(
            'GitHub Discussions',
            'Ask questions and share knowledge',
            'https://github.com/hassanmubiru/StreetJS/discussions'
          ),
          CommunityLink(
            'Stack Overflow',
            'Tagged questions: [streetjs]',
            'https://stackoverflow.com/questions/tagged/streetjs'
          )
        )
      ),
      
      section(
        {
          class: commonStyles.card,
          style: {
            marginBottom: ds.spacing[8],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[6],
            },
          },
          'Contributing'
        ),
        
        p(
          {
            style: {
              marginBottom: ds.spacing[4],
              lineHeight: ds.lineHeights.relaxed,
            },
          },
          'StreetJS is open source and welcomes contributions. Whether you want to fix bugs, add features, or improve documentation, your help is appreciated.'
        ),
        
        a(
          {
            href: 'https://github.com/hassanmubiru/StreetJS/blob/main/CONTRIBUTING.md',
            class: commonStyles.button + ' ' + commonStyles.buttonPrimary,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          'Contributing Guide'
        )
      ),
      
      section(
        {
          class: commonStyles.card,
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[6],
            },
          },
          'Code of Conduct'
        ),
        
        p(
          {
            style: {
              lineHeight: ds.lineHeights.relaxed,
            },
          },
          'We are committed to providing a welcoming and inclusive environment. Please read our ',
          a(
            {
              href: 'https://github.com/hassanmubiru/StreetJS/blob/main/CODE_OF_CONDUCT.md',
              style: {
                color: ds.colors.accent,
                textDecoration: 'underline',
              },
            },
            'Code of Conduct'
          ),
          '.'
        )
      )
    )
  );
}

function CommunityLink(title: string, description: string, href: string) {
  return a(
    {
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      style: {
        display: 'block',
        padding: ds.spacing[4],
        borderRadius: ds.radii.md,
        border: `1px solid ${ds.colors.border}`,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        '&:hover': {
          borderColor: ds.colors.accent,
          backgroundColor: ds.colors.bgAlt,
        },
      },
    },
    div(
      {
        style: {
          fontWeight: ds.fontWeights.semibold,
          marginBottom: ds.spacing[1],
        },
      },
      title
    ),
    div(
      {
        style: {
          fontSize: ds.fontSizes.sm,
          color: ds.colors.textMuted,
        },
      },
      description
    )
  );
}

// About page
export function AboutPage() {
  return div(
    { class: 'about-page' },
    div(
      {
        class: commonStyles.container,
        style: {
          paddingBlock: ds.spacing[12],
          maxWidth: '48rem',
        },
      },
      h1(
        {
          style: {
            fontSize: ds.fontSizes['5xl'],
            fontWeight: ds.fontWeights.bold,
            marginBottom: ds.spacing[8],
          },
        },
        'About StreetJS'
      ),
      
      section(
        {
          style: {
            marginBottom: ds.spacing[12],
          },
        },
        p(
          {
            style: {
              fontSize: ds.fontSizes.lg,
              lineHeight: ds.lineHeights.relaxed,
              marginBottom: ds.spacing[6],
            },
          },
          'StreetJS is a production-grade TypeScript backend framework designed for developers who want the power of modern decorators and dependency injection without the complexity of Express middleware chains or ORM abstractions.'
        ),
        
        p(
          {
            style: {
              lineHeight: ds.lineHeights.relaxed,
              marginBottom: ds.spacing[6],
            },
          },
          'Built from the ground up with TypeScript, StreetJS provides native PostgreSQL wire protocol support, JWT authentication, RBAC, background jobs, WebSockets, and more—all without requiring Express, Prisma, or heavy dependencies.'
        )
      ),
      
      section(
        {
          style: {
            marginBottom: ds.spacing[12],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'Philosophy'
        ),
        
        ul(
          {
            style: {
              paddingLeft: ds.spacing[6],
              lineHeight: ds.lineHeights.relaxed,
              display: 'grid',
              gap: ds.spacing[3],
            },
          },
          li('Type safety from the database to the API'),
          li('Zero-dependency philosophy for core functionality'),
          li('Decorators for clean, declarative code'),
          li('Native database driver for better performance'),
          li('Security built-in, not bolted on'),
          li('Background jobs without external queue dependencies')
        )
      ),
      
      section(
        {
          style: {
            marginBottom: ds.spacing[12],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'Current Version'
        ),
        
        p(
          {
            style: {
              lineHeight: ds.lineHeights.relaxed,
            },
          },
          'StreetJS v1.2.8 is the current stable release. It includes all core features, security components, and background job support.'
        )
      ),
      
      section(
        {
          class: commonStyles.card,
          style: {
            marginTop: ds.spacing[12],
          },
        },
        h2(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
              fontWeight: ds.fontWeights.semibold,
              marginBottom: ds.spacing[4],
            },
          },
          'License'
        ),
        
        p(
          {
            style: {
              lineHeight: ds.lineHeights.relaxed,
            },
          },
          'StreetJS is ',
          a(
            {
              href: 'https://github.com/hassanmubiru/StreetJS/blob/main/LICENSE',
              style: {
                color: ds.colors.accent,
                textDecoration: 'underline',
              },
            },
            'MIT licensed'
          ),
          '. Use it freely in your projects.'
        )
      )
    )
  );
}
