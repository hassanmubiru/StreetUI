/**
 * Interactive DevTools view (2.2 Phase 1) — a self-contained, 12-panel browser
 * DevTools surface rendered as ONE HTML document.
 *
 * This extends the static `renderDevToolsHTML` (2.0 §8) into a *tabbed,
 * interactive* tool while preserving every DevTools design constraint:
 *
 *   - It consumes ONLY an existing {@link DevToolsSnapshot} (already composed
 *     from the read-only inspectors). There is NO second framework runtime, NO
 *     second reactive system, NO second graph, and NO DOM/subscription work at
 *     render time — this function is a pure string builder.
 *   - The snapshot is embedded once as inert JSON. A small, dependency-free
 *     vanilla-JS controller (no framework, no bundler, no network) renders the
 *     panels from that JSON in the browser: tab switching, component selection,
 *     and a Refresh button.
 *   - Refresh is pull-based and never mutates the app: the controller calls an
 *     optional host hook `window.__STREETUI_DEVTOOLS_REFRESH__()` that, when the
 *     host provides it, returns a fresh snapshot (e.g. from `session.refresh()`).
 *     Absent the hook, Refresh is a no-op — DevTools is never pushed to.
 *   - Every value the controller injects into the DOM is escaped; the embedded
 *     JSON is `<`-escaped so app data cannot break out of the <script> block.
 *
 * The 12 panels map 1:1 to the milestone spec: (1) Component Tree,
 * (2) Component Inspector, (3) Reactive State, (4) Signal/Dependency Graph,
 * (5) Router, (6) Resource/Async, (7) Mutation, (8) Event, (9) Overlay,
 * (10) Performance Timeline, (11) Error Diagnostics, (12) SSR/Hydration.
 *
 * HONEST SCOPE: this produces markup + a controller script. That it *renders*
 * pixels, is screen-reader conformant, or hits 60fps in a real browser is NOT
 * claimed and has NOT been observed here — no browser/AT exists in this
 * environment (browser + AT gates remain BLOCKED). What tests verify is that the
 * document faithfully and safely embeds the snapshot and that the controller
 * logic is deterministic (exercised under happy-dom, which is NOT a browser).
 */

import type { DevToolsSnapshot } from './panels.js';
import { escapeHtml } from './view.js';

export interface InteractiveDevToolsOptions {
  /** Tab id to open first. Defaults to `'components'`. */
  readonly initialTab?: string;
  /** Document <title>. Defaults to `StreetUI DevTools — <app name>`. */
  readonly title?: string;
}

/** The 12 panels, in tab order. `id` is stable and used by the controller/tests. */
export const DEVTOOLS_TABS: readonly { readonly id: string; readonly label: string }[] = [
  { id: 'components', label: 'Component Tree' },
  { id: 'inspector', label: 'Component Inspector' },
  { id: 'state', label: 'Reactive State' },
  { id: 'signalGraph', label: 'Signal Graph' },
  { id: 'router', label: 'Router' },
  { id: 'resources', label: 'Resource / Async' },
  { id: 'mutations', label: 'Mutations' },
  { id: 'events', label: 'Events' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'performance', label: 'Performance' },
  { id: 'diagnostics', label: 'Error Diagnostics' },
  { id: 'hydration', label: 'SSR / Hydration' },
];

/** Characters that must be escaped for safe inline embedding in a <script>. */
const EMBED_ESCAPE = new RegExp('[<\\u2028\\u2029]', 'g');

