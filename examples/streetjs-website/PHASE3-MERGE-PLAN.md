# Phase 3 Merge Plan

**Goal:** Unify streetjs-website and streetjs-docs into ONE canonical StreetJS documentation site.

---

## Current State

### streetjs-website/ (StreetUI content)
- ✅ Full infrastructure (dev-server, tsup, vitest, tests)
- ✅ node_modules, package.json, configs
- ❌ Documents StreetUI, not StreetJS
- ❌ Example code shows StreetUI API

### streetjs-docs/ (StreetJS content)
- ✅ Real StreetJS v1.2.8 documentation
- ✅ Verified content from memory
- ✅ Critical traps documented
- ❌ No infrastructure (no build, no tests, no dev-server)
- ❌ Duplicate architecture files

---

## Merge Strategy

### Keep: streetjs-website/ as the base
**Reason:** It has working infrastructure (build, tests, dev-server)

### Action: Replace content with StreetJS

1. **Replace routes.ts**
   - Copy from streetjs-docs/src/routes.ts
   - Use StreetJS content (controllers, database, auth, jobs)
   - Remove StreetUI examples

2. **Update shell.ts branding**
   - Change "Street·UI" → "StreetJS"
   - Update GitHub link
   - Update navigation links

3. **Keep docs-content.ts from streetjs-docs**
   - Already has real StreetJS v1.2.8 API
   - streetjs-website/src/docs-content.ts should be replaced

4. **Keep existing infrastructure**
   - dev-server.mjs
   - tsup.config.ts
   - vitest.config.ts
   - app.test.ts

5. **Remove streetjs-docs/ after merge**
   - No longer needed
   - All content moved to streetjs-website

---

## Files to Update

### Replace entirely:
```
streetjs-website/src/routes.ts      ← FROM streetjs-docs/src/routes.ts
streetjs-website/src/docs-content.ts ← FROM streetjs-docs/src/docs-content.ts (if different)
```

### Update (rebrand):
```
streetjs-website/src/shell.ts       — StreetUI → StreetJS
streetjs-website/src/app.ts         — Update route list
streetjs-website/package.json       — Update description
streetjs-website/README.md          — Update description
```

### Keep unchanged:
```
streetjs-website/src/design-system.ts
streetjs-website/src/theme.ts
streetjs-website/src/seo.ts
streetjs-website/src/mobile-nav.ts
streetjs-website/src/browser-entry.ts
streetjs-website/src/server-entry.ts
streetjs-website/dev-server.mjs
streetjs-website/tsup.config.ts
streetjs-website/vitest.config.ts
```

---

## Routes After Merge

Final route list (13 routes):

1. `/` — StreetJS homepage
2. `/getting-started` — Installation, first controller, traps
3. `/docs` — Documentation index
4. `/docs/:section` — Dynamic doc sections (10 sections)
5. `/guides` — Guides index → NEEDS IMPLEMENTATION
6. `/guides/:slug` — Individual guides → NEEDS IMPLEMENTATION
7. `/api` — API reference
8. `/examples` — Real StreetJS examples
9. `/playground` — Interactive playground → NEEDS IMPLEMENTATION
10. `/plugins` — StreetJS plugins → NEEDS IMPLEMENTATION
11. `/changelog` — Version history → NEEDS IMPLEMENTATION
12. `/blog` — Blog posts → NEEDS IMPLEMENTATION
13. `/about` — About StreetJS → NEEDS IMPLEMENTATION
14. `*` — 404 page

---

## Content Requirements

### KEEP (Already Done)
- ✅ Homepage with StreetJS features
- ✅ Getting Started guide
- ✅ Documentation (10 sections)
- ✅ API reference
- ✅ Examples with real code
- ✅ Guides index
- ✅ 404 page

### IMPLEMENT (New)

#### 1. Individual Guide Pages (/guides/:slug)
**Required guides:**
- rest-api — Controllers, validation, error handling
- database — Queries, transactions, string column trap
- auth — JWT, RBAC, password handling
- jobs — JobQueue, CronScheduler, WorkflowEngine
- testing — Unit tests, integration tests
- deployment — Production setup, environment variables

**Content:** Real patterns from StreetJS v1.2.8

#### 2. Playground (/playground)
**Features:**
- Interactive code editor
- Run StreetJS code snippets
- Show output
- Examples: controller, database query, auth, jobs

**Implementation:** Use StreetUI signals + textarea + eval (or iframe)

