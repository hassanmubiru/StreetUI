// SEO metadata per route
export interface SEOMetadata {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  keywords?: string[];
}

const baseUrl = 'https://streetjs.dev';

export const seoData: Record<string, SEOMetadata> = {
  '/': {
    title: 'StreetJS - Production-Grade TypeScript Backend Framework',
    description: 'Build production-ready APIs with native PostgreSQL, JWT, WebSockets, and zero Express dependencies. Type-safe decorators and dependency injection built-in.',
    keywords: ['typescript', 'backend framework', 'postgresql', 'jwt', 'websockets', 'decorators', 'dependency injection'],
  },
  '/getting-started': {
    title: 'Getting Started | StreetJS',
    description: 'Learn how to install StreetJS, create your first controller, and build production-ready TypeScript backend applications.',
    keywords: ['getting started', 'tutorial', 'installation', 'quickstart'],
  },
  '/docs': {
    title: 'Documentation | StreetJS',
    description: 'Complete StreetJS documentation covering decorators, database APIs, security, background jobs, and more.',
    keywords: ['documentation', 'api reference', 'guides'],
  },
  '/examples': {
    title: 'Examples | StreetJS',
    description: 'Real-world StreetJS code examples showing REST APIs, authentication, validation, and background job processing.',
    keywords: ['examples', 'code samples', 'tutorials', 'rest api', 'authentication'],
  },
  '/api': {
    title: 'API Reference | StreetJS',
    description: 'Complete API reference for StreetJS decorators, core classes, middleware, and utilities.',
    keywords: ['api', 'reference', 'decorators', 'middleware'],
  },
  '/guides': {
    title: 'Guides | StreetJS',
    description: 'Step-by-step guides for database setup, authentication, authorization, validation, migrations, and deployment.',
    keywords: ['guides', 'tutorials', 'how-to'],
  },
  '/community': {
    title: 'Community | StreetJS',
    description: 'Join the StreetJS community. Get help, contribute, and connect with other developers.',
    keywords: ['community', 'support', 'github', 'contributing'],
  },
  '/about': {
    title: 'About StreetJS',
    description: 'Learn about the StreetJS philosophy, team, and our mission to build better TypeScript backend frameworks.',
    keywords: ['about', 'philosophy', 'team'],
  },
};

export function getSEO(path: string): SEOMetadata {
  return seoData[path] || seoData['/'];
}

export function generateMetaTags(path: string): string {
  const seo = getSEO(path);
  const canonical = `${baseUrl}${path}`;
  
  return `
    <title>${seo.title}</title>
    <meta name="description" content="${seo.description}">
    ${seo.keywords ? `<meta name="keywords" content="${seo.keywords.join(', ')}">` : ''}
    <link rel="canonical" href="${canonical}">
    
    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonical}">
    <meta property="og:title" content="${seo.title}">
    <meta property="og:description" content="${seo.description}">
    ${seo.ogImage ? `<meta property="og:image" content="${seo.ogImage}">` : ''}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${canonical}">
    <meta name="twitter:title" content="${seo.title}">
    <meta name="twitter:description" content="${seo.description}">
    ${seo.ogImage ? `<meta name="twitter:image" content="${seo.ogImage}">` : ''}
    
    <!-- Additional -->
    <meta name="robots" content="index, follow">
    <meta name="author" content="StreetJS Team">
  `.trim();
}