/** Serialize the snapshot for safe inline embedding in a <script> block. */
function embedJson(snapshot: DevToolsSnapshot): string {
  // Escape `<` (so the payload cannot terminate the <script> element) and the
  // JS line/paragraph separators U+2028/U+2029 (invalid raw in a string). The
  // controller reads this back with JSON.parse.
  return JSON.stringify(snapshot).replace(EMBED_ESCAPE, (ch) => {
    const code = ch.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${code}`;
  });
}

/**
 * Render the interactive 12-panel DevTools document for a snapshot. Static,
 * side-effect-free string builder. Re-run with a fresh snapshot (or let the
 * in-page Refresh button pull one via the host hook) to reflect new state.
 */
export function renderInteractiveDevTools(
  snapshot: DevToolsSnapshot,
  options: InteractiveDevToolsOptions = {},
): string {
  const app = snapshot.application;
  const title = options.title ?? `StreetUI DevTools — ${app.identity.name}`;
  const initialTab = options.initialTab ?? DEVTOOLS_TABS[0]!.id;

  const tabButtons = DEVTOOLS_TABS.map(
    (t) =>
      `<button type="button" role="tab" class="st-tab" data-tab="${escapeHtml(t.id)}"` +
      `${t.id === initialTab ? ' aria-selected="true"' : ' aria-selected="false"'}>` +
      `${escapeHtml(t.label)}</button>`,
  ).join('');

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(title)}</title><style>${INTERACTIVE_CSS}</style></head>` +
    `<body class="st-dt">` +
    `<header class="st-top"><h1>${escapeHtml(title)} ` +
    `<span class="st-dim">v${escapeHtml(app.identity.version)}</span></h1>` +
    `<button type="button" id="st-refresh" class="st-refresh">&#8635; Refresh</button></header>` +
    `<nav class="st-tabs" role="tablist" aria-label="DevTools panels">${tabButtons}</nav>` +
    `<main id="st-panel" class="st-body" role="tabpanel" aria-live="polite"></main>` +
    `<footer class="st-foot"><span class="st-dim">Structural inspection over one compiled graph. ` +
    `Not a production profiler; browser/AT conformance not claimed (gates BLOCKED).</span></footer>` +
    `<script type="application/json" id="st-data">${embedJson(snapshot)}</script>` +
    `<script>${CONTROLLER_JS.replace('__INITIAL_TAB__', JSON.stringify(initialTab))}</script>` +
    `</body></html>`
  );
}

// __APPEND_MARK__

/**
 * The in-page controller. Dependency-free vanilla JS (no framework, no bundler,
 * no network). Runs at end of <body>, so the DOM is present synchronously. It
 * reads the embedded snapshot JSON, renders the active panel, and wires tab
 * switching + a pull-based Refresh. Exposes `window.__StreetUIDevTools` for
 * host/test control. `__INITIAL_TAB__` is replaced with the initial tab id.
 */
const CONTROLLER_JS = [
  '(function(){',
  '"use strict";',
  'var INITIAL_TAB=__INITIAL_TAB__;',
  'function esc(v){',
  ' if(v===null||v===undefined)return String(v);',
  " var s=typeof v==='string'?v:(typeof v==='object'?sj(v):String(v));",
  " return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');",
  '}',
  'function sj(v){try{return JSON.stringify(v);}catch(e){return "[object]";}}',
  'function read(){var el=document.getElementById("st-data");if(!el)return {};try{return JSON.parse(el.textContent||"{}");}catch(e){return {};}}',
  'var state={data:read(),tab:INITIAL_TAB,selected:null};',
  'function findNode(n,id){if(!n)return null;if(n.id===id)return n;var c=n.children||[];for(var i=0;i<c.length;i++){var f=findNode(c[i],id);if(f)return f;}return null;}',
  'function empty(m){return "<p class=\\"st-empty\\">"+esc(m||"(none)")+"</p>";}',
  'function kv(k,v){return "<div class=\\"st-kv\\"><span class=\\"st-k\\">"+esc(k)+"</span><span class=\\"st-v\\">"+esc(v)+"</span></div>";}',
  'function rComponents(){',
  ' var cs=state.data.components||[];',
  ' if(!cs.length)return empty("No component() instances");',
  ' var h="<ul class=\\"st-list\\">";',
  ' for(var i=0;i<cs.length;i++){var c=cs[i];',
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(c.id||"")+"\\">"',
  '   +"<span class=\\"st-ind\\" style=\\"--d:"+(c.depth||0)+"\\"></span>"',
  '   +"<code>"+esc(c.name)+"</code>"',
  '   +(c.key!=null?" <span class=\\"st-key\\">#"+esc(c.key)+"</span>":"")',
  '   +" <span class=\\"st-dim\\">"+(c.childCount||0)+" child</span></li>";}',
  ' return h+"</ul><p class=\\"st-dim\\">Click a component to inspect it.</p>";',
  '}',
  'function rInspector(){',
  ' if(!state.selected)return empty("Select a node in Component Tree, Events or Overlays");',
  ' var n=findNode(state.data.graph,state.selected);',
  ' if(!n)return empty("Node "+state.selected+" not found in current snapshot");',
  ' var h="<h3><code>&lt;"+esc(n.type)+"&gt;</code>"+(n.key!=null?" <span class=\\"st-key\\">#"+esc(n.key)+"</span>":"")+"</h3>";',
  ' h+=kv("id",n.id)+kv("depth",n.depth)+kv("children",(n.children||[]).length);',
  ' var pk=Object.keys(n.props||{});',
  ' h+="<h4>Props</h4>"+(pk.length?pk.map(function(k){return kv(k,n.props[k]);}).join(""):empty("none"));',
  ' h+="<h4>Event types</h4>"+((n.eventTypes||[]).length?"<code>"+esc((n.eventTypes||[]).join(", "))+"</code>":empty("none"));',
  ' h+="<h4>State bindings</h4>"+((n.stateBindings||[]).length?"<ul class=\\"st-list\\">"+n.stateBindings.map(function(b){return "<li><code>"+esc(b)+"</code></li>";}).join("")+"</ul>":empty("none"));',
  ' return h;',
  '}',
  'function rState(){',
  ' var s=state.data.signals||{};var live=s.live||{};var ids=s.boundSignalIds||[];',
  ' var h="<p class=\\"st-dim\\">"+ids.length+" signal id(s) bound in graph. Effects are shown as observer counts (no global effect registry).</p>";',
  ' var labels=Object.keys(live);',
  ' if(!labels.length)return h+empty("No live signals registered with DevTools");',
  ' h+="<ul class=\\"st-list\\">";',
  ' for(var i=0;i<labels.length;i++){var l=labels[i];var sg=live[l];',
  '  h+="<li><code>"+esc(l)+"</code> <span class=\\"st-key\\">["+esc(sg.kind)+"]</span> = <code>"+esc(sg.value)+"</code> <span class=\\"st-dim\\">observers "+esc(sg.observerCount==null?"?":sg.observerCount)+"</span></li>";}',
  ' return h+"</ul>";',
  '}',
  'function rSignalGraph(){',
  ' var g=state.data.signalGraph||{signals:[],edges:[]};',
  ' if(!(g.signals||[]).length)return empty("No signal bindings in graph");',
  ' var h="<p class=\\"st-dim\\">"+g.signals.length+" signal(s), "+(g.edges||[]).length+" binding edge(s)</p><ul class=\\"st-list\\">";',
  ' for(var i=0;i<g.signals.length;i++){var sn=g.signals[i];',
  '  h+="<li><code>"+esc(sn.signalId)+"</code> <span class=\\"st-dim\\">&rarr; "+(sn.boundNodeIds||[]).length+" node(s), "+sn.bindingCount+" edge(s)</span>"',
  '   +(sn.kind?" <span class=\\"st-key\\">["+esc(sn.kind)+"]</span>":"")',
  '   +(sn.observerCount!=null?" <span class=\\"st-dim\\">obs "+esc(sn.observerCount)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  '}',
  'function rRouter(){',
  ' var r=state.data.router;if(!r)return empty("No router registered");',
  ' return kv("path",r.path)+kv("pattern",r.pattern)+kv("fallback",r.isFallback?"yes":"no")',
  '  +"<h4>Params</h4>"+(Object.keys(r.params||{}).length?Object.keys(r.params).map(function(k){return kv(k,r.params[k]);}).join(""):empty("none"))',
  '  +"<h4>Query</h4>"+(Object.keys(r.query||{}).length?Object.keys(r.query).map(function(k){return kv(k,r.query[k]);}).join(""):empty("none"));',
  '}',
  'function rResources(){',
  ' var rs=state.data.resources;if(!rs||!Object.keys(rs).length)return empty("No resources registered");',
  ' var ks=Object.keys(rs);var h="<ul class=\\"st-list\\">";',
  ' for(var i=0;i<ks.length;i++){var r=rs[ks[i]];',
  '  h+="<li><code>"+esc(ks[i])+"</code>: <span class=\\"st-key\\">"+esc(r.status)+"</span>"',
  '   +(r.loading?" <span class=\\"st-dim\\">(loading)</span>":"")',
  '   +(r.isRefetching?" <span class=\\"st-dim\\">(refetching)</span>":"")',
  '   +(r.hasError?" <span class=\\"st-err\\">!"+esc(r.errorName)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  '}',
  'function rMutations(){',
  ' var ms=state.data.mutations;if(!ms||!Object.keys(ms).length)return empty("No mutations registered");',
  ' var ks=Object.keys(ms);var h="<ul class=\\"st-list\\">";',
  ' for(var i=0;i<ks.length;i++){var m=ms[ks[i]];',
  '  h+="<li><code>"+esc(ks[i])+"</code>: <span class=\\"st-key\\">"+esc(m.status)+"</span>"',
  '   +(m.pending?" <span class=\\"st-dim\\">(pending)</span>":"")',
  '   +(m.hasError?" <span class=\\"st-err\\">!"+esc(m.errorName)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  '}',
  'function rEvents(){',
  ' var e=state.data.events||{nodes:[],totalHandlers:0,byType:{}};',
  ' var bt=e.byType||{};var bk=Object.keys(bt);',
  ' var h="<p class=\\"st-dim\\">"+(e.nodes||[]).length+" node(s), "+e.totalHandlers+" handler(s)</p>";',
  ' h+=bk.length?"<p>"+bk.map(function(t){return "<span class=\\"st-badge\\">"+esc(t)+" &times;"+bt[t]+"</span>";}).join(" ")+"</p>":"";',
  ' if(!(e.nodes||[]).length)return h+empty("No event handlers wired");',
  ' h+="<ul class=\\"st-list\\">";',
  ' for(var i=0;i<e.nodes.length;i++){var n=e.nodes[i];',
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(n.id)+"\\"><code>&lt;"+esc(n.nodeType)+"&gt;</code>"',
  '   +(n.key!=null?" <span class=\\"st-key\\">#"+esc(n.key)+"</span>":"")',
  '   +" <span class=\\"st-dim\\">"+esc((n.eventTypes||[]).join(", "))+"</span></li>";}',
  ' return h+"</ul>";',
  '}',
  'function rOverlays(){',
  ' var os=state.data.overlays||[];if(!os.length)return empty("No overlays wired");',
  ' var h="<ul class=\\"st-list\\">";',
  ' for(var i=0;i<os.length;i++){var o=os[i];',
  '  var kind=o.modal?"modal":(o.menu?"menu":(o.takesFocus?"focusable":"non-modal"));',
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(o.id)+"\\"><code>"+esc(o.key||o.id)+"</code> <span class=\\"st-key\\">["+kind+"]</span> <span class=\\"st-dim\\">"+(o.open?"open":"closed")+(o.closeOnEscape?" \\u00b7 esc":"")+(o.restoreFocus?" \\u00b7 restore":"")+"</span></li>";}',
  ' return h+"</ul>";',
  '}',
  'function rPerformance(){',
  ' var p=state.data.performance||{snapshot:{},diagnostics:[]};var snap=p.snapshot||{};',
  ' var h="<p class=\\"st-warn\\">Structural counts, not wall-clock timings. A real render/interaction timeline needs a browser (gate BLOCKED); no timings are fabricated here.</p>";',
  ' var sk=Object.keys(snap);',
  ' h+="<h4>Graph metrics</h4>"+(sk.length?sk.map(function(k){return kv(k,snap[k]);}).join(""):empty("none"));',
  ' var d=p.diagnostics||[];',
  ' h+="<h4>Diagnostics ("+d.length+")</h4>"+(d.length?"<ul class=\\"st-list\\">"+d.map(function(x){return "<li><code>"+esc(x.code)+"</code>: "+esc(x.message)+"</li>";}).join("")+"</ul>":empty("none"));',
  ' return h;',
  '}',
  'function rDiagnostics(){',
  ' var d=state.data.diagnostics||{errors:0,warnings:0,messages:[]};',
  ' var h="<p class=\\"st-dim\\">"+d.errors+" error(s) \\u00b7 "+d.warnings+" warning(s) (compiler findings)</p>";',
  ' var m=d.messages||[];',
  ' return h+(m.length?"<ul class=\\"st-list\\">"+m.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+"</ul>":empty("No diagnostics"));',
  '}',
  'function rHydration(){',
  ' var h2=state.data.hydration;if(!h2)return empty("No hydration inspection");',
  ' var pct=(h2.staticRatio*100).toFixed(1);',
  ' var h="<p class=\\"st-warn\\">Structural static-vs-dynamic split only \\u2014 NOT wall-clock SSR/hydration timing (browser gate BLOCKED).</p>";',
  ' h+=kv("total nodes",h2.totalNodes)+kv("static nodes",h2.staticNodes+" ("+pct+"%)")+kv("dynamic nodes",h2.dynamicNodes)',
  '  +kv("static subtrees",h2.staticSubtrees)+kv("dynamic text",h2.dynamicTextNodes)+kv("dynamic attrs",h2.dynamicAttrNodes)',
  '  +kv("event nodes",h2.eventNodes)+kv("lists",h2.lists)+kv("conditionals",h2.conditionals)+kv("portals",h2.portals)+kv("head anchors",h2.headAnchors);',
  ' return h;',
  '}',
  'var RENDERERS={components:rComponents,inspector:rInspector,state:rState,signalGraph:rSignalGraph,router:rRouter,resources:rResources,mutations:rMutations,events:rEvents,overlays:rOverlays,performance:rPerformance,diagnostics:rDiagnostics,hydration:rHydration};',
  'function renderTab(){var el=document.getElementById("st-panel");if(!el)return;var fn=RENDERERS[state.tab]||function(){return empty("Unknown panel");};',
  ' el.innerHTML=fn();',
  ' var rows=el.querySelectorAll(".st-click");',
  ' for(var i=0;i<rows.length;i++){(function(row){row.addEventListener("click",function(){var id=row.getAttribute("data-node");if(id){state.selected=id;selectTab("inspector");}});})(rows[i]);}',
  '}',
  'function selectTab(id){state.tab=id;var tabs=document.querySelectorAll(".st-tab");for(var i=0;i<tabs.length;i++){var t=tabs[i];t.setAttribute("aria-selected",t.getAttribute("data-tab")===id?"true":"false");}renderTab();}',
  'function selectComponent(id){state.selected=id;selectTab("inspector");}',
  'function refresh(){var hook=window.__STREETUI_DEVTOOLS_REFRESH__;if(typeof hook!=="function")return false;var next=hook();if(next&&typeof next==="object"){state.data=next;renderTab();return true;}return false;}',
  'function bind(){',
  ' var tabs=document.querySelectorAll(".st-tab");',
  ' for(var i=0;i<tabs.length;i++){(function(t){t.addEventListener("click",function(){selectTab(t.getAttribute("data-tab"));});})(tabs[i]);}',
  ' var rb=document.getElementById("st-refresh");if(rb)rb.addEventListener("click",refresh);',
  '}',
  'window.__StreetUIDevTools={get data(){return state.data;},get tab(){return state.tab;},get selected(){return state.selected;},selectTab:selectTab,selectComponent:selectComponent,refresh:refresh,render:renderTab};',
  'bind();renderTab();',
  '})();',
].join('\n');

