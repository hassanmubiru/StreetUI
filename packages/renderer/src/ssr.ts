/**
 * Server-side rendering — `renderToString`.
 *
 * Runs the *exact same* mount pipeline used in the browser (`mountGraph`), but
 * against a `ServerDOMAdapter` that builds a lightweight in-memory node tree
 * instead of a real browser DOM. The tree is then serialized to a normal HTML
 * string. Because both browser and server share the DSL → Compiler → Graph →
 * Runtime → Renderer pipeline, there is no second, SSR-specific renderer and no
 * virtual DOM.
 *
 * Lifecycle (v0.4 rule #20): the initial synchronous mount may open signal
 * subscriptions (via `wireSignalBindings`/`wireReactiveList`). On the server
 * those would be live forever, so once the HTML is serialized we dispose the
 * root instance — tearing down every subscription and listener. SSR therefore
 * has a *render* lifecycle only; the live *runtime* lifecycle is established
 * later on the client by `hydrate`.
 */

import { ServerDOMAdapter } from '@streetui/dom';
import type { CompiledApplication } from '@streetui/compiler';
import { createRenderContext } from './render-context.js';
import { mountGraph } from './mount.js';
import { getStaticSSRPlan } from './static-ssr-plan.js';

export interface RenderToStringOptions {
  /**
   * Override the server DOM adapter (rarely needed). Defaults to a fresh
   * `ServerDOMAdapter` per call so concurrent renders never share state.
   */
  readonly domAdapter?: ServerDOMAdapter;
  /**
   * @internal — testing/benchmark knob for the v1.7 static SSR plan.
   *
   * `undefined` (default): use the per-app cached plan (build once, reuse).
   * `null`: disable the plan entirely — the exact v1.6 runtime mount path, used
   *   by the byte-identity gate and A/B benchmark as the "legacy" baseline.
   * a map: use this explicit plan.
   *
   * Not part of the supported public API; output is byte-identical regardless
   * of this value (§8).
   */
  readonly staticPlan?: ReadonlyMap<string, string> | null;
}

/**
 * Render a compiled StreetUI application to an HTML string.
 *
 * The returned markup contains only the application's own elements (the
 * synthetic container is not emitted), so callers embed it wherever they mount
 * on the client — e.g. inside `<div id="app">…</div>`.
 */
export function renderToString(
  compiled: CompiledApplication,
  options: RenderToStringOptions = {},
): string {
  const dom = options.domAdapter ?? new ServerDOMAdapter();

  // Resolve the v1.7 static SSR plan: cached-by-default, `null` forces the v1.6
  // path, an explicit map is used as-is. Only maximal static-subtree roots are
  // collapsed; dynamic regions still mount through the runtime path (§5).
  const plan =
    options.staticPlan === null
      ? undefined
      : (options.staticPlan ?? getStaticSSRPlan(compiled));
  const staticHTML = plan !== undefined && plan.size > 0 ? plan : undefined;

  // Synthetic container — the application root maps onto it, and the app's
  // top-level nodes are appended directly into it (mirroring browser mount).
  const container = dom.createElement('div');

  const ctx = createRenderContext(dom, compiled.graph, container, undefined, staticHTML);
  const rootInstance = mountGraph(ctx);

  const html = dom.serializeInner(container);

  // Tear down any subscriptions/listeners opened during mount — the server has
  // no live runtime. (rule #20)
  rootInstance.dispose();
  ctx.instances.clear();

  return html;
}
