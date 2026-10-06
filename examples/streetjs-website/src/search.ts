import { signal, derived } from 'streetui';
import { docSections } from './docs-content.js';

export interface SearchResult {
  title: string;
  description: string;
  url: string;
  type: 'doc' | 'guide' | 'api' | 'example' | 'page';
}

// Search state
export const searchQuery = signal('');
export const isSearchOpen = signal(false);
export const selectedIndex = signal(0);

// Build search index
const searchIndex: SearchResult[] = [
  // Homepage
  { title: 'StreetJS', description: 'TypeScript-first backend framework', url: '/', type: 'page' },
  { title: 'Getting Started', description: 'Install StreetJS and build your first backend', url: '/getting-started', type: 'page' },

  // Documentation
  ...docSections.map(doc => ({
    title: doc.title,
    description: doc.content.slice(0, 150).replace(/\n/g, ' '),
    url: `/docs/${doc.id}`,
    type: 'doc' as const,
  })),

  // Guides
  { title: 'Building a REST API', description: 'Controllers, validation, error handling', url: '/guides/rest-api', type: 'guide' },
  { title: 'Database Patterns', description: 'Queries, transactions, string column trap', url: '/guides/database', type: 'guide' },
  { title: 'Authentication', description: 'JWT tokens, RBAC, password handling', url: '/guides/auth', type: 'guide' },
  { title: 'Background Jobs', description: 'JobQueue, CronScheduler, WorkflowEngine', url: '/guides/jobs', type: 'guide' },
  { title: 'Testing', description: 'Unit tests, integration tests', url: '/guides/testing', type: 'guide' },
  { title: 'Deployment', description: 'Production setup, environment variables', url: '/guides/deployment', type: 'guide' },

  // API
  { title: 'API Reference', description: 'Complete StreetJS API reference', url: '/api', type: 'api' },
  { title: '@Controller', description: 'Define route controllers with path prefix', url: '/api#decorators', type: 'api' },
  { title: '@Get, @Post, @Put, @Delete', description: 'HTTP method decorators', url: '/api#decorators', type: 'api' },
  { title: '@Validate', description: 'Zod-based validation decorator', url: '/api#decorators', type: 'api' },
  { title: '@Roles', description: 'Role-based access control decorator', url: '/api#decorators', type: 'api' },
  { title: 'StreetContext', description: 'Request context with database, request, response', url: '/api#context', type: 'api' },
  { title: 'PgPool', description: 'Native PostgreSQL driver (all columns return strings)', url: '/api#database', type: 'api' },
  { title: 'JwtService', description: 'JWT token signing and verification', url: '/api#authentication', type: 'api' },
  { title: 'RbacService', description: 'Role-based access control with hierarchy', url: '/api#authentication', type: 'api' },
  { title: 'JobQueue', description: 'Async job queue for background tasks', url: '/api#jobs', type: 'api' },
  { title: 'CronScheduler', description: 'Schedule recurring tasks with cron expressions', url: '/api#jobs', type: 'api' },
  { title: 'StreetMigrationRunner', description: 'Database schema migrations', url: '/api#migrations', type: 'api' },

  // Examples
  { title: 'Examples', description: 'Real StreetJS code examples', url: '/examples', type: 'example' },
  { title: 'Controller Example', description: 'Create REST endpoints with validation', url: '/examples#controller', type: 'example' },
  { title: 'Authentication Example', description: 'JWT login and protected routes', url: '/examples#auth', type: 'example' },
  { title: 'Database Example', description: 'Correct string column decoding', url: '/examples#database', type: 'example' },

  // Other pages
  { title: 'Playground', description: 'Interactive code editor', url: '/playground', type: 'page' },
  { title: 'Plugins', description: 'Extend StreetJS with plugins', url: '/plugins', type: 'page' },
  { title: 'Changelog', description: 'Release history and version notes', url: '/changelog', type: 'page' },
  { title: 'Blog', description: 'Tutorials and announcements', url: '/blog', type: 'page' },
  { title: 'About', description: 'About StreetJS framework', url: '/about', type: 'page' },
];

// Search results (filtered and sorted)
export const searchResults = derived(() => {
  const query = searchQuery.get().toLowerCase().trim();
  if (!query) return [];

  const results = searchIndex
    .filter(item => {
      const titleMatch = item.title.toLowerCase().includes(query);
      const descMatch = item.description.toLowerCase().includes(query);
      return titleMatch || descMatch;
    })
    .map(item => {
      // Calculate relevance score
      const titleMatch = item.title.toLowerCase().includes(query);
      const exactMatch = item.title.toLowerCase() === query;
      const startsWithMatch = item.title.toLowerCase().startsWith(query);

      let score = 0;
      if (exactMatch) score += 100;
      else if (startsWithMatch) score += 50;
      else if (titleMatch) score += 25;
      else score += 10; // description match

      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10 results

  return results;
});

// Search actions
export function openSearch() {
  isSearchOpen.set(true);
  selectedIndex.set(0);
}

export function closeSearch() {
  isSearchOpen.set(false);
  searchQuery.set('');
  selectedIndex.set(0);
}

export function updateQuery(query: string) {
  searchQuery.set(query);
  selectedIndex.set(0);
}

export function moveSelection(direction: 'up' | 'down') {
  const results = searchResults.get();
  if (results.length === 0) return;

  const current = selectedIndex.get();
  if (direction === 'down') {
    selectedIndex.set(Math.min(current + 1, results.length - 1));
  } else {
    selectedIndex.set(Math.max(current - 1, 0));
  }
}

export function getSelectedResult(): SearchResult | null {
  const results = searchResults.get();
  const index = selectedIndex.get();
  return results[index] || null;
}

// Keyboard shortcut handler (Cmd/Ctrl+K)
export function initSearchShortcut() {
  if (typeof document === 'undefined') return;

  document.addEventListener('keydown', (e) => {
    // Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }

    // Escape to close
    if (e.key === 'Escape' && isSearchOpen.get()) {
      e.preventDefault();
      closeSearch();
    }

    // Arrow navigation
    if (isSearchOpen.get()) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection('up');
      }
    }
  });
}
