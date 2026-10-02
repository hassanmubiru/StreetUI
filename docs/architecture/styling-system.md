# StreetUI Unified Styling System — Architecture & Design

**Status:** DESIGN (§1 gate — no implementation until this document is internally
consistent with the existing architecture).
**Target milestone:** 2.7.0 — Unified Styling System.
**Baseline this design is written against:** `streetui@2.6.0`, verified green on
2026-10-02 (build 30/30, typecheck 48/48, test 48/48 tasks, website 58/58, SSR
byte-identity PASS on all 5 representative routes == v1.6 digests).

---

## 0. Why this document exists

The mission's §1 is a hard gate: *"Do not immediately start adding style
properties."* Before any `style()` API ships, the styling model must be shown to
ride the **existing** pipeline

```
Semantic TypeScript DSL → Compiler → Semantic Application Graph → Runtime → Direct DOM Renderer
```

and introduce **none** of the forbidden things: no React/Vue/Svelte/Solid, no
virtual DOM, no CSS-in-JS *runtime* dependency, no second reactive system, no
second renderer, no runtime style-reconciliation framework, no Tailwind-style or
utility-class framework as the primary architecture, no multiple competing public
styling APIs, and no additional required `@streetui/*` install for consumers. The
public experience stays `npm install streetui` with the styling API exported from
the single existing `streetui` barrel. Internal modular source organization is
allowed.

This document answers the 18 required design questions (§1) grounded in the real
code that was inspected, then states the compile-time/runtime split, the data
flow, and the invariants the implementation must preserve.

---

## 1. The code this design is built on (verified, not assumed)

Every claim below was read from the 2.6.0 tree during the §0 inspection.

### 1.1 Where visual properties already live — the graph node

`packages/graph/src/graph-node.ts`:

```ts
export type PropValue =
  | string | number | boolean | null | undefined
  | string[] | number[] | Record<string, unknown>;
export type Props = Record<string, PropValue>;
export interface StateRef { readonly signalId: string; readonly propKey: string; }
```

A `GraphNode` holds `props` (a plain bag), `events`, `stateRefs` (reactive
bindings: a `signalId` wired to a `propKey`), `children`, `parent`. `class` is
already a `props` string; `style` is already a `props` object. **No new node
field is required** — a style is still just data on `props`, plus (for the
reactive case) a `StateRef`.

### 1.2 How a prop becomes reactive — the single binding seam

`packages/dsl/src/builders.ts`:

```ts
function bindValue<T>(graph, node, propKey, value: Bindable<T>): T {
  if (isSignal(value)) {
    const signalId = `${node.id}:${propKey}`;
    node.stateRefs.push({ signalId, propKey });
    graph.registerHandler(`__signal__${signalId}`, value as () => unknown);
    return (value as ReadonlySignal<T>).peek();          // current value, no subscription at build time
  }
  return value as T;                                      // STATIC: no stateRef, nothing registered
}
```

This one function is the whole story for §3 vs §4: a **static** value produces no
`stateRef` and registers nothing; a **signal** value produces exactly one
`stateRef` for exactly one `propKey`. The styling system reuses this verbatim —
it does not invent a parallel binding mechanism.

### 1.3 How a prop reaches the DOM — the single application seam

`packages/renderer/src/attributes.ts` → `applyProp`:

```ts
if (name === 'class' || name === 'className') { dom.setAttribute(element, 'class', String(value ?? '')); return; }
if (name === 'style' && typeof value === 'object' && value !== null) {
  const el = element as HTMLElement;
  for (const [k, v] of Object.entries(value as Record<string,string>)) el.style.setProperty(k, v);
  return;
}
```

`patchProp` early-returns on `Object.is(oldValue, newValue)` before calling
`applyProp`. So updates are already minimal-by-identity (§13).

### 1.4 How a reactive prop updates — `wireSignalBindings`

`packages/renderer/src/mount.ts`: per-node `*Update` factories return an
`onUpdate(propKey, value)`. `wireSignalBindings` **early-returns when
`stateRefs` is empty** (static nodes open no subscription — §3/§17), otherwise it
`subscribe()`s the registry signal `__signal__<id>` and calls `onUpdate`, routing
non-special props through `applyProp`. The returned unsubscribe is tracked on the
node instance and disposed on unmount — the existing leak-free cleanup path.

### 1.5 Signals — `packages/state/src/signal.ts`

