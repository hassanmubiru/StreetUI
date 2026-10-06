import { mount, router, route } from 'streetui';
import { Shell } from './shell.js';
import { HomePage, GettingStartedPage, DocsPage, NotFoundPage } from './routes.js';

export function createApp() {
  return router(
    route('/', () => Shell(HomePage())),
    route('/getting-started', () => Shell(GettingStartedPage())),
    route('/docs', () => Shell(DocsPage())),
    route('/docs/:section', () => Shell(DocsPage())),
    route('/examples', () => Shell(DocsPage())),  // Placeholder
    route('/api', () => Shell(DocsPage())),       // Placeholder
    route('/guides', () => Shell(DocsPage())),    // Placeholder
    route('/plugins', () => Shell(DocsPage())),   // Placeholder
    route('/changelog', () => Shell(DocsPage())), // Placeholder
    route('/blog', () => Shell(DocsPage())),      // Placeholder
    route('/community', () => Shell(DocsPage())), // Placeholder
    route('/about', () => Shell(DocsPage())),     // Placeholder
    route('*', () => Shell(NotFoundPage()))
  );
}
