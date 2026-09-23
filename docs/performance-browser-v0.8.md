# StreetUI performance — browser layer (v0.8)

StreetUI's benchmark harness (`packages/benchmarks`) measures the hot paths —
compile, mount, reactive update, keyed list reconcile, conditional toggle,
events, unmount, SSR, and hydration — inside Node using a **happy-dom** window
(`src/dom-env.ts`). happy-dom is a dev-only dependency; it never enters the
runtime. That layer is kept in v0.8 unchanged: it runs everywhere, needs no
browser, and every before/after comparison happens in the same environment, so
the **relative** deltas that gate an optimization stay valid.

## The added browser layer

v0.8 adds a **real-browser** layer on top of the happy-dom layer (it does not
replace it). It lives at repo root under `browser/`, outside the workspace
globs, so it is never part of `turbo run test` and cannot move the unit-test
baseline. It uses **Playwright + Chromium**, installed only as a dev tool when
you run it (per §2, no runtime package gains a browser dependency).

Two things it is for:

1. **Correctness in a real engine** — `browser/hydration-identity.mjs` proves
   the hydration contract (`serverNode === clientNode`, live events, in-place
   signal updates) in actual Chromium, not just in happy-dom.
2. **Browser timings** — the same hot-path scenarios the Node harness measures
   can be driven in-page with `performance.now()` to obtain genuine browser
   numbers for mount / hydrate / list-reconcile.

## Methodology for browser numbers

- Serve a built page with `node:http`, open it in Chromium via Playwright.
- Warm up, then take N timed samples per scenario with `performance.now()`
  inside the page; report median + p95, never a single sample.
- Compare a candidate build against the committed baseline on the **same
  machine and browser build** — only same-environment deltas are meaningful.

## Honest status in this environment

The environment used to produce v0.8 has **no browser and no registry access**.
Therefore:

- The browser harness was **authored and type-checked, but not executed here.**
- **No browser performance numbers were collected**, and none are stated
  anywhere in v0.8. Any browser figure must come from actually running the
  harness on a machine with Chromium; figures are never invented or estimated
  (v0.8 rules #2, #4, #5).

The happy-dom hot-path numbers from prior milestones remain valid and are
documented in `docs/performance.md` and `docs/performance-v0.7.md`. v0.8 did not
re-run or alter them, and adds no new numeric claims.
