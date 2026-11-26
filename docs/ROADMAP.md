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

## In progress

- GitHub CI reliability: the account billing lock prevents Node CI jobs from
  starting (owner action required, not a code issue)
- Vercel deployment integration for `streetjs-website` (owner configuration)

## Planned

- Documentation consolidation: keep `docs/README.md`, package READMEs, and the
  M8–M12 reports consistent with the published release
- Expanded production deployment examples (health-check route pattern,
  graceful shutdown verification in Docker)
- Performance baselines: startup, build, render, hydration, reactive updates,
  keyed lists, route transitions, memory — recorded with environment and
  methodology

## Under consideration

- Publishing `@streetui/playground` on npm (currently intentionally
  unpublished; requires an explicit decision)
- Screenshot formats beyond PNG (JPEG/WebP) and image diffing
- Additional starter templates for production patterns (authentication flows,
  data-table CRUD)
- Browser engine coverage beyond Chromium and Firefox (WebKit), when a real
  engine is available for verification
- An MCP server for the agent control API, only if a separate architectural
  proposal demonstrates clear need
