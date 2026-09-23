# StreetUI real-browser harness (v0.8)

This directory holds the **real-browser** validation harness. It is deliberately
**not** a workspace package and is **not** wired into `turbo run test` — the repo
root is outside the `packages/*`, `examples/*`, `apps/*` globs — so it can never
affect the unit-test baseline. It runs only when you invoke it directly and only
when a browser is available.

## Why it is separate

The unit suite validates hydration against **happy-dom**, which gives real DOM
*object identity* (`serverNode === clientNode`) inside Node. That is the same
identity contract a browser enforces, and it runs everywhere. This harness adds
the **real Chromium** layer on top: it proves the identical contract in an
actual browser engine, driving real events and real layout.

## Requirements

- A real browser (Chromium).
- `playwright` — a **dev-only** dependency. Per v0.8 §2 it is never added to any
  runtime package; install it locally only when running this harness:

```sh
npm i -D playwright
npx playwright install chromium
node browser/hydration-identity.mjs
```

Exit code `0` means the browser assertions passed; `2` means Playwright/Chromium
was not installed.

## Environment note (honesty, v0.8 rules #4/#5/#22)

The packaging/verification environment used to produce v0.8 has **no browser and
no registry access**, so this harness was **authored and type-checked but not
executed here**, and **no browser performance numbers were collected**. Any
browser figures must be produced by running this harness (and the browser
benchmark layer) on a machine that actually has Chromium — they are not invented
or estimated. See `docs/performance-browser-v0.8.md`.
