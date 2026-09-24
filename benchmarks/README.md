# benchmarks/

Cross-framework benchmark harness for StreetUI. **Development-only** — nothing
here is part of the shipped `streetui` runtime, and the competitor frameworks
(React, Vue, Svelte, Solid) are dev dependencies of this harness ONLY. They must
never be added to `streetui`'s dependencies.

## Layout

```
benchmarks/
  framework-versions.json     pinned competitor + tooling versions (exact pins)
  run-competitors.mjs         orchestrator: builds + runs each competitor, writes results/
  methodology.md              exact workload per scenario, fairness rationale, how to run
  package.json                orchestrator tooling (vite, playwright)
  competitors/
    shared/measure.mjs        shared timing (median/p95/warmup) + MutationObserver counter
    react/  vue/  svelte/  solid/
                              per-framework scenarios A-H (idiomatic), package.json, vite config
  results/
    baseline.json             StreetUI v1.1 baseline (real; Node + happy-dom)
    react|vue|svelte|solid.json  competitor results (currently BLOCKED markers)
    comparison.json           StreetUI row + competitor rows
    browser.json              real-browser harness marker (see scripts/browser-harness.mjs)
```

The StreetUI side of the same workload lives at
`packages/benchmarks/v11-scenarios.mjs`.

## Current status: BLOCKED

This environment has **no npm registry** and **no Chromium/Playwright**, so the
competitors cannot be installed or benchmarked here. Result files are honest
`BLOCKED` markers — **no numbers are fabricated**, and **no** "StreetUI beats X"
claim is made. See `methodology.md`.

## Run it (needs a registry + a browser)

```sh
cd benchmarks && npm install
for fw in react vue svelte solid; do (cd competitors/$fw && npm install); done
npx playwright install chromium
node run-competitors.mjs
```

If nothing is installed, the orchestrator prints
`competitors: BLOCKED (no registry/browser)` and exits without touching the
existing result files. It overwrites a framework's result file only when it
actually measured that framework.
