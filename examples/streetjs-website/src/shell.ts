import { div, header, nav, a, button, footer, p, span } from 'streetui';
import { ds, commonStyles } from './design-system.js';
import { currentTheme, toggleTheme } from './theme.js';
import { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } from './mobile-nav.js';

export function Shell(content: any) {
  return div(
    {
      style: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      },
    },
    Header(),
    MobileNav(),
    div(
      {
        style: {
          flex: '1',
        },
      },
      content
    ),
    Footer()
  );
}

function Header() {
  return header(
    {
      style: {
        borderBottom: `1px solid ${ds.colors.border}`,
        backgroundColor: ds.colors.bg,
        position: 'sticky',
        top: '0',
        zIndex: ds.zIndex.sticky,
        backdropFilter: 'blur(8px)',
      },
    },
    div(
      {
        class: commonStyles.container,
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '4rem',
        },
      },
      
      // Logo
      a(
        {
          href: '/',
          style: {
            fontSize: ds.fontSizes.xl,
            fontWeight: ds.fontWeights.bold,
            color: ds.colors.primary,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: ds.spacing[2],
          },
        },
        span(
          {
            style: {
              fontSize: ds.fontSizes['2xl'],
            },
          },
          '🛣️'
        ),
        'StreetJS'
      ),
      
      // Desktop Navigation
      nav(
        {
          style: {
            display: 'flex',
            gap: ds.spacing[8],
            alignItems: 'center',
            '@media (max-width: 768px)': {
              display: 'none',
            },
          },
        },
        NavLink('Getting Started', '/getting-started'),
        NavLink('Docs', '/docs'),
        NavLink('Examples', '/examples'),
        NavLink('API', '/api'),
        
        // Theme switcher
        button(
          {
            onclick: toggleTheme,
            style: {
              background: 'none',
              border: 'none',
              fontSize: ds.fontSizes.xl,
              cursor: 'pointer',
              padding: ds.spacing[2],
              color: ds.colors.text,
              transition: ds.transitions.fast,
              '&:hover': {
                color: ds.colors.primary,
              },
            },
            'aria-label': 'Toggle theme',
            title: 'Toggle theme',
          },
          currentTheme.get() === 'dark' ? '☀️' : '🌙'
        ),

        a(
          {
            href: 'https://github.com/hassanmubiru/StreetJS',
            target: '_blank',
            rel: 'noopener noreferrer',
            style: {
              color: ds.colors.text,
              textDecoration: 'none',
              fontSize: ds.fontSizes.xl,
            },
            'aria-label': 'GitHub',
          },
          '⭐'
        )
      )
    )
  );
}

function NavLink(text: string, href: string) {
  return a(
    {
      href,
      style: {
        color: ds.colors.text,
        textDecoration: 'none',
        fontSize: ds.fontSizes.base,
        fontWeight: ds.fontWeights.medium,
        transition: ds.transitions.fast,
        '&:hover': {
          color: ds.colors.primary,
        },
      },
    },
    text
  );
}

function Footer() {
  return footer(
    {
      style: {
        borderTop: `1px solid ${ds.colors.border}`,
        backgroundColor: ds.colors.bgAlt,
        paddingBlock: ds.spacing[12],
        marginTop: ds.spacing[20],
      },
    },
    div(
      {
        class: commonStyles.container,
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: ds.spacing[8],
        },
      },
      
      div(
        div(
          {
            style: {
              fontSize: ds.fontSizes.lg,
              fontWeight: ds.fontWeights.bold,
              marginBottom: ds.spacing[4],
            },
          },
          'StreetJS'
        ),
        p(
          {
            style: {
              color: ds.colors.textMuted,
              fontSize: ds.fontSizes.sm,
              lineHeight: ds.lineHeights.relaxed,
            },
          },
          'Production-grade TypeScript backend framework'
        )
      ),
      
      FooterColumn(
        'Documentation',
        [
          { text: 'Getting Started', href: '/getting-started' },
          { text: 'API Reference', href: '/api' },
          { text: 'Examples', href: '/examples' },
          { text: 'Guides', href: '/guides' },
        ]
      ),
      
      FooterColumn(
        'Community',
        [
          { text: 'GitHub', href: 'https://github.com/hassanmubiru/StreetJS' },
          { text: 'npm', href: 'https://www.npmjs.com/package/streetjs' },
          { text: 'Changelog', href: '/changelog' },
        ]
      ),
      
      FooterColumn(
        'Resources',
        [
          { text: 'Blog', href: '/blog' },
          { text: 'Plugins', href: '/plugins' },
          { text: 'About', href: '/about' },
        ]
      )
    ),
    
    div(
      {
        class: commonStyles.container,
        style: {
          marginTop: ds.spacing[8],
          paddingTop: ds.spacing[8],
          borderTop: `1px solid ${ds.colors.border}`,
          textAlign: 'center',
          color: ds.colors.textMuted,
          fontSize: ds.fontSizes.sm,
        },
      },
      p(`© ${new Date().getFullYear()} StreetJS. Built with StreetUI.`)
    )
  );
}