`Signal.subscribe(fn)` returns an unsubscribe that deletes the subscriber;
`peek()` reads **without** registering a dependency; `observerCount` exists for
DevTools. A style that reads `peek()` at build time and `subscribe()`s at wire
time creates exactly one observer per reactive style value.

### 1.6 SSR + head serialization — the CSS-to-document seam

`packages/renderer/src/ssr.ts`: `renderToString` runs the **same** mount against
`ServerDOMAdapter`, serializes, then disposes the root instance (no live runtime
on the server). `packages/renderer/src/head.ts`: `renderHead(compiled)` walks the
graph for `head` nodes, builds a `Map<dedupKey, ResolvedTag>` (last-in wins),
serializes each tag with `data-streetui-head` + `data-streetui-head-key`, and
**returns `''` when nothing is declared** (so apps that add nothing change no
bytes). `HeadManager._adoptServerTags()` seeds client state from the server
`[data-streetui-head-key]` tags instead of recreating them. **This is the exact
pattern the CSS registry reuses** (§15–17): collect → dedup by stable key →
serialize one block → adopt on hydrate → emit nothing when empty.

### 1.7 Transition engine — must integrate, not compete

`packages/renderer/src/transition.ts`: a CSS-class engine (`__transition__`
handler, `ResolvedTransitionLike`, `getResolvedTransition`,
`TransitionController`, enter/leave phases). It toggles classes and defers
leave-removal. Styling must only *emit/toggle classes and custom properties*; it
must never add/remove DOM or run timers (§14/§18).

### 1.8 Theme today — `examples/streetui-website/src/theme.ts`

Theme is ordinary app state: a `signal<ThemeChoice>`, a `derived` resolved theme,
and an `effect` that writes `data-theme` onto `<html>` (guarded so SSR is a
no-op; the server renders the default theme and the client applies the stored
choice post-hydration — a legitimate update outside the hydrated container, not a
mismatch). Dark mode is therefore a **single root attribute flip**, which is the
hook §6/§7/§16 build on.

### 1.9 The website's current CSS footprint — a blank slate (critical finding)

The dogfooding site (`examples/streetui-website`) ships **zero `.css` files,
zero `class:` usages, and the framework ships no stylesheet** (confirmed in
`scripts/bundle-sizes.mjs`: *"the framework ships NO stylesheet"*). The site is
semantically correct but visually bare — browser defaults only. **Consequence for
§25:** there is nothing to migrate *from* — no CSS Modules, no third-party CSS, no
CSS-in-JS to classify. The 2.7 styling system is purely **additive**; it gives
the website its first real styling rather than replacing an existing system. This
removes a whole category of migration risk and makes the SSR byte-identity story
clean: routes that declare no styles still emit nothing.

## 2. The core model in one paragraph

A **StreetUI style** is a declarative, token-aware style description written in
TypeScript. The **compiler** reduces each style to a *canonical, order-independent
representation*, hashes it to a **stable class identity** (e.g. `s-1a2b3c`),
registers the corresponding CSS rule text once in a **dedup registry**, and bakes
the class name onto the node's existing `class` prop. **Static** declarations are
fully resolved at compile time and carry *no* signal, stateRef, subscription, or
effect. **Reactive** values do not churn classes or rebuild DOM: a reactive scalar
becomes a **CSS custom property** whose rule is static (deduped) and whose
*variable* is updated by a signal through the existing `stateRef` → `applyProp`
→ `el.style.setProperty('--x', v)` path (one signal → one property); a reactive
**variant/state** selection drives a single `class`/`data-*` attribute swap.
Responsive, pseudo, variant, and theme concerns are expressed as **CSS rules**
(media queries, `:hover`, variant classes, `var()` under `:root`/`[data-theme]`),
never as JS listeners or a runtime reconciler. The whole registry serializes to a
single `<style data-streetui-css>` block in the document head (reusing the
`renderHead` pattern), is adopted on hydration, and emits nothing when empty.

That paragraph is the entire architecture. Everything below is the detail that
makes it true against the real code in §1.

---

## 3. The 18 required design questions (§1)

### Q1 — What *is* a StreetUI style, conceptually?

A pure, serializable description of appearance: a set of CSS property/value pairs
(values may be literals or **token references**), optionally grouped by
**responsive breakpoint**, **pseudo state**, and **component state**, optionally
parameterized as **variants**. It is *data*, not behavior — it compiles to CSS
rules + a class identity. It is never a live object that mutates the DOM imperatively.

