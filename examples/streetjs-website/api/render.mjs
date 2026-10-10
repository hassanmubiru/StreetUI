// Vercel serverless function — SSR handler for the StreetJS website.
// Handles every route that isn't a static asset (browser-entry.js, favicon.svg).
import { createHash } from 'node:crypto';
import { renderWebsite, allPaths } from '../dist/index.js';

const THEME_SCRIPT =
  "try{var c=localStorage.getItem('streetjs-theme');var d=c==='dark'||((c===null||c==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}";
const themeHash = `'sha256-${createHash('sha256').update(THEME_SCRIPT).digest('base64')}'`;

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'content-security-policy':
    `default-src 'self'; script-src 'self' ${themeHash}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
};

function documentHtml(r, siteUrl) {
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

export default function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const siteUrl = `https://${req.headers.host}`;
    const pathname = decodeURIComponent(url.pathname);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD', ...SECURITY }).end();
      return;
    }

    if (pathname === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY })
        .end(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
      return;
    }

    if (pathname === '/sitemap.xml') {
      const paths = allPaths();
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p => `<url><loc>${siteUrl}${p}</loc></url>`).join('\n')}\n</urlset>\n`;
      res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8', ...SECURITY }).end(body);
      return;
    }

    const rendered = renderWebsite(pathname + url.search, { siteUrl });
    res.writeHead(rendered.status, { 'content-type': 'text/html; charset=utf-8', ...SECURITY });
    res.end(req.method === 'HEAD' ? undefined : documentHtml(rendered, siteUrl));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY })
      .end('Internal server error');
  }
}
