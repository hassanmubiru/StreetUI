# StreetUI roadmap

Status is recorded as **Completed**, **In progress**, **Planned**, or **Under
consideration**. No delivery dates are promised.

## Completed

- Independent TypeScript frontend toolchain (resolver, transform, dev server,
  HMR, production builder, preview server, CLI) — M8/M9
- AI-agent-native development workflow: JSONL protocol with
  `eventId`/`sessionId`, authenticated control API, browser-confirmed HMR,
  console/error capture, session shutdown and token revocation — M10
- Visual browser verification and agent automation: real PNG screenshots,
  interactions, structured visual inspection, multi-client sessions, lifecycle
  events — M11
- Coordinated 3.2.0 release (18 packages) and the 3.2.1 corrective release
  (TypeScript declarations restored in all packages)
- M12 developer adoption: onboarding audit, template audit (all 10 templates
  pass), production dashboard example, external developer acceptance test in
  Chromium and Firefox, deployment and compatibility guides, API experience
  tests, community readiness files
- M13 production hardening: Node 18 SSR cache fix, axe-core audits (Chromium and
  Firefox, 0 violations), SSR/hydration harness, Docker verification
- M14 release integrity: nine release-pipeline defects fixed, one shared public
  package list, pack/verify/smoke gates, Node 18/20/22/24 matrix on packed
  artifacts, and `3.2.2` published (19 packages, `latest`)
- WebKit verification: browser, a11y and SSR/hydration harnesses pass on WebKit
  26.6; `browser-validation.yml` gained a WebKit job
- M15 CI/ecosystem reliability: one shared harness exit contract
  (`scripts/lib/harness-status.mjs`) with browser-evidence fields on every
  record, `mutation` cancellation contract documented and tested, real HTTP
  integration in the dashboard reference app, dependency and public-API audits
  (19 packages, 23 subpaths), sampled performance measurement, and the
  `streetui/diagnostics` declaration defect fixed

## In progress

- GitHub CI reliability: the account billing lock prevents CI jobs from starting
  (owner action required, not a code issue)
- Vercel deployment integration for `streetjs-website` (owner configuration)

## Planned

- Documentation consolidation: keep `docs/README.md`, package READMEs, and the
  M8–M15 reports consistent with the published release
- Expanded production deployment examples (health-check route pattern,
  graceful shutdown verification in Docker)
- Performance baselines: startup, build, render, hydration, reactive updates,
  keyed lists, route transitions, memory — recorded with environment and
  methodology. M15 supplies the sampling and cold/warm separation; a published
  baseline table per engine is still outstanding
- Registry and GitHub CI re-verification once the billing lock is cleared;
  until then evidence stays `local-workspace` / `local-packed` only

## Under consideration

- Publishing `@streetui/playground` on npm (currently intentionally
  unpublished; requires an explicit decision)
- Screenshot formats beyond PNG (JPEG/WebP) and image diffing
- Additional starter templates for production patterns (authentication flows,
  data-table CRUD)
- Browser automation beyond the verified Chromium/Firefox/WebKit coverage:
  cross-engine screenshot diffing and visual baselines
- An MCP server for the agent control API, only if a separate architectural
  proposal demonstrates clear need
