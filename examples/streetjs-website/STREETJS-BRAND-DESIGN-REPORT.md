# StreetJS Website — Brand Identity & Visual Quality Report

**Date:** 2026-10-10
**Scope:** Brand overhaul of the existing `examples/streetjs-website/`, on StreetUI 3.0.0.
**Constraints honoured:** existing project kept; no React/Vue/other renderer; no external CSS framework;
no new dependencies; routing/SSR/hydration/route SEO preserved; working search, theme and copy-code
preserved; genuine (recorded v1.2.8) content kept; **StreetUI itself not modified.**

---

## 1. The actual causes (found by inspecting the rendered output, not guessed)

Rendering the site and reading the real SSR HTML + generated stylesheet surfaced concrete root causes:

1. **`appRoot` was never applied.** The design system defined an `appRoot` style (base font, colour,
   background, min-height) but **no element ever used it** — the shell's outermost node was a bare
   `<div>`. Consequences:
   - **Serif leak (issue #2).** With no base `font-family`, every element that didn't set its own font
     inherited the document default — a serif face in many engines. Headings/buttons set sans
     explicitly, so they stayed sans while paragraphs, nav links and labels rendered serif. That is
     exactly the "some elements serif, some sans" symptom.
   - **No themed page surface.** The page background and base text colour never came from tokens.
2. **Off-brand palette (issues #1, #6).** The accent was indigo/blue-violet, not StreetJS blue, and the
   neutrals weren't the brand charcoal set — so the identity wasn't cohesive and some text read washed
   out against the surfaces it landed on.
3. **Hero glow (issue #3 adjacent).** A large radial gradient washed the hero.
4. **Double-wrapped sections (issue #3).** Home sections nested two padded containers (a `pageSection`
   *and* a hero-style wrapper), doubling horizontal and vertical padding → the large empty regions.
5. **No clear primary action / weak header (issue #5).** The nav had no emphasized Get Started action
   and the header didn't read as a deliberate brand element.

---

## 2. Brand colours and tokens (the source of truth)

The official palette is installed once with `createThemeTokens`, which re-points the default semantic
token variables for **both** themes (registering after the framework defaults, so it wins the cascade).
No colour literals are scattered across routes; every route references tokens.

| Role | Light | Dark |
|---|---|---|
| Page canvas (`surface.background`) | `#F8FAFC` | `#0B1020` |
| Raised / cards (`surface.raised`) | `#FFFFFF` | `#172235` |
| Sunken (`surface.sunken`) | `#EEF2F7` | `#111827` |
| Heading (`content.primary`) | `#0F172A` | `#F8FAFC` |
| Body (`content.secondary`) | `#334155` | `#CBD5E1` |
| Secondary (`content.muted`) | `#475569` | `#A8B5C7` |
| Border (`border.default`) | `#CBD5E1` | `#263449` |
| Accent (`accent.primary`) | `#2563EB` | `#60A5FA` |
| Accent hover | `#1D4ED8` | `#93C5FD` |
| Focus ring | `#2563EB` | `#60A5FA` |

StreetJS blue (`#2563EB`) is used for primary actions, links, active navigation and the logo mark. In
dark mode links/accents shift to `#60A5FA` (the brand's light blue) so they stay readable on charcoal —
same blue family, not a competing hue. **No purple/indigo, no orange/pink/neon.** Charcoal is the
foundation; neutrals carry the content; blue is the single accent. Code surfaces are a theme-invariant
deep slate (`#080D16` body, `#111827` title bar) because code reads best on dark.

Typography is unified by re-pointing `--font-sans` to `system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", …` and `--font-mono` to a monospace stack used **only** for code/terminal content. The type
scale is deliberate: fluid hero display (`clamp(34px, 5.4vw, 54px)`, tight tracking), page/section/card
headings, body, supporting text, navigation and code — distinct weights and line-heights, no oversized
type everywhere.

---

## 3. Changes made

- **Applied `appRoot`.** The shell now wraps all content in one `#app-root` element carrying the base
  sans font, themed colour and page background. This is the single fix that removes the serif leak and
  gives every surface its themed background. The search dialog (portalled to `<body>`, outside
  `#app-root`) sets the sans font explicitly so it inherits correctly too.
- **Adopted the brand palette** across light and dark via `createThemeTokens` (table above).
- **Charcoal brand header, both themes.** The nav is deep charcoal (`#0B1020`) in light *and* dark, with
  a blue logo mark, white wordmark, muted-slate links that brighten on hover, an active link marked with
  a blue underline, bordered search/theme/menu chips, and a prominent blue **Get started** button.
- **Hero.** Kept the two-column layout; removed the gradient glow for a flat themed surface with a single
  hairline; dark high-contrast headline; concise supporting paragraph; primary/secondary/ghost actions;
  the `npm i streetjs` chip; and the syntax-highlighted code window (filename, window controls, working
  copy button).
- **Spacing/rhythm.** Replaced the double-padded section wrappers with a single-ownership `splitGrid`
  (no container/padding of its own) and reduced section padding, so related content sits together and the
  empty regions are gone. Sections now alternate plain / tinted bands for rhythm.
- **Documentation.** Same brand system: dark readable headings, sans prose, grouped sticky sidebar with a
  blue active state, provenance notice, high-quality code windows, prev/next cards, and an "On this page"
  TOC on wide screens. Not every block is a raised card; the article is a comfortable reading column.

---

## 4. Result

The site reads as StreetJS without the logo: charcoal foundation, one confident blue, clean system
typography, consistent dark code windows. Light mode has strong contrast; dark mode has balanced
surfaces and readable blue accents. See the Visual Validation Report for the measured contrast table and
the before/after inspection.
