import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document','Node','Element','HTMLElement','Text','Comment','DocumentFragment','Event','CustomEvent'])
  globalThis[k] = k==='document'?win.document:win[k];
globalThis.window = win;
const appDist = path.resolve(process.env.W,'examples','streetui-performance-app','dist');
const { compilePage, createDeps } = await import(path.join(appDist,'index.js'));
const { renderToString } = await import('streetui');
const ROUTES = ['overview','dashboard','users','controls','settings'];
const out = {};
for (const view of ROUTES) {
  const compiled = compilePage(createDeps({view}), view, {name:'light'});
  const html = renderToString(compiled);
  out[view] = { bytes: Buffer.byteLength(html,'utf8'), sha256: crypto.createHash('sha256').update(html).digest('hex') };
}
const label = process.argv[2] ?? 'hashes';
fs.writeFileSync(path.join(process.env.W,'benchmarks','results','v1.6',label+'.json'), JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
