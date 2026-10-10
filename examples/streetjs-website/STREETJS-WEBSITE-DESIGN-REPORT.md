# StreetJS Website — Design Report

**Date:** 2026-10-10
**Scope:** Premium visual redesign of `examples/streetjs-website/`, built entirely on StreetUI 3.0.0.
**Constraint honoured:** no StreetUI source modified; no React/Vue/other renderer; no external CSS
framework; no new dependencies. Routing, SSR, hydration, SEO and the real (recorded v1.2.8) content
are preserved.

---

## 1. What was wrong before (observed, not assumed)

I built and rendered the pre-redesign site and inspected the actual pages (home and docs) plus every
route's SSR HTML and the generated stylesheet. Concrete issues:

1. **Flat, template-generated feel.** The homepage was the exact pattern a premium brief should avoid:
   an h1, a lead, three buttons, then one uniform card grid repeated down the page. No code was shown,
   no architectural story, no hierarchy. "Do not simply center a heading above three cards" — it did.
2. **No code presentation.** Code blocks were bare `<pre>` surfaces with a tiny label, no window
   chrome, no filename, no copy affordance, and no syntax colour — a miss for a developer framework.
3. **Off-brief accent.** The accent was the framework-default indigo/purple (`#4f46e5`), not the
   requested refined blue.
4. **One-note surfaces.** Every block was the same card: one radius, one border, the same flat charcoal.
   In dark mode the raised surface barely separated from the background, so the page read as a single
   grey sheet with no depth.
5. **Unresolved nav.** Primary links wrapped onto a second row; the search control looked like a bare
   input; the active route was signalled only by a visually-hidden "(active)" string with no visible
   state.
6. **Thin docs experience.** `/docs` was a flat card grid; `/docs/:section` had a sidebar but no active
   indicator, no table of contents, no copy-code, generic prev/next text links, and body code with no
   window treatment.
7. **Hero clipping.** The hero h1 sat flush under the sticky nav with no offset.

---

## 2. The design system (deliberate, not default)

A single design system (`src/design-system.ts`) owns every visual class. The palette is installed with
StreetUI's `createThemeTokens`, which re-points the **default semantic token variables** (`--surface-*`,
`--content-*`, `--accent-*`, `--border-*`, `--shadow-*`) for **both** light and dark. Because it
registers after the framework defaults it wins the cascade, so every framework helper (`text`, `form`,
`a11y`) and every class adopts the StreetJS palette — with **no change to StreetUI**.

**Identity — premium developer tool.**

- **Charcoal surfaces, refined blue accent.** Dark (the primary identity): background `#0a0e15`,
  raised panel `#121926`, deep code slate `#0b1120`; accent `#4c8dff` with deep-navy button text
  `#06142b`. Light: white/`#f7f9fc` surfaces, ink `#0b1a2b`, accent `#1766d6` with white button text.
- **Depth, not decoration.** Hairline borders (`--border-*`), one restrained elevation scale re-pointed
  for charcoal (shadows that are actually visible on dark), and a single subtle radial wash behind the
  hero. No gradients-as-decoration, no neon, no glow.
- **Typography.** The system sans/mono stacks (no web-font dependency) on the framework type scale, with
  a fluid hero display (`clamp(34px, 5.4vw, 54px)`), tightened display tracking (`-0.035em`), relaxed
  body line-height and a 72ch measure for prose.
- **Tokens:** colour, spacing, radius, type, borders, shadows, z-index, durations/easings and the
  responsive breakpoints all come from the token system; `src/design-system.ts` is the single source.
- **Restraint.** One accent, used for actions, links and active state only. No ALL-CAPS eyebrows
  (kickers are sentence case), no `01/02/03` numbering, no middle-dot meta strings, no `→`-suffixed
  links, no pill-badge sprawl — the generated-page tells are deliberately avoided.

Motion is user-triggered only (hover/focus/active colour and elevation transitions on the token
duration/easing). There are **no** entrance or scroll animations, which both reads as disciplined and
sidesteps the fact that the style API exposes no `prefers-reduced-motion` media query — nothing
animates unprompted, so there is nothing to suppress.

---

## 3. Homepage

A composed, varied page — not a stack of identical card grids:

- **Hero** (two-column on large screens): a sentence-case kicker, a display headline, a technically
  accurate description, primary/secondary/ghost actions, an inline `npm i streetjs` chip, and a **code
  window** showing a real, verified StreetJS controller example beside the copy.
- **Capabilities:** six real framework capabilities as lift-on-hover link cards (each linking to the
  matching docs page).
- **Request lifecycle:** a tinted full-bleed band pairing prose about the decorator→context→driver flow
  with a second code window (a real Postgres/repository example).
- **Quick start:** numbered steps beside a terminal/code window (install + the two tsconfig flags
  decorators need).
- **Sharp edges:** a callout naming the documented traps (global `rbacGuard`, no password hashing,
  5xx infrastructure leak) with links to the known-traps doc and the blog, plus the provenance notice.

Every code sample is real StreetJS usage recorded from v1.2.8; nothing invented.

---

## 4. Code presentation

A new `codeWindow` component renders a window with a title bar (traffic-light dots, filename, a
**copy-to-clipboard** button) over a deep-slate body. A small, dependency-free TypeScript highlighter
(`src/highlight.ts`) tokenizes the source into comment / keyword / string / number / type / decorator /
function / punctuation spans, each coloured from the design system. The highlighter is deterministic
(same tokens on server and client) and its concatenated token text is byte-for-byte the original source,
so SSR stays stable and the content audit is unaffected. Copy is the only browser-only behaviour and
degrades to a no-op where `navigator.clipboard` is absent.

---

## 5. Documentation experience

- **Three-column layout** on wide screens: a sticky, scrollable section sidebar; a readable 78ch article
  column; and an **"On this page" table of contents** on `xl` (shown only when a page has more than one
  section).
- **Active state** in both the sidebar and the top nav is now a filled accent chip (plus the retained
  visually-hidden "(active)" marker for assistive tech). Because the DSL `class` prop is static, the
  active/inactive forms are two mutually-exclusive `when()` branches sharing one id.
- **Prev/next** are proper cards (direction label + title), not inline text links.
- **Code** uses the same code window as the rest of the site; prose, lists (ruled items) and warnings
  (callouts) share one consistent rhythm.

The anchor offset for the TOC under the sticky nav is done with a padding/negative-margin pair on doc
headings, because the style API exposes no `scroll-margin-top`.

---

## 6. Shell, every route, responsiveness

- **Nav:** a brand lockup (accent mark + wordmark) on a single row; links collapse into a styled mobile
  menu below `lg`; search and theme controls are bordered chips. The search dialog, result rows and
  empty state are restyled on the new tokens.
- **Every route** keeps its own correct layout (reference, examples, guides, playground, plugins,
  changelog, blog, about, 404) on the shared system; missing/unverified content stays explicit (the
  About "not claimed" list, the changelog's single real entry).
- **Responsive:** fluid hero, grids that fall to one column, a real mobile menu, code windows that scroll
  horizontally rather than overflow. Focus-visible rings on every interactive element; hover/active/
  disabled states on buttons and links.

---

## 7. StreetUI untouched

No framework limitation forced a change to StreetUI. Three gaps were worked around at the app layer and
are worth noting for a future framework decision: the DSL `class` prop is static (so active nav is two
`when()` branches, not a reactive class); there is no `scroll-margin-top` (so the TOC offset uses a
padding/margin pair); and there is no `prefers-reduced-motion` channel (so no unprompted motion is used).
See the Validation Report for exactly what was executed.