function FooterColumn(title: string, links: Array<{ text: string; href: string }>) {
  return div(
    div(
      {
        style: {
          fontSize: ds.fontSizes.sm,
          fontWeight: ds.fontWeights.semibold,
          marginBottom: ds.spacing[4],
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: ds.colors.text,
        },
      },
      title
    ),
    div(
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: ds.spacing[2],
        },
      },
      ...links.map(link =>
        a(
          {
            href: link.href,
            style: {
              color: ds.colors.textMuted,
              textDecoration: 'none',
              fontSize: ds.fontSizes.sm,
              transition: ds.transitions.fast,
              '&:hover': {
                color: ds.colors.primary,
              },
            },
          },
          link.text
        )
      )
    )
  );
}

// Mobile menu button
function MobileMenuButton() {
  return button(
    {
      onclick: toggleMobileMenu,
      style: {
        display: 'none',
        '@media (max-width: 768px)': {
          display: 'flex',
        },
        background: 'none',
        border: 'none',
        fontSize: ds.fontSizes['2xl'],
        cursor: 'pointer',
        padding: ds.spacing[2],
        color: ds.colors.text,
      },
      'aria-label': 'Toggle menu',
      'aria-expanded': isMobileMenuOpen.get(),
    },
    isMobileMenuOpen.get() ? '✕' : '☰'
  );
}

// Mobile navigation drawer
function MobileNav() {
  const isOpen = isMobileMenuOpen.get();
  
  return div(
    {
      style: {
        display: 'none',
        '@media (max-width: 768px)': {
          display: isOpen ? 'block' : 'none',
        },
        position: 'fixed',
        top: '4rem',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: ds.colors.bg,
        borderTop: `1px solid ${ds.colors.border}`,
        zIndex: ds.zIndex.modal,
        overflowY: 'auto',
        padding: ds.spacing[6],
      },
    },
    div(
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: ds.spacing[4],
        },
      },
      MobileNavLink('Getting Started', '/getting-started'),
      MobileNavLink('Docs', '/docs'),
      MobileNavLink('Examples', '/examples'),
      MobileNavLink('API', '/api'),
      MobileNavLink('Guides', '/guides'),
      MobileNavLink('Community', '/community'),
      div(
        {
          style: {
            marginTop: ds.spacing[4],
            paddingTop: ds.spacing[4],
            borderTop: `1px solid ${ds.colors.border}`,
          },
        },
        a(
          {
            href: 'https://github.com/hassanmubiru/StreetJS',
            target: '_blank',
            rel: 'noopener noreferrer',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: ds.spacing[2],
              color: ds.colors.text,
              textDecoration: 'none',
              padding: ds.spacing[3],
              fontSize: ds.fontSizes.lg,
            },
          },
          '⭐',
          ' View on GitHub'
        )
      )
    )
  );
}

function MobileNavLink(text: string, href: string) {
  return a(
    {
      href,
      onclick: closeMobileMenu,
      style: {
        color: ds.colors.text,
        textDecoration: 'none',
        fontSize: ds.fontSizes.lg,
        fontWeight: ds.fontWeights.medium,
        padding: ds.spacing[3],
        borderRadius: ds.radii.md,
        transition: ds.transitions.fast,
        '&:hover': {
          backgroundColor: ds.colors.bgAlt,
          color: ds.colors.primary,
        },
      },
    },
    text
  );
}
