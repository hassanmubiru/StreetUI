import { createRouter, createMemoryHistory, createBrowserHistory } from 'streetui';
import {
  homePage, gettingStartedPage, docsPage, apiPage,
  examplesPage, guidesPage, playgroundPage, pluginsPage,
  changelogPage, blogPage, aboutPage, notFoundPage,
} from './routes.js';

const routes = [
  { path: '/',                builder: homePage },
  { path: '/getting-started', builder: gettingStartedPage },
  { path: '/docs',            builder: docsPage },
  { path: '/docs/:section',   builder: docsPage },
  { path: '/guides',          builder: guidesPage },
  { path: '/guides/:slug',    builder: guidesPage },
  { path: '/api',             builder: apiPage },
  { path: '/examples',        builder: examplesPage },
  { path: '/playground',      builder: playgroundPage },
  { path: '/plugins',         builder: pluginsPage },
  { path: '/changelog',       builder: changelogPage },
  { path: '/blog',            builder: blogPage },
  { path: '/about',           builder: aboutPage },
  { path: '*',                builder: notFoundPage },
];

export function createApp(path = '/') {
  return createRouter({
    routes,
    history: createMemoryHistory(path),
  });
}

export function createClientApp() {
  return createRouter({
    routes,
    history: createBrowserHistory(),
  });
}
