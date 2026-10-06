import { createRouter, createMemoryHistory, createBrowserHistory } from 'streetui';
import {
  homePage, gettingStartedPage, docsPage, apiPage,
  examplesPage, notFoundPage, placeholderPage,
} from './routes.js';

export function createApp(path = '/') {
  const router = createRouter({
    routes: [
      { path: '/',                builder: homePage },
      { path: '/getting-started', builder: gettingStartedPage },
      { path: '/docs',            builder: docsPage },
      { path: '/docs/:section',   builder: docsPage },
      { path: '/api',             builder: apiPage },
      { path: '/examples',        builder: examplesPage },
      { path: '/guides',          builder: placeholderPage('Guides') },
      { path: '/changelog',       builder: placeholderPage('Changelog') },
      { path: '/blog',            builder: placeholderPage('Blog') },
      { path: '/about',           builder: placeholderPage('About') },
      { path: '*',                builder: notFoundPage },
    ],
    history: createMemoryHistory(path),
  });
  return router;
}

export function createClientApp() {
  const router = createRouter({
    routes: [
      { path: '/',                builder: homePage },
      { path: '/getting-started', builder: gettingStartedPage },
      { path: '/docs',            builder: docsPage },
      { path: '/docs/:section',   builder: docsPage },
      { path: '/api',             builder: apiPage },
      { path: '/examples',        builder: examplesPage },
      { path: '/guides',          builder: placeholderPage('Guides') },
      { path: '/changelog',       builder: placeholderPage('Changelog') },
      { path: '/blog',            builder: placeholderPage('Blog') },
      { path: '/about',           builder: placeholderPage('About') },
      { path: '*',                builder: notFoundPage },
    ],
    history: createBrowserHistory(),
  });
  return router;
}
