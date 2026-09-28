# v2.1 competitor-benchmark integrity note

**Finding (2026-09-28).** The repository already contains competitor result files that
cannot be trusted as same-environment browser measurements and are therefore **excluded**
from the StreetUI 2.1 evidence set.

Affected files (all timestamped `2026-09-25`):

- `benchmarks/results/react.json`
- `benchmarks/results/vue.json`
- `benchmarks/results/svelte.json`
- `benchmarks/results/solid.json`
- `benchmarks/results/comparison.json` (aggregates the above)

**Why they are excluded.** Each file records:

- `environment.domEnvironment = "chromium (Playwright)"`, but
- `browserVersion = null`, and
- `nodeVersion = "v24.18.0"`.

This environment is Node **v22.23.2** with **no Chromium binary anywhere** (see
`environment.json`). A genuine Playwright/Chromium run always records the concrete
browser version; a `"chromium (Playwright)"` label paired with `browserVersion: null`
is internally inconsistent. The numbers (e.g. React `initialRender ≈ 11.4 ms`) are
browser-scale, but they were produced — if at all — in a different, unreproducible
environment, or copied from elsewhere. StreetUI 2.1 §16 is explicit: *"Missing
measurements must be null with an explicit status. Never use published numbers from
another benchmark as substitutes."* §15 requires the **same Chromium on the same
machine** for every framework.

**Action taken.** These files are neither used nor cited as 2.1 competitor evidence.
They are left on disk (the deliverable filesystem forbids deletion) but are superseded
for 2.1 by the honest BLOCKED records in this directory. The authoritative 2.1
competitor status is `BLOCKED` with an exact reason, captured in
`environment.json` and `competitors-blocked.json`.

**No framework ranking is produced (§17).** No 1st/2nd/3rd/winner/best/worst is stated,
because no valid same-environment cross-framework measurement exists in this environment.
