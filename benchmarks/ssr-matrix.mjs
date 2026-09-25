import { performance } from 'node:perf_hooks';
import path from 'node:path'; import fs from 'node:fs';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document','Node','Element','HTMLElement','Text','Comment','DocumentFragment','Event','CustomEvent'])
  globalThis[k] = k==='document'?win.document:win[k];
globalThis.window = win;
const appDist = path.resolve(process.env.W,'examples','streetui-performance-app','dist');
const { compilePage, createDeps } = await import(path.join(appDist,'index.js'));
const { renderToString, ServerDOMAdapter, createRenderContext, mountGraph, serializeChildren } = await import('streetui');
const gc=()=>{try{globalThis.gc?.();}catch{}};
const r4=(x)=>Math.round(x*1e4)/1e4;
function stats(fn,{warmup=3,iterations=15}={}){for(let i=0;i<warmup;i++){fn();gc();}const s=[];for(let i=0;i<iterations;i++){const t=performance.now();fn();s.push(performance.now()-t);gc();}s.sort((a,b)=>a-b);return{medianMs:r4(s[Math.floor(s.length/2)]),p95Ms:r4(s[Math.min(s.length-1,Math.ceil(0.95*s.length)-1)]),minMs:r4(s[0]),maxMs:r4(s[s.length-1]),samples:s.length};}
const out=[];
for(const rows of [1,100,1000,5000,10000]){
  const compiled = compilePage(createDeps({sizing:{rows}}), 'users', {name:'light'});
  const body = renderToString(compiled);
  const total = stats(()=>renderToString(compiled));
  const mount = stats(()=>{const d=new ServerDOMAdapter();const c=d.createElement('div');const ctx=createRenderContext(d,compiled.graph,c);const rt=mountGraph(ctx);rt.dispose();ctx.instances.clear();});
  let serialize; {const d=new ServerDOMAdapter();const c=d.createElement('div');const ctx=createRenderContext(d,compiled.graph,c);const rt=mountGraph(ctx);serialize=stats(()=>serializeChildren(c));rt.dispose();ctx.instances.clear();}
  out.push({rows,bytes:Buffer.byteLength(body,'utf8'),total,mount,serialize});
  console.log(`rows=${String(rows).padStart(5)} bytes=${String(Buffer.byteLength(body,'utf8')).padStart(8)} total(med/p95)=${total.medianMs}/${total.p95Ms}ms mount=${mount.medianMs}ms serialize=${serialize.medianMs}ms samples=${total.samples}`);
}
fs.writeFileSync(path.join(process.env.W,'benchmarks','results','v1.6','ssr-matrix.json'), JSON.stringify({note:'Node+happy-dom SSR row-count matrix. NOT a browser number.',runtime:`node ${process.version}`,rows:out},null,2));
