import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document','Node','Element','HTMLElement','Text','Comment','DocumentFragment','Event','CustomEvent'])
  globalThis[k] = k==='document'?win.document:win[k];
globalThis.window = win;
const appDist = path.resolve(process.env.W,'examples','streetui-performance-app','dist');
const { compilePage, createDeps } = await import(path.join(appDist,'index.js'));
const { ServerDOMAdapter, createRenderContext, mountGraph } = await import('streetui');
const compiled = compilePage(createDeps({view:'users'}), 'users', {name:'light'});
const gc=()=>{try{globalThis.gc?.();}catch{}};
function mountOnce(){ const dom=new ServerDOMAdapter(); const c=dom.createElement('div'); const ctx=createRenderContext(dom,compiled.graph,c); const r=mountGraph(ctx); r.dispose(); ctx.instances.clear(); }
function med(fn,it=21){ for(let i=0;i<4;i++){fn();gc();} const s=[]; for(let i=0;i<it;i++){const t=performance.now();fn();s.push(performance.now()-t);gc();} s.sort((a,b)=>a-b); return +(s[Math.floor(s.length/2)]).toFixed(2); }
for(let run=1;run<=3;run++) console.log('run',run,'mount median (current lazy build):', med(mountOnce),'ms');
