/**
 * Netlify Edge Function — SSR handler for the StreetJS website.
 * Handles every route (path: "/*"). Static files are served by Netlify CDN
 * from the netlify-static/ publish directory.
 *
 * This file is bundled with esbuild into ssr.mjs (self-contained, no imports
 * resolved at runtime). See the rebuild step below.
 */
import { createHash } from 'node:crypto';
import { renderWebsite, allPaths } from '../../dist/index.js';

const THEME_SCRIPT =
  "try{var c=localStorage.getItem('streetjs-theme');var d=c==='dark'||((c===null||c==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}";
const themeHash = `'sha256-${createHash('sha256').update(THEME_SCRIPT).digest('base64')}'`;

const SECURITY_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'content-security-policy':
    `default-src 'self'; script-src 'self' ${themeHash}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
};

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

export default async (req) => {
  try {
    const url = new URL(req.url);
    const siteUrl = url.origin;
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/robots.txt') {
      return new Response(
        `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`,
        { headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }
    if (pathname === '/sitemap.xml') {
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allPaths().map((p) => `<url><loc>${siteUrl}${p}</loc></url>`).join('\n')}\n</urlset>\n`;
      return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
    }

    const rendered = renderWebsite(pathname + url.search, { siteUrl });
    return new Response(documentHtml(rendered), {
      status: rendered.status,
      headers: SECURITY_HEADERS,
    });
  } catch (err) {
    console.error(err);
    return new Response('Internal server error', { status: 500 });
  }
};

export const config = { path: '/*' };