#### 3. Plugins (/plugins)
**Content:**
- What is a StreetJS plugin?
- How to create a plugin
- Plugin lifecycle hooks
- Official plugins (if any exist in repo)

**Source:** Real StreetJS repository, memory

#### 4. Changelog (/changelog)
**Content:**
- Version history from git tags
- Release notes
- Breaking changes
- New features

**Source:** Git history (if accessible) or known versions from memory

#### 5. Blog (/blog)
**Content:**
- Announcements
- Tutorials
- Best practices

**Implementation:** Static posts or placeholder for now

#### 6. About (/about)
**Content:**
- What is StreetJS?
- Why StreetJS exists
- Philosophy
- Team/community
- License

**Source:** Real StreetJS repository README, docs

---

## Search Implementation

### Global Developer Search

**Scope:**
- All doc sections
- All guides
- All API methods
- All examples
- All plugins
- All blog posts
- All changelog entries

**Features:**
- Keyboard shortcut (Cmd/Ctrl+K)
- Fuzzy matching
- Result highlighting
- Route navigation on select
- Empty state
- Loading state

**Implementation:**
- Index all content at build time
- Use StreetUI signals for state
- Filter/sort results client-side
- Navigate via router

**Tech:**
- No external deps (Fuse.js, etc.)
- Simple string matching
- Rank by relevance

---

## Duplication Removal

After merge, remove:

```bash
rm -rf examples/streetjs-docs/
```

**Files removed:** 8 files
- app.ts (duplicate)
- browser-entry.ts (duplicate)
- design-system.ts (duplicate)
- docs-content.ts (merged)
- routes.ts (merged)
- server-entry.ts (duplicate)
- shell.ts (merged)
- theme.ts (duplicate)

---

## SEO Requirements

Every route needs:

```typescript
page.head({
  title: 'Page Title — StreetJS',
  description: '150-160 char description',
  canonical: 'https://streetjs.dev/path',
  robots: 'index, follow',
  ogImage: 'https://streetjs.dev/og-image.png',
  ogType: 'website',
});
```

**Routes requiring SEO:**
- / — Homepage
- /getting-started — Getting Started
- /docs — Documentation
- /docs/:section — Each doc section (10)
- /guides — Guides index
- /guides/:slug — Each guide (6)
- /api — API Reference
- /examples — Examples
- /playground — Playground
- /plugins — Plugins
- /changelog — Changelog
- /blog — Blog
- /about — About

**Total:** 13 base routes + 10 doc sections + 6 guides = 29 unique SEO configs

---

## Verification Gates

### TypeScript
```bash
tsc --noEmit
```

### Tests
```bash
vitest run
```

### SSR (All Routes)
```bash
node dev-server.mjs
curl http://localhost:3000/
curl http://localhost:3000/getting-started
curl http://localhost:3000/docs
curl http://localhost:3000/docs/installation
# ... test all routes
```

### Hydration
- Visit each route in browser
- Check console for hydration mismatches
- Verify interactive elements work

### Browser Testing
- Chrome 154+
- Firefox 155+
- Safari (if available)

### Accessibility
```bash
axe-core audit
```

### Production Build
```bash
rm -rf node_modules dist
npm install
npm run build
node dist/server-entry.js
```

---

## Timeline

**Task 25:** ✅ Merge plan (this file)
**Task 26:** Merge content from streetjs-docs
**Task 27:** Implement Guides, Changelog, Blog, About, Plugins
**Task 28:** Implement global search
**Task 29:** Interactive playground + real examples
**Task 30:** Complete SEO for all routes
**Task 31:** Run verification gates
**Task 32:** Produce Phase 3 reports

---

## Success Criteria

### Content
- ✅ One unified StreetJS website
- ✅ All StreetJS v1.2.8 content
- ✅ No StreetUI content
- ✅ All placeholders replaced
- ✅ Real examples only
- ✅ Critical traps documented

### Architecture
- ✅ One shell
- ✅ One router
- ✅ One theme system
- ✅ One design system
- ✅ One search system
- ✅ One SSR entry
- ✅ One browser entry
- ✅ No duplicated files

### Quality
- ✅ TypeScript compiles
- ✅ Tests pass
- ✅ SSR works for all routes
- ✅ Hydration works
- ✅ Chrome + Firefox tested
- ✅ axe-core passing
- ✅ Production build works

---

## Next Steps

1. Start Task 26: Merge streetjs-docs content into streetjs-website
2. Replace routes.ts with StreetJS content
3. Update shell.ts branding
4. Update app.ts route list
5. Test that existing infrastructure still works
