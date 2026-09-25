import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document','Node','Element','HTMLElement','Text','Comment','DocumentFragment','Event','CustomEvent'])
  globalThis[k] = k==='document'?win.document:win[k];
globalThis.window = win;
const W = process.env.W;
const appDist = path.join(W,'examples','streetui-performance-app','dist');
const { compilePage, createDeps } = await import(path.join(appDist,'index.js'));
const streetui = await import('streetui');
const { ServerDOMAdapter, createRenderContext, mountGraph } = streetui;
const compiled = compilePage(createDeps({view:'users'}), 'users', {name:'light'});

// Build one /users tree and census the ServerDOM.
const dom = new ServerDOMAdapter();
const container = dom.createElement('div');
const ctx = createRenderContext(dom, compiled.graph, container);
const root = mountGraph(ctx);

let elements=0, texts=0, comments=0, fragments=0;
let elsWithAttrs=0, attrTotal=0, elsWithProps=0, propTotal=0, elsWithStyle=0, emptyAttrMaps=0, emptyPropMaps=0, emptyStyleMaps=0;
function walk(n){
  switch(n.kind){
    case 'text': texts++; break;
    case 'comment': comments++; break;
    case 'fragment': fragments++; for(const c of n.children) walk(c); break;
    case 'element': {
      elements++;
      const a=n.attributes.size, p=(n._properties?n._properties.size:0), s=(n._style?n._style.declarations.size:0);
      if(a>0){elsWithAttrs++; attrTotal+=a;} else emptyAttrMaps++;
      if(p>0){elsWithProps++; propTotal+=p;} else emptyPropMaps++;
      if(s>0){elsWithStyle++;} else emptyStyleMaps++;
      for(const c of n.children) walk(c);
      break;
    }
  }
}
for(const c of container.children) walk(c);
console.log(JSON.stringify({
  elements, texts, comments, fragments,
  totalNodes: elements+texts+comments+fragments,
  attributes:{elsWithAttrs, attrTotal, emptyAttrMaps, pctElsWithAttrs: +(100*elsWithAttrs/elements).toFixed(1)},
  properties:{elsWithProps, propTotal, emptyPropMaps, pctElsWithProps: +(100*elsWithProps/elements).toFixed(1)},
  style:{elsWithStyle, emptyStyleMaps, pctElsWithStyle: +(100*elsWithStyle/elements).toFixed(1)},
  perElementEagerAllocs: 'each ServerElement = 1 obj + attributes Map + properties Map + children [] + ServerStyle(+declarations Map)',
  emptyMapAllocs:{ properties: emptyPropMaps, style: emptyStyleMaps, attributes: emptyAttrMaps },
},null,1));
root.dispose(); ctx.instances.clear();
