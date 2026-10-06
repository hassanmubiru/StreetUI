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