/** Minimal, self-contained styling. Inlined so the document needs no assets. */
const INTERACTIVE_CSS = [
  '*{box-sizing:border-box}',
  '.st-dt{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;color:#e6e6e6;background:#1e1e28;display:flex;flex-direction:column;min-height:100vh}',
  '.st-top{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #333;background:#15151c}',
  '.st-top h1{font-size:14px;margin:0}',
  '.st-refresh{font:inherit;color:#e6e6e6;background:#2c2c3a;border:1px solid #3a3a4a;border-radius:5px;padding:4px 10px;cursor:pointer}',
  '.st-refresh:hover{background:#37374a}',
  '.st-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:6px 10px;border-bottom:1px solid #2c2c38;background:#191922}',
  '.st-tab{font:inherit;color:#b8b8c8;background:transparent;border:0;border-radius:5px;padding:5px 10px;cursor:pointer}',
  '.st-tab:hover{background:#26263200}',
  '.st-tab[aria-selected="true"]{background:#2f2f40;color:#fff}',
  '.st-body{flex:1;padding:12px 16px;overflow:auto}',
  '.st-body h3{font-size:13px;margin:2px 0 8px}.st-body h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a9aae;margin:14px 0 4px}',
  '.st-list{list-style:none;margin:0;padding:0}.st-list li{padding:2px 0}',
  '.st-row{display:flex;align-items:center;gap:6px}.st-click{cursor:pointer;border-radius:4px;padding:2px 4px}.st-click:hover{background:#26263a}',
  '.st-ind{display:inline-block;width:calc(var(--d,0)*12px)}',
  '.st-kv{display:flex;gap:10px;padding:1px 0}.st-k{color:#9a9aae;min-width:120px}.st-v{color:#d7d7e0;word-break:break-all}',
  '.st-badge{display:inline-block;background:#2c2c3a;border-radius:10px;padding:1px 8px;font-size:11px}',
  '.st-foot{padding:6px 16px;border-top:1px solid #2c2c38;background:#15151c}',
  '.st-dim{color:#8a8a9a}.st-key{color:#7db4ff}.st-err{color:#ff8a8a}.st-empty{color:#6a6a7a}.st-warn{color:#ffce8a;margin:0 0 10px}',
  'code{color:#d7d7e0}',
].join('');

