import { mount, router, route } from 'streetui';
import { Shell } from './shell.js';
import {
  HomePage,
  GettingStartedPage,
  DocsPage,
  ExamplesPage,
  ApiPage,
  GuidesPage,
  CommunityPage,
  AboutPage,
  NotFoundPage
} from './routes.js';

export function createApp() {
  return router(
    route('/', () => Shell(HomePage())),
    route('/getting-started', () => Shell(GettingStartedPage())),
    route('/docs', () => Shell(DocsPage())),
    route('/docs/:section', () => Shell(DocsPage())),
    route('/examples', () => Shell(ExamplesPage())),
    route('/api', () => Shell(ApiPage())),
    route('/guides', () => Shell(GuidesPage())),
    route('/plugins', () => Shell(DocsPage())),   // Placeholder
    route('/changelog', () => Shell(DocsPage())), // Placeholder
    route('/blog', () => Shell(DocsPage())),      // Placeholder
    route('/community', () => Shell(CommunityPage())),
    route('/about', () => Shell(AboutPage())),
    route('*', () => Shell(NotFoundPage()))
  );
}
