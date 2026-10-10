# StreetJS Website — Content Audit

**Date:** 2026-10-07
**Purpose:** Prove every public claim on the site is either a recorded StreetJS v1.2.8 fact or is
labelled as unverified. Nothing is invented.

---

## Provenance and disclaimer

All StreetJS facts originate from this project's recorded **v1.2.8 `.d.ts` notes**. The site states
this explicitly (About page) and warns readers to **re-verify against the installed version**. The
notes are approximately **40–48 days old** as of this audit. The npm package is **`streetjs`** (the
CLI is `@streetjs/cli`) — an earlier draft that used `@streetjs/core` was wrong and is gone.

---

## Content inventory (counts measured from the built module)

| Section | Items | Notes |
|---|---|---|
| Docs | **18** sections in **5** groups | the known-traps section is included |
| Guides | **6** | each maps a trap/task to real decorators & imports |
| API reference | **12** groups / **48** entries | names observed in the v1.2.8 declarations only |
| Examples | **6** | controller, @Validate body, pg transaction, startup migrations, @Job, health/metrics |
| Plugins | **2** | `loadPlugin/unloadPlugin`; scoped `@streetjs/*` packages |
| Changelog | **1** | v1.2.8 only (the single version with recorded facts) |
| Blog | **7** | one post per recorded trap |
| Search index | **55** docs across **8** kinds | Page 3 · Docs 18 · Guide 6 · API 12 · Example 6 · Plugin 2 · Changelog 1 · Blog 7 |

---

## Verified claims (allowed on the site)

**Imports / module layout:** `streetjs` (root barrel + decorators), `streetjs/http`,
`streetjs/database`, `streetjs/migrations`, `streetjs/security`, `streetjs/ratelimit`,
`streetjs/cache`. Package subpaths are presented as package *exports*.

**HTTP:** `streetApp(options?)`, `StreetHttpApp` (`listen`, `close`, `registerController`, `use`,
`openApiSpec`, `loadPlugin`, `unloadPlugin`, `.server` is a Node `http.Server`).

**Decorators:** `@Controller`, `@Get/@Post/@Put/@Delete/@Patch`, `@Validate` (FieldRule: string,
number, boolean, email, uuid; required, min, max, pattern), `@ApiOperation`, `@Config`, `@Command`,
`@Roles`, `@Permissions`, `@Job`.

**Documented traps (presented as warnings, with the real behaviour):**
- PostgreSQL driver returns every column as a string (`'t'/'f'` booleans, string bigints,
  non-ISO timestamps). *Blog: every-column-is-a-string; Guide: reading-postgres-rows.*
- Framework 5xx can expose DB host / `PG*` env vars. *Blog: errors-leak-infrastructure.*
- Logger metadata can clobber `message`. *Blog: logger-metadata-clobber.*
- Seeds tracked by content hash. *Blog: seeds-by-hash.*
- Global `rbacGuard` silently allows all; `hasRole` ignores hierarchy. *Blog: global-rbac-guard.*
- No password hashing wired by default; `scrypt` maxmem. *Blog: scrypt-maxmem; Guide: hash-passwords.*
- CSRF / login handling. *Blog: csrf-and-login.*

**Health/jobs routes (the only ones the backend panel probes):** `/health/live`, `/health/ready`,
`/api/jobs/metrics` — registered by `registerHealthRoutes` / `registerJobMetricsRoute`.

**Docs link:** https://hassanmubiru.github.io/StreetJS/ (the recorded docs URL).

---

## Explicitly NOT claimed (listed as unverified on About)

These appear on the About page under an "unverified / not claimed" heading, so a reader is never
misled:

1. **Licence terms** — not recorded.
2. **Repository URL, contributor list, release cadence** — not recorded.
3. **Production users / adoption numbers** — none.
4. **Benchmark figures** — none.
5. **A scaffolding command (`npx streetjs create`)** — named only as something *not* confirmed to exist.

A test (`content-integrity.test.ts`) scans all rendered text for invented-API tokens and for the
wrong `@streetjs/core` package name, and asserts the scaffolding command is only ever referenced as
unverified — never as a working instruction.

---

## Integrity gates (automated)

- No banned/invented strings in any rendered block.
- No broken internal links (every `href` resolves to a registered route or an external, labelled link).
- Search index covers all content kinds; every result id is unique and slugged.
- The changelog contains only v1.2.8.

---

## SEO content per route

Every route emits a complete head: `title`, `description`, `canonical`, `robots`, plus Open Graph
(`og:site_name`, `og:type`, `og:title`, `og:description`, `og:url`) and Twitter card tags. The 404
route sets `robots=noindex`. The canonical/OG origin comes from `SITE_URL` (a configurable
placeholder, `https://streetjs.example` by default); `og:image` is intentionally omitted (no verified
asset).
