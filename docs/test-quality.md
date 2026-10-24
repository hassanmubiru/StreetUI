# Test-quality policy

StreetUI uses several test layers because no single environment proves the whole
platform:

- **Unit tests:** signals, routing, validation, graph transforms, and serializers.
- **Integration tests:** DSL → compiler → graph → renderer → DOM behavior.
- **Example tests:** real application flows, local HTTP APIs, SSR, hydration, and
  route cleanup.
- **Browser harnesses:** paint, layout, frame pacing, long tasks, and browser-only
  focus behavior. These must run in a real browser; a BLOCKED report is not a
  fabricated pass.
- **Assistive technology checks:** separate from axe and DOM assertions.

New behavior should include a user-observable test at the narrowest appropriate
layer and a boundary test for cleanup, failure, empty, or cancellation behavior.
Tests should not assert private implementation shape when a DOM, API, or lifecycle
outcome can be observed instead.

## Required gates

Every pull request runs the full TypeScript, lint, and Turbo test matrix. The
build job additionally checks published bundle budgets, coordinated package
versions, packed-tarball ESM/CommonJS consumer smoke tests, and the structural
accessibility suites. Scheduled browser validation installs Chromium and Firefox
and records real-engine measurements; Chromium also runs the axe-core visual
accessibility gate. Assistive-technology reports remain a separate Orca/AT-SPI
workflow because GitHub-hosted runners do not provide a usable screen-reader
session by default.

The repository does not claim property-based or mutation-testing coverage today.
Critical behavior is instead protected by explicit boundary tests, stress tests,
SSR/hydration tests, and the real-browser harness. Adding either technique should
produce an actionable report and a stable CI threshold before becoming a
required gate; a nominal command that silently skips tests would be worse than
the current explicit policy.