### Q2 — Where is a style represented in the Semantic Application Graph?

Nowhere new. A resolved style contributes:
- a **class token** appended to the node's existing `props.class` (static case), and/or
- a **`StateRef`** (reactive case) binding a signal to either a custom-property
  prop (`--s-*` via the `style` prop) or the `class`/`data-state-*` prop.

The registry of CSS rule *text* lives beside the compiled application (a
compile-artifact map keyed by identity), **not** on individual nodes — so nodes
stay small and unmounting a node never strands a rule (§17/§18).

### Q3 — When is a style resolved?

Canonicalization, hashing, rule-text generation, static class assignment, variant
expansion, responsive/pseudo rule emission, and token→`var()` rewriting all happen
at **compile time** (compiler transform pass over the graph). At **runtime** only
three things happen: (a) the registry is serialized to head (SSR) / adopted
(client); (b) reactive custom properties update on signal change; (c) reactive
variant/state selections swap one attribute. There is **no runtime
canonicalization of static styles** and **no runtime style reconciler**.

### Q4 — Compile-time vs runtime split (explicit)

| Concern | Compile time | Runtime |
|---|---|---|
| Canonical form + identity hash | ✅ | — |
| CSS rule text (base, responsive, pseudo, variants) | ✅ | — |
| Token → `var(--token)` rewrite | ✅ | — |
| Static class baked into `props.class` | ✅ | — |
| Registry → `<style>` in head | serialize list prepared at compile | emitted by SSR / adopted on hydrate |
| Reactive scalar → `--s-*` custom property update | binding declared | `setProperty` on signal change |
| Reactive variant/state → class/`data-*` swap | binding declared | one `setAttribute` on signal change |
| Theme switch | token rules precompiled for both themes | `data-theme` attribute flip only |

### Q5 — Static styles must create **no** reactive subscriptions

Guaranteed by `bindValue`: a non-signal style value never pushes a `stateRef` and
never registers a `__signal__` handler, and `wireSignalBindings` early-returns for
nodes with empty `stateRefs`. A statically-styled node is therefore identical, at
runtime, to any other static node — it carries a `class` attribute and opens zero
observers. No effect is created for appearance.

### Q6 — Reactive styles (signal → single property, no reconstruction)

A reactive scalar style value is a signal, e.g. `style({ width: widthSignal })`.
The compiler emits a **static** rule `.s-xxx { width: var(--s-width); }` and
rewrites the node so that:
- the base class `s-xxx` is static (deduped, never changes), and
- the custom property `--s-width` is a reactive `style` prop bound via `bindValue`
  (one `StateRef { propKey: 'style.--s-width' }`).

On signal change, `wireSignalBindings` → `onUpdate` → `applyProp` does exactly one
`el.style.setProperty('--s-width', v)`. The CSS rule, the class, and every other
property are untouched; no node is created or replaced; `patchProp`'s `Object.is`
guard already skips no-op writes. **One signal change updates exactly one custom
property on exactly one element.** Update independence is verified by browser
tests in §4/§29 (reuses the existing `update-independence.test.ts` harness).

A reactive *selection* among precompiled appearances (e.g. a size that switches
between variant classes) is instead a reactive `class`/`data-state-*` prop — again
one `StateRef`, one `setAttribute` on change, all candidate rules precompiled and
deduped. Either way: no DOM reconstruction, no second reactive system.

### Q7 — Responsive styles

`style({ padding: { base: 8, md: 16, lg: 24 } })` compiles to:

```css
.s-xxx { padding: 8px; }
@media (min-width: 768px) { .s-xxx { padding: 16px; } }
@media (min-width: 1024px) { .s-xxx { padding: 24px; } }
```

Breakpoints come from design tokens (Q9). **No resize listeners, no per-element
width signal, no JS layout engine** — the browser evaluates the media queries. The
breakpoint keys (`base|sm|md|lg|xl`) are a fixed, type-checked union (Q10/§23).

### Q8 — Pseudo states

`:hover | :focus | :focus-visible | :active | :disabled | :checked` compile to CSS
pseudo-selectors on the style's class:

```css
.s-xxx:hover { background: var(--accent-primary); }
.s-xxx:focus-visible { box-shadow: 0 0 0 2px var(--focus-ring); }
```

No JS event listeners are attached for pseudo states — these are intrinsic CSS
states the browser owns. This keeps hover/focus correct during SSR-first paint and
costs zero runtime.

