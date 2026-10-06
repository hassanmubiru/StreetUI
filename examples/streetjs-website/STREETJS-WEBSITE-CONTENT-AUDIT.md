# StreetJS Website Content Audit

**Date:** 2026-10-06  
**StreetJS Version:** v1.2.8 (verified from memory)  
**Purpose:** Identify what content exists vs what needs real StreetJS information

---

## Current Status

### ✅ Complete Pages (Real Content)

**Homepage (`/`)**
- Status: Complete with real features
- Content: 6 verified StreetJS features
- Code example: Real @Controller/@Get/@Post/@Validate usage
- Issues: None

**Getting Started (`/getting-started`)**
- Status: Complete
- Content: Installation, first controller, bootstrap
- Code examples: Real StreetJS API
- Issues: None

**Examples (`/examples`)**
- Status: Partially complete
- Content: 3 examples (REST API, JWT auth, background jobs)
- Code examples: Generic but API-accurate
- Issues: Need more specific examples from verified API surface

**API Reference (`/api`)**
- Status: Basic structure complete
- Content: Decorators, core classes, middleware listed
- Code examples: None
- Issues: Needs expansion with all verified exports

**Guides (`/guides`)**
- Status: Card links only
- Content: 9 guide cards with descriptions
- Code examples: None
- Issues: No actual guide content, just placeholders

**Community (`/community`)**
- Status: Complete
- Content: GitHub links, contributing info
- Issues: None

**About (`/about`)**  
- Status: Complete
- Content: Philosophy, version, license
- Issues: None

**404 (`*`)**
- Status: Complete
- Issues: None

### 🚧 Placeholder Pages (Need Real Content)

**Docs (`/docs`, `/docs/:section`)**
- Current: "Full documentation coming soon"
- Needed: Complete StreetJS v1.2.8 documentation
- Priority: HIGH
- Verified sources available: Yes (memory has full API surface)

**Plugins (`/plugins`)**
- Current: Uses generic DocsPage placeholder
- Needed: Plugin system documentation
- Priority: MEDIUM
- Verified sources available: Unknown (need to check if plugin system exists)

**Changelog (`/changelog`)**
- Current: Uses generic DocsPage placeholder  
- Needed: Real version history
- Priority: HIGH
- Verified sources available: No (would need git history)

**Blog (`/blog`)**
- Current: Uses generic DocsPage placeholder
- Needed: Blog infrastructure and posts
- Priority: LOW
- Verified sources available: No

---

## Verified StreetJS v1.2.8 Features (From Memory)

### Core Framework
✅ Decorators: @Controller, @Get, @Post, @Put, @Delete, @Patch, @Validate, @ApiOperation, @Config, @Command, @Roles, @Permissions, @Job
✅ StreetContext: req, res, params, query, body, state, user, files, rawBody, json(), text(), html(), send()
✅ Bootstrap: streetApp(), StreetHttpApp with listen(), close(), registerController(), use(), openApiSpec()
✅ Middleware: MiddlewareFn pattern
✅ DI Container: resolve(), register(), has(), reset()

### Database (Native PostgreSQL)
✅ PgPool: query(), transaction(), stream(), acquire(), release(), initialize()
✅ PgConnection: query(), queryStream(), close()
✅ StreetPostgresRepository: findById(), findAll(), create(), update(), delete(), count(), streamAll()
✅ Migrations: StreetMigrationRunner with run() and rollback()
✅ Seeder: StreetSeeder.run() (content-hash based)
✅ **Critical trap**: All columns return as strings, requires explicit decoding
✅ **No TLS support**: Plain TCP only

### Security
✅ JwtService: sign(), verify(), decode()
✅ SessionManager: encrypt(), decrypt() with AEAD
✅ RbacService: hasRole(), hasPermission() with hierarchy
✅ rbacGuard middleware
✅ validate() middleware (Zod-based)
✅ authMiddleware, requireRoles, securityHeaders, corsMiddleware, csrfMiddleware
✅ KeyRing, FieldCipher for field-level encryption

### Background Jobs
✅ JobQueue: enqueue(), register(), setRetryPolicy(), start(), stop(), metrics()
✅ CronScheduler: register(), start(), stop()
✅ WorkflowEngine: define(), start(), resume()
✅ SagaOrchestrator: execute() with compensation
✅ All DB-backed with migration SQL constants

### Additional Features
✅ RedisClient: RESP2 client (no ioredis dependency)
✅ WebSockets: First-class support
✅ SSE: Server-Sent Events
✅ Logger: Structured logging with correlation IDs
✅ HealthCheckRegistry: Health checks
✅ OpenAPI: openApiSpec() generation
✅ Multipart: File uploads
✅ Rate limiting: RateLimiter with Redis or in-memory stores

### Advanced (Uninspected but Present)
- GraphQL support
- Tenancy
- Microservices
- Enterprise features
- Cloud integrations
- Testing/chaos
- Query builder
- Prometheus/OTEL
- MFA, WebAuthn, API keys
- Feature flags
- Analytics

---

## Content Gaps Analysis

### Documentation Gaps

