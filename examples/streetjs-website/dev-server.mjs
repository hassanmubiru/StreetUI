import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple dev server that serves a static HTML page with inline hydration
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StreetJS - Production-grade TypeScript Backend Framework</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #1e293b;
    }
  </style>
</head>
<body>
  <div id="app">
    <h1>StreetJS Website - Dev Mode</h1>
    <p>This is a simplified development server. The full SSR application requires build tooling.</p>
    <p>See <code>PHASE1-REPORT.md</code> for details on what was built.</p>
  </div>
</body>
</html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
  console.log('Note: This is a minimal dev server. Full SSR requires build tooling.');
});