### Q9 — Design tokens

`createThemeTokens({...})` declares colors, spacing, typography (families, sizes,
weights, line-heights), radii, borders, shadows, z-index, durations, easings, and
breakpoints. Each token compiles to a **CSS custom property** emitted once under
`:root`, with dark overrides under `[data-theme="dark"]`:

```css
:root { --space-4: 16px; --color-accent: #4f46e5; --focus-ring: #6366f1; }
[data-theme="dark"] { --color-accent: #818cf8; }
```

Token references inside styles compile to `var(--token)`. Tokens are
**SSR/hydration safe** (the token `<style>` is server-rendered into head and
adopted on the client) and **deterministic** (stable ordering → stable bytes).
Reactive theme switching is just the `data-theme` flip from §1.8 — the variables
re-resolve with no restyle work and no duplicate rules. Breakpoints feed Q7.

### Q10 — Variants (type-safe, no runtime dep)

```ts
const button = styleVariants({
  base: { /* shared */ },
  variants: {
    intent: { primary: {...}, danger: {...} },
    size:   { sm: {...}, lg: {...} },
  },
  defaultVariants: { intent: 'primary', size: 'sm' },
});
```

Each `variant.value` compiles to its own class identity; `button({ intent:
'danger' })` returns the deduped class list for `base + danger-class + size-class`.
Variant keys and values are a **mapped type**, so an invalid key, an invalid
value, or a missing required variant **fails TypeScript** (§23) — no stringly-typed
names. The returned value is a plain class string, so it is fully
**tree-shakeable** and carries **no runtime dependency**; unused variants that are
never referenced are dropped. Reactive variant selection is Q6's attribute-swap
path.

### Q11 — SSR serialization

The compile-time registry is an ordered, deduped map `identity → ruleText`
(tokens first, then base rules, then responsive `@media`, then pseudo, then
variants — a fixed canonical order). SSR serializes it to **one**
`<style data-streetui-css>…</style>` block injected into the document head,
mirroring `renderHead`:
- deterministic ordering → identical bytes across runs;
- **empty registry → emit nothing** (exactly like `renderHead` returning `''`),
  so routes that declare no styles are byte-for-byte unchanged;
- a `data-streetui-css` marker (and per-rule identity recorded in the block) so
  the client can adopt rather than regenerate.

The block is emitted alongside `renderHead` output, so the existing SSR pipeline
(`renderToString` + the host HTML template that already injects `head`) needs one
additional injection point, not a new renderer.

### Q12 — Hydration adoption

On the client, before mounting, the runtime reads the server
`<style data-streetui-css>` block, seeds the registry's "already-present" set from
the identities it declares, and **adopts** the element (does not recreate it) —
the same strategy `HeadManager._adoptServerTags()` uses for head tags. Result: no
duplicate `<style>`, no re-generation of rules the server already shipped, and no
DOM replacement of styled nodes (their `class` attributes already match what the
compiler baked in). Post-hydration theme switching works because it only flips
`data-theme`; the token variables are already present in the adopted block.

### Q13 — Minimal-mutation updates

Three structural facts make updates minimal without any new machinery:
1. Static appearance is a `class` set at mount and never touched again.
2. Reactive scalars are CSS custom properties → a change is one `setProperty`.
3. `patchProp` already early-returns on `Object.is(old, new)`, so redundant signal
   emissions cost nothing.

No class-list diffing, no style-object diffing, no node replacement for a style
change. This is strictly a subset of the mutations the renderer already performs.

### Q14 — Interaction with the transition engine

Clean separation of ownership, no competition:
- **Styling** owns *static appearance* (classes) and *reactive values* (custom
  properties). It emits classes/vars only.
- **Transition engine** owns the *enter/leave lifecycle* (`__transition__`,
  `TransitionController`) — it toggles its own enter/leave classes and defers DOM
  removal.

A styled, transitioning element simply carries both its style class (`s-xxx`) and
the transition's enter/leave classes; they are different identities and never
collide. Styling never adds/removes DOM and runs no timers, so the transition
engine remains the single source of lifecycle timing (§18).

### Q15 — Interaction with accessibility state

A11y state already surfaces as ARIA attributes via `applyA11yProps`
(`aria-expanded`, `aria-invalid`, `aria-selected`, `aria-current`, `aria-busy`,
…) and native states (`:disabled`, `:focus-visible`, `:checked`). The styling
system **reads these existing attributes** from CSS:

