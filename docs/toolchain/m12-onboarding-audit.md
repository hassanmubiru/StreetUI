# M12.1 — External Developer Onboarding Audit

Date: 2026-11-19
Method: every step performed against **published npm artifacts only**
(`streetui@3.2.1`, `@streetui/cli@3.2.1`, and the `@streetui/*@3.2.1` set), in
clean consumer projects outside the monorepo. No workspace aliases or symlinks.

## The 14-step journey (verified)

| Step | Result | Evidence |
|------|--------|----------|
| 1. Discover StreetUI | OK | Root README documents install, create, full platform, agent workflow, and doc links; npm page shows the same README at 3.2.1. |
| 2. Install the framework | OK | `npm install streetui@3.2.1` resolves in seconds (2 packages incl. TypeScript). |
| 3. Create an application | OK | `streetui create app --template counter` scaffolds a complete project; `--template basic|ssr` also verified. |
| 4. Install dependencies | OK | Generated app pins `@streetui/*@3.2.1` and `@streetui/cli@3.2.1`; registry install completes with no version conflicts. |
| 5. Start development | OK | `streetui dev --json` emits `preview_ready` with `version: 3.2.1` plus `eventId`/`sessionId`; SSR HTML and `/src/main.ts` served. |
| 6. Understand the structure | OK | Template READMEs describe `src/app.ts` (universal UI), `src/main.ts` (browser entry/hydration), `src/server.ts` (SSR entry), `public/`. |
| 7. Build a component | OK | `component()` + `page.component` documented with typed props and cleanup; DSL `page.section/heading/button` used in every template. |
| 8. Add reactive state | OK | `signal`, `derived`, `effect`, `batch` examples work; counter template demonstrates `Signal<number>` end to end. |
| 9. Add routing | OK | `createRouter`, `mountRouter`, `routerOutlet` with `*`-fallback; routing template covers links and nested routes. |
| 10. Add forms | OK | `createForm` with `required()`, `email()`, `minLength()` and `form.submit()`; form template covers validation + submitting state. |
| 11. Fetch external data | OK | `resource()` exposes `loading`/`data` signals with `page.when` branches; `mutation()` + `createClient` for writes. |
| 12. Style the interface | OK | `style`, `cx`, `createThemeTokens`, `layout.*`, `text.*`, `a11y.*` presets; no external CSS framework required. |
| 13. Build for production | OK | `streetui build` emits `dist/client/manifest.json`, hashed assets, extracted CSS, and the SSR server build. |
| 14. Run the production app | OK | `streetui start` serves SSR HTML at the configured port. (`preview` intentionally 404s for SSR apps without a static `index.html` — use `start`.) |

Additional verification from the same consumer runs: `streetui doctor` passes
all checks and correctly reports Playwright as optional/absent;
`import * as S from 'streetui'` yields 255 exports, `streetui/server` SSR
renders, `streetui/testing` yields 25 exports, and CJS `require('streetui')`
works. All 11 previously declaration-broken sub-packages now pass `tsc --strict`
consumer imports at 3.2.1.

## Findings (not defects in the current release)

1. **`streetui preview` vs `streetui start` confusion risk.** For SSR
   templates, `preview` serves only `dist/client` and therefore 404s at `/`.
   This is documented behavior, but new users may try `preview` first.
   *Action:* deployment doc (`m12-deployment.md`) explicitly maps
   SSR → `start`, static client-only builds → `preview`.
2. **Playwright optionality needs to stay visible.** `doctor` skips browser
   checks when Playwright is absent, which is correct but could be mistaken for
   a missing feature. *Action:* agent docs state the install command and the
   exact `E_AUTOMATION_UNAVAILABLE` error returned when it is absent.
3. **Introductory vs production starters.** The 10 templates mix introductory
   examples (`basic`, `signals`) with richer starters (`ssr`, `counter`,
   `todo`, `interactive`). *Action:* template audit records the distinction and
   `examples/streetui-dashboard` provides the production-oriented example.

No broken or undocumented step in the published journey was found beyond those
documentation-level improvements. The D-1 declaration defect is fully resolved
in all 11 affected packages at 3.2.1.
