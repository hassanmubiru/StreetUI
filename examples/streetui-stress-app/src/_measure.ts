// TEMPORARY measurement entry (deleted after use). Not a .test.ts, not imported.
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { renderApp } from './app.js';
import { styleRegistry } from 'streetui';

const routes = ['/', '/products', '/orders', '/customers', '/analytics', '/settings'];
const sheets = new Map<string, string>();
let htmlBytesByRoute: Record<string, number> = {};
for (const r of routes) {
  const { html, styles } = renderApp(r);
  sheets.set(r, styles);
  htmlBytesByRoute[r] = Buffer.byteLength(html, 'utf8');
}

// Stylesheet is a registry superset — must be identical for every route.
const uniqueSheets = new Set(sheets.values());
const sheet = sheets.get('/') as string;
const raw = Buffer.byteLength(sheet, 'utf8');
const gz = gzipSync(sheet).length;
const br = brotliCompressSync(sheet).length;

console.log(JSON.stringify({
  identities: styleRegistry.identities().length,
  stylesheet: { raw, gzip: gz, brotli: br },
  distinctSheetsAcrossRoutes: uniqueSheets.size,
  htmlBytesByRoute,
}, null, 2));