```css
.s-xxx:focus-visible { box-shadow: 0 0 0 2px var(--focus-ring); }
.s-xxx[aria-invalid="true"] { border-color: var(--danger-border); }
.s-xxx[aria-expanded="true"] .chevron { transform: rotate(180deg); }
.s-xxx:disabled { opacity: .5; cursor: not-allowed; }
```

It introduces **no parallel a11y-state system**; a strong default `focus.ring`
token guarantees a visible, keyboard-usable focus indicator by default (§19).

### Q16 — Interaction with the theme system

Theme is CSS variables + a root `data-theme` attribute (the existing website
mechanism, promoted to the framework). A token has one definition; dark mode is a
**re-pointing** of the same variables under `[data-theme="dark"]`, never a
duplicated style object. Switching theme touches exactly one attribute on `<html>`
and triggers no restyle work in StreetUI itself — the browser recomputes `var()`
resolution. SSR renders the default theme; the client applies the stored choice
after hydration (outside the hydrated container → not a mismatch).

### Q17 — Memory-leak avoidance

- Static styles open **no** subscriptions (Q5), so there is nothing to leak.
- Reactive styles reuse `stateRefs`; the per-node unsubscribe is already tracked
  on the node instance and disposed on unmount (`wireSignalBindings` cleanup) — the
  same path the framework has shipped since v0.4 rule #20.
- The CSS registry is keyed by **style identity**, never by node or element, and
  holds only bounded rule-text strings (one per distinct style in the app). It is
  **never** a `WeakMap`/`Map` of live nodes, so unmounting nodes frees normally and
  the registry size is bounded by *source* diversity, not instance count.

### Q18 — Style-duplication avoidance

Identical style descriptions → identical canonical form → identical hash → a
single registry entry → a single CSS rule, shared by every node via its class.
10,000 nodes with the same style produce **one** rule and **one** class token.
Variants and responsive/pseudo blocks are deduped by the same identity mechanism.
This is the §15/§29 guarantee and is verified by the perf scenarios (10k
shared-style nodes → constant CSS size).

---

## 4. End-to-end data flow

```
Author:   style({ padding:{base:8,md:16}, ':hover':{bg: tokens.accent}, width: widthSignal })
             │
Compiler:  canonicalize ──► identity "s-1a2b3c"
             ├─ static props  → props.class += "s-1a2b3c"
             ├─ rule text     → registry["s-1a2b3c"] = ".s-1a2b3c{padding:8px;width:var(--s-width)}
             │                   @media(min-width:768px){.s-1a2b3c{padding:16px}}
             │                   .s-1a2b3c:hover{background:var(--color-accent)}"
             └─ reactive var  → props.style["--s-width"] = widthSignal  → bindValue → StateRef
             │
Graph:     node.props.class="s-1a2b3c"; node.stateRefs=[{propKey:"style.--s-width"}]
             │
SSR:       renderToString ─► serialize registry ─► <style data-streetui-css>…</style> in head
             │                 (empty registry ⇒ no block ⇒ byte-identical)
Client:    hydrate ─► adopt <style data-streetui-css> (no duplicate) ─► wireSignalBindings
             │                 subscribes widthSignal
Runtime:   widthSignal.set(240) ─► onUpdate("style.--s-width",240) ─► el.style.setProperty("--s-width","240px")
                                     (one property, one element, no reflow of rules)
```

Every box above is an existing mechanism. The only genuinely new code is the
compiler canonicalization/hash + rule emitter, the registry, and one SSR head
injection + one hydration adoption call.

---

## 5. Precedence model (§5 — deterministic & documented)

When multiple appearance sources target one element, later wins. Documented,
stable order (lowest → highest priority):

