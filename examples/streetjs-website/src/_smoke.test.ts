import { it } from 'vitest';
import { renderWebsite } from './server-entry.js';
it('smoke', () => {
  for (const p of ['/', '/docs/http', '/playground', '/nope', '/docs/zzz']) {
    const r = renderWebsite(p);
    console.log(p, r.status, r.html.length, r.head.slice(0, 700));
  }
});
