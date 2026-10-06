import { renderToString } from 'streetui/server';
import { createApp } from './app.js';
import { themeCSSVariables } from './theme.js';
import { generateMetaTags } from './seo.js';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  
  // Serve static assets
  if (url.pathname.startsWith('/dist/')) {
    try {
      const filePath = join(__dirname, '..', url.pathname);
      const content = readFileSync(filePath);
      const ext = url.pathname.split('.').pop();
      const contentTypes: Record<string, string> = {
        js: 'application/javascript',
        css: 'text/css',
        html: 'text/html',
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext!] || 'text/plain' });
      res.end(content);
      return;
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
  }
  
  // SSR
  try {
    const app = createApp();
    const html = renderToString(app, { path: url.pathname });
    
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${generateMetaTags(url.pathname)}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--color-bg);
      color: var(--color-text);
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    ${themeCSSVariables}
  </style>
</head>
<body>
  <div id="app">${html}</div>
  <script type="module" src="/dist/browser-entry.js"></script>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fullHtml);
  } catch (error) {
    console.error('SSR error:', error);
    res.writeHead(500);
    res.end('Internal server error');
  }
});

server.listen(PORT, () => {
  console.log(`StreetJS website running on http://localhost:${PORT}`);
});