1. **browser defaults / global normalization CSS**
2. **theme token defaults** (`:root` custom properties)
3. **`style()` base rule** (the element's own class)
4. **variant rules** (from `styleVariants`)
5. **responsive overrides** (`@media`, by specificity of min-width)
6. **state / pseudo rules** (`:hover`, `[data-state-*]`, `[aria-*]`)
7. **author `class` / `className` escape hatch** (explicit user class)
8. **author inline `style` object** (explicit per-element override — highest)

Because 3–6 all share the same single class selector specificity, their order is
guaranteed by **source order in the emitted stylesheet** (base → variant →
responsive → state), which the registry serializes deterministically. The inline
`style` object (8) always wins because it is an element attribute. The author
`class` escape hatch (7) is preserved — the styling system *appends* its class
token rather than replacing `props.class`, so existing/user classes survive.

---

## 6. Public API surface (shape only — validated against the DSL in impl)

Exported from the single `streetui` barrel (no new required package):

```ts
export function style(def: StyleDef): StyleHandle;                 // → { class, vars? }
export function styleVariants<V>(cfg: VariantConfig<V>): VariantFn<V>;
export function createThemeTokens(def: TokenDef): ThemeTokens;     // → token refs + registry contribution
export const tokens: ThemeTokens;                                   // default semantic token set (§7)
// Layout/typography primitives (§12/§13) are thin style() presets, not new nodes:
export const layout: { container, stack, row, grid, center, spacer };
export const text:   { heading, body, label, caption, link, code, blockquote, list };
```

`StyleDef` values are typed so that invalid CSS keys, unknown tokens, unknown
responsive keys, and unknown variant names are **TypeScript errors** (§23), under
strict mode + `exactOptionalPropertyTypes`. No `any`, no `@ts-ignore`. This is a
*shape* to validate against `dsl-types.ts` during implementation — it is not final
until it compiles against the real builder types.

> **§2 note:** the conceptual `style({...})` example in the mission is honored in
> spirit; the exact signature must be reconciled with the existing `ContentOptions`
> / `ContainerOptions` / `A11yOptions` shapes in `dsl-types.ts` so a style attaches
> through the *same* options bag the builders already accept, rather than a bolt-on.

---

## 7. What this design explicitly does NOT add (guardrail checklist)

| Forbidden | Avoided because |
|---|---|
| React/Vue/Svelte/Solid / virtual DOM | compiles to CSS + the existing graph/renderer; no vdom introduced |
| CSS-in-JS *runtime* dependency | all canonicalization is compile-time; runtime only sets custom props/attrs |
| Second reactive system | reuses `signal`/`stateRefs`/`wireSignalBindings` verbatim |
| Second renderer | reuses `attributes.ts applyProp` + `renderToString` |
| Runtime style-reconciliation framework | no runtime diff of styles; classes are static, vars are 1:1 |
| Tailwind / utility-class framework as primary architecture | primary API is semantic `style()`/tokens/variants, not utility classes |
| Multiple competing public styling APIs | one model: `style` + `styleVariants` + tokens |
| Extra required `@streetui/*` install | exported from the single `streetui` barrel |

---

## 8. Open risks / to resolve during implementation (not blockers to the design)

1. **Canonical hash stability across builds** — the identity must be a pure
   function of the normalized style (sorted keys, normalized units/colors) so SSR
   and client agree. Needs a documented normalization spec + a golden test.
2. **SSR byte-identity baseline update** — adding styles to a route *intentionally*
   changes its bytes. Per §16, this requires a **documented** baseline update, not
   a silent one. Unstyled routes must stay byte-identical (the empty-registry
   guarantee makes this automatic until migration begins).
3. **Where the head injection lives** — `renderHead` is called by the host template
   (`server-entry.ts`), not inside `renderToString`. The CSS block injection must
   be exposed the same way (a `renderStyles(compiled)` companion to `renderHead`)
   so SSR output composition stays explicit and testable.
4. **Reactive custom-property units** — a numeric signal (`240`) must serialize to
   a valid CSS value (`240px`) deterministically; the property's expected unit is
   known at compile time from the CSS key, so the `onUpdate` can format it.

---

## 9. Design acceptance (the §1 gate)

This design is **internally consistent with the existing architecture**: it adds
no forbidden subsystem, introduces no new graph node type, no second reactive
system, and no second renderer; it rides `props`/`stateRefs`/`bindValue`/
`applyProp`/`wireSignalBindings`/`renderHead`/`HeadManager`/the transition engine;
and it preserves SSR byte-identity for unstyled output by construction. The 18
questions are answered above with reference to real code.

**Implementation may proceed** to §2–§22 (tasks #35–#37) in dependency order,
starting with the compiler canonicalization + registry + token layer (§2–§7),
then CSS generation/SSR/hydration + responsive/pseudo/variants (§8–§11, §15–§17),
then layout/typography/code + transition/a11y/form/overlay/animation (§12–§14,
§18–§22). No implementation task may weaken a test, remove a regression case, or
update an SSR baseline without an explicit, documented reason (§32).





