import path from 'node:path';
import crypto from 'node:crypto';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document','Node','Element','HTMLElement','Text','Comment','DocumentFragment','Event','CustomEvent'])
  globalThis[k] = k==='document'?win.document:win[k];
globalThis.window = win;
const appDist = path.resolve(process.env.W,'examples','streetui-performance-app','dist');
const { compilePage, createDeps } = await import(path.join(appDist,'index.js'));
const { renderToString } = await import('streetui');
const compiled = compilePage(createDeps({view:'users'}), 'users', {name:'light'});
const gc=()=>{try{globalThis.gc?.();}catch{}};
const mb=(b)=>+(b/1048576).toFixed(2);
let firstHash=null, stable=true;
function heapAfter(n){
  gc(); const before=process.memoryUsage().heapUsed;
  for(let i=0;i<n;i++){ const h=renderToString(compiled); if(firstHash===null) firstHash=crypto.createHash('sha256').update(h).digest('hex'); else if(crypto.createHash('sha256').update(h).digest('hex')!==firstHash) stable=false; }
  gc(); const after=process.memoryUsage().heapUsed;
  return { renders:n, heapBeforeMB:mb(before), heapAfterMB:mb(after), retainedMB:mb(after-before) };
}
// warm
renderToString(compiled); gc();
for(const n of [50,100,200]) console.log(JSON.stringify(heapAfter(n)));
console.log('outputStableAcrossAllRenders:', stable);
