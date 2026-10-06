import { streetui, compile, renderToString, renderStyles, renderHead, styleRegistry } from 'streetui';
import { createApp } from './app.js';
import { websiteShell } from './shell.js';

export function renderPage(path: string): { html: string; styles: string; head: string } {
  const router = createApp(path);
  const match = router.currentRoute.get();
  const ctx = { params: match.params, query: match.query, path: match.path, isFallback: match.isFallback };

  const app = streetui.app({ name: 'streetjs-docs' });
  app.page('main', (page) =>
    websiteShell(page, {
      renderOutlet: () => match.route.builder(page, ctx as never),
    })
  );

  const compiled = compile(app);
  const html = renderToString(compiled);
  const styles = renderStyles({ registry: styleRegistry });
  const head = renderHead(compiled);
  router.destroy();
  return { html, styles, head };
}
