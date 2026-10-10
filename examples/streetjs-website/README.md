# StreetJS website

The single, canonical StreetJS site, built entirely with **StreetUI 3.0.0** — docs, guides, API
reference, examples, an interactive playground, plugins, changelog, blog and about, under one shell,
router, theme, design system, search, SSR entry and browser entry.

All StreetJS content is derived from this project's recorded **v1.2.8** facts; nothing about APIs,
plugins, benchmarks, roadmap or adoption is invented. See `STREETJS-WEBSITE-CONTENT-AUDIT.md`.

## Develop

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest (5 files, 73 tests)
npm run build       # tsup → dist/ (browser + node bundles)
npm start           # node server.mjs  (PORT, HOST, SITE_URL)
```

## Routes

`/` · `/getting-started` · `/docs` · `/docs/:section` · `/guides` · `/guides/:slug` · `/api` ·
`/examples` · `/playground` · `/plugins` · `/changelog` · `/blog` · `/blog/:slug` · `/about` · `*`

## Status

Verified in this sandbox: typecheck, tests, SSR for every route (200/404), byte-identical
stylesheet, complete per-route head, hydration-by-reference, 404, no console errors, and a
clean-install production build. Chrome, Firefox and axe-core are **not** run here (unavailable) —
run them in a real-browser environment. See `STREETJS-WEBSITE-PHASE3-REPORT.md` and
`STREETJS-WEBSITE-ARCHITECTURE.md`.