**HIGH Priority:**
1. Complete /docs page with full API documentation
2. Database guide (connection, queries, transactions, migrations)
3. Authentication guide (JWT, sessions, RBAC)
4. Validation guide (Zod schemas, middleware)
5. Background jobs guide (JobQueue, cron, workflows)
6. Deployment guide
7. Changelog with version history

**MEDIUM Priority:**
8. WebSockets guide
9. Testing guide
10. Plugins/extensions documentation
11. Advanced features (if used)

**LOW Priority:**
12. Blog posts
13. Case studies
14. Tutorials beyond getting started

### Example Gaps

**Current examples are generic. Need:**
1. Real CRUD with proper row decoding (the string-column trap)
2. JWT authentication complete flow
3. RBAC with role hierarchy
4. Transaction handling
5. Migration example with rollback
6. Job queue with retry policy
7. Cron scheduled task
8. WebSocket server
9. Rate limiting setup
10. Health checks

### Known Traps to Document

**CRITICAL (must document):**
1. **String columns**: All PgPool results are strings, need explicit decode
2. **No TLS**: PostgreSQL and Redis are plain TCP
3. **Seeder content hash**: Editing a seed re-runs it entirely
4. **Error leaks**: Framework 5xx exceptions leak DB connection details
5. **Logger metadata**: metadata.message overwrites the log message
6. **RBAC global position**: rbacGuard silently allows all in global middleware

**IMPORTANT (should document):**
7. Secret format requirements (SessionManager needs exactly 64 hex chars)
8. Connection options are discrete fields, not connection strings
9. corsMiddleware never sets Access-Control-Allow-Credentials
10. parseBody runs before global middleware
11. RedisClient has no auto-reconnect
12. Health check errors leak to unauthenticated callers

---

## Action Items for Phase 2

### 1. Expand Documentation (/docs)
- [ ] Create comprehensive docs structure
- [ ] Document all decorators with examples
- [ ] Document PgPool API with string-column trap
- [ ] Document security APIs (JWT, RBAC, sessions)
- [ ] Document background jobs
- [ ] Document migrations and seeding
- [ ] Document known traps

### 2. Improve Examples
- [ ] Add proper row decoding example
- [ ] Add complete authentication flow
- [ ] Add transaction example
- [ ] Add migration example
- [ ] Add job queue example with DLQ
- [ ] Add WebSocket example

### 3. Create Guides (/guides)
- [ ] Database setup and connection
- [ ] Authentication and authorization
- [ ] Validation with Zod
- [ ] Background jobs and cron
- [ ] Migrations
- [ ] Testing
- [ ] Deployment

### 4. Build Changelog (/changelog)
- [ ] Document v1.2.8 current release
- [ ] List known version history (if available)
- [ ] Breaking changes
- [ ] Migration guides

### 5. Plugin Documentation (/plugins)
- [ ] Determine if plugin system exists
- [ ] Document loadPlugin/unloadPlugin if present
- [ ] List any known plugins

### 6. Blog Infrastructure (/blog)
- [ ] Create blog post structure
- [ ] Initial posts about key features
- [ ] Migration guides
- [ ] Best practices

### 7. Improve Homepage
- [ ] Add architecture diagram/explanation
- [ ] Add ecosystem section
- [ ] Stronger positioning statements
- [ ] More prominent CTAs

### 8. Search Implementation
- [ ] Create searchable content index
- [ ] Implement search UI with StreetUI signals
- [ ] Keyboard navigation
- [ ] Empty states

### 9. Navigation Improvements
- [ ] Active route highlighting
- [ ] Keyboard navigation support
- [ ] Better mobile UX

---

## Content Sources

### Available
✅ Memory: Complete v1.2.8 API surface with types and behaviors
✅ Memory: Known traps and sharp edges
✅ Memory: Migration/seeder behavior
✅ Memory: Security gotchas
✅ Existing code: Current website examples

### Not Available
❌ Git history: For changelog
❌ Benchmark data: No performance numbers verified
❌ Adoption metrics: No usage statistics
❌ Plugin registry: Unknown if exists
❌ Real repository examples: Would need to inspect source

---

## Verification Checklist

- [ ] All code examples compile
- [ ] All API references match v1.2.8
- [ ] All known traps documented
- [ ] No invented features
- [ ] No fabricated benchmarks
- [ ] No fake adoption numbers
- [ ] All links work
- [ ] All routes render
- [ ] Search works
- [ ] Mobile navigation works
- [ ] Dark mode works
- [ ] SEO metadata complete
- [ ] Accessibility checked
- [ ] No console errors

---

## Next Steps

1. Start with /docs expansion (highest value)
2. Create real guide content
3. Improve examples with proper patterns
4. Build changelog if version info available
5. Implement search
6. Run verification gates
7. Generate final reports

---

## Notes

- All content must be traceable to verified v1.2.8 API surface
- Document traps prominently to prevent real bugs
- Examples should show correct patterns (row decoding, error handling, etc.)
- No speculation about features not in memory
- Quality over quantity—accurate docs better than comprehensive-but-wrong docs
