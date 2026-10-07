// StreetJS website production server: static assets from dist/ plus server-side
// rendering for every route (real 404 status for unknown paths).
//   npm run build && SITE_URL=https://your.host npm start
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderWebsite, allPaths } from './dist/index.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = join(root, 'dist');
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
const siteUrl = process.env.SITE_URL; // origin used for canonical / Open Graph URLs

// Applies the saved/OS theme before first paint so there is no flash.
const THEME_SCRIPT =
  "try{var c=localStorage.getItem('streetjs-theme');var d=c==='dark'||((c===null||c==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}";
const themeHash = `'sha256-${createHash('sha256').update(THEME_SCRIPT).digest('base64')}'`;

const MIME = { '.js': 'text/javascript; charset=utf-8', '.map': 'application/json', '.svg': 'image/svg+xml' };

function documentHtml(r) {
  return `<!doctype html>
<html lang="en">
<head>
${r.head}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${r.styles}
<script>${THEME_SCRIPT}</script>
</head>
<body>
<div id="app" data-ssr>${r.html}</div>
${r.stateScript}
<script type="module" src="/browser-entry.js"></script>
</body>
</html>`;
}

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  // connect-src is open to http(s) because the playground probes a URL the visitor types.
  'content-security-policy':
    `default-src 'self'; script-src 'self' ${themeHash}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
};

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD', ...SECURITY }).end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/robots.txt') {
      const body = `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml\n` : ''}`;
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY }).end(body);
      return;
    }
    if (pathname === '/sitemap.xml') {
      if (!siteUrl) { res.writeHead(404, SECURITY).end(); return; }
      const base = siteUrl.replace(/\/+$/, '');
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allPaths().map((p) => `<url><loc>${base}${p === '/' ? '/' : p}</loc></url>`).join('\n')}\n</urlset>\n`;
      res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8', ...SECURITY }).end(body);
      return;
    }

    // Static: only top-level files in dist/ (+ favicon) — no path traversal.
    const asset = pathname === '/favicon.svg' ? join(root, 'favicon.svg') : join(dist, normalize(pathname));
    const inside = asset === join(root, 'favicon.svg') || (asset.startsWith(dist + sep) && !asset.slice(dist.length + 1).includes(sep));
    if (inside && MIME[extname(asset)] !== undefined) {
      try {
        const data = await readFile(asset);
        res.writeHead(200, { 'content-type': MIME[extname(asset)], 'cache-control': 'public, max-age=300', ...SECURITY });
        res.end(req.method === 'HEAD' ? undefined : data);
        return;
      } catch { /* fall through to 404 */ }
      res.writeHead(404, SECURITY).end('Not found');
      return;
    }

    const rendered = renderWebsite(pathname + url.search, siteUrl ? { siteUrl } : {});
    res.writeHead(rendered.status, { 'content-type': 'text/html; charset=utf-8', ...SECURITY });
    res.end(req.method === 'HEAD' ? undefined : documentHtml(rendered));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY }).end('Internal server error');
  }
});

server.listen(port, host, () => console.log(`StreetJS website on http://${host}:${port}`));
