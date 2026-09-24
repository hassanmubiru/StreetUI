# Hydration

Hydration is the client step that takes over server-rendered HTML: it wires
events and reactivity onto the DOM that is already on the page instead of
recreating it. StreetUI's central hydration guarantee is that hydrating a
correctly server-rendered app creates **zero** new DOM nodes — it adopts what is
there.

## The client entry

Read the serialized state, rebuild identical deps from it, recompile the same
page, and call `renderer.hydrate` instead of `renderer.mount`:

```ts
import { createRenderer, readState, BrowserDOMAdapter } from 'streetui';

export function hydrateApp(container: Element, opts = {}): HydrateResult {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, opts.stateRoot ?? container);
  const seed = transferred[STATE_KEY] as AppSnapshot | undefined;

  const deps = createDeps(seed !== undefined ? { seed } : {});
  const compiled = compilePage(deps, opts.view ?? 'users', opts.theme);

  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, container);   // adopts existing DOM

  return { deps, unmount: () => { handle.unmount(); deps.userDetail.dispose(); } };
}
```

`readState` recovers the snapshot the server embedded with `serializeState`
(see [SSR](./ssr.md)). Rebuilding deps from that snapshot is what makes the
client's compiled graph line up node-for-node with the server markup.

## Auto-boot

A client entry typically boots itself when a mount node is present:

```ts
if (typeof document !== 'undefined') {
  const boot = () => {
    const app = document.getElementById('app');
    if (app !== null) hydrateApp(app, { stateRoot: document });
  };
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
```

## The zero-node guarantee

When the server markup and the client description agree, hydration adds no nodes:
it attaches event handlers and binds signals to the existing elements and text
nodes. The performance app measures this directly. In
[`streetui-node.json`](../benchmarks/results/v1.3/streetui-node.json) the
`hydrateUsers10k` scenario hydrates the 10,000-row users view through a counting
DOM adapter and asserts `nodesCreatedDuringHydration === 0`
(`invariant_G_zeroNodesCreated`). If hydration had to recreate the table it would
show 10,000+ created nodes; it shows zero.

The browser harness re-checks the same property with a `MutationObserver`
(`addedDuringHydration` must be 0), so the guarantee is verified in both the Node
and — when a browser is available — the real-browser path.

## Mismatches

If the client description does not match the server markup (a different tag,
missing node, or divergent text), StreetUI detects the mismatch and repairs it
rather than leaving a broken tree. Treat any mismatch as a bug in your app —
usually deps that were seeded differently on the two sides — because a repair
means you paid for SSR without getting the zero-node adoption it exists to
provide. The `renderer`'s hydration diagnostics (see
[observability.md](./observability.md)) report the three mismatch categories to
help track these down.

## What to measure

Hydration duration and time-to-first-interaction are the figures that matter on
the client. Real-browser numbers are gated through
`scripts/browser-harness.mjs`; where no Chromium is available they are recorded
BLOCKED rather than substituted with Node timings — see
[`streetui-browser.json`](../benchmarks/results/v1.3/streetui-browser.json).

This is the last guide; return to [Getting started](./getting-started.md) for the
map of the set.
