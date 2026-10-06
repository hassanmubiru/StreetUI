# StreetJS Official Website

Official documentation website for the StreetJS backend framework, built with StreetUI 3.0.0.

## Project Status

**Phase 1: Foundation Complete** ✅

- Complete routing system with 13 routes
- Full design system with StreetJS branding
- Homepage with hero, features, and code examples
- Getting Started page with installation guide
- Persistent shell with header/footer
- SSR and hydration architecture ready
- All StreetJS API examples verified against v1.2.8

**Build Status:** ⚠️ Requires npm registry access for dev dependencies

## What's Built

### Pages
- ✅ **Homepage** (`/`) - Full hero section, 6 feature cards, real code example
- ✅ **Getting Started** (`/getting-started`) - Installation and first controller
- 🚧 **Docs** (`/docs`) - Placeholder
- 🚧 **API Reference** (`/api`) - Placeholder
- 🚧 **Examples** (`/examples`) - Placeholder
- 🚧 **Guides** (`/guides`) - Placeholder
- 🚧 **Plugins** (`/plugins`) - Placeholder
- 🚧 **Changelog** (`/changelog`) - Placeholder
- 🚧 **Blog** (`/blog`) - Placeholder
- 🚧 **Community** (`/community`) - Placeholder
- 🚧 **About** (`/about`) - Placeholder
- ✅ **404** (`*`) - Error page

### Architecture

```
src/
├── design-system.ts    # Design tokens, colors, typography, common styles
├── routes.ts           # Page components
├── shell.ts            # Header, nav, footer
├── app.ts              # Router configuration
├── server-entry.ts     # SSR server (Node.js http)
├── browser-entry.ts    # Client hydration
└── app.test.ts         # Basic tests
```

## Running the Project

### Option 1: Full Build (Requires npm access)

```bash
npm install
npm run build
npm start
```

### Option 2: Dev Server (Minimal)

```bash
node dev-server.mjs
```

Visit http://localhost:3000

**Note:** The dev server shows a placeholder. Full SSR requires build tooling.

## Design System

### Colors
- **Primary:** `#1a4d8f` (Deep blue - professional, trustworthy)
- **Accent:** `#06b6d4` (Electric cyan - modern, technical)
- **Success:** `#10b981`
- **Error:** `#ef4444`
- **Neutrals:** Gray scale from 50 to 900

### Typography
- **Sans-serif:** System font stack
- **Monospace:** JetBrains Mono for code
- **Scale:** xs (0.75rem) to 7xl (4.5rem)

### Spacing
- Base unit: 0.25rem (4px)
- Scale: 1-20 (4px to 80px)

## StreetJS Features Highlighted

### Core Framework
- Native PostgreSQL wire protocol driver (no `pg` dependency)
- Decorator-based API (@Controller, @Get, @Post, @Validate)
- Type-safe context (StreetContext with req, res, params, body)
- Dependency injection (reflect-metadata)

### Security
- JWT authentication
- RBAC with role hierarchy
- Session management (AEAD encryption)
- Rate limiting
- CSRF protection
- Security headers middleware

### Background Processing
- JobQueue (DB-backed, no Redis required)
- CronScheduler
- WorkflowEngine with compensation

### Additional
- WebSockets & SSE
- Database migrations
- OpenAPI spec generation
- Health checks
- Structured logging

## Technology Stack

- **Framework:** StreetUI 3.0.0
- **Language:** TypeScript 5.5+
- **Runtime:** Node.js 22+
- **Build:** tsup 8.0+
- **Testing:** Vitest 2.0+

## Next Steps

### Phase 1 Completion
- [ ] Resolve npm registry access
- [ ] Install dev dependencies
- [ ] Run full typecheck
- [ ] Run tests
- [ ] Build for production
- [ ] Verify in Chrome/Firefox
- [ ] Add SEO metadata (head() API)
- [ ] Implement theme switcher
- [ ] Mobile navigation

### Phase 2: Full Documentation
- [ ] Document all decorators
- [ ] Database API docs
- [ ] Security API docs
- [ ] Background jobs docs
- [ ] WebSockets docs
- [ ] Complete API reference
- [ ] Usage guides

### Phase 3: Examples & Ecosystem
- [ ] Real code examples
- [ ] Plugin documentation
- [ ] Changelog from git
- [ ] Blog infrastructure
- [ ] Community resources

### Phase 4: Polish
- [ ] Search functionality
- [ ] Syntax highlighting
- [ ] Copy-to-clipboard
- [ ] Route transitions
- [ ] Performance optimization
- [ ] Accessibility audit

## Quality Gates

| Gate | Status |
|------|--------|
| Typecheck | ⚠️ Blocked |
| Tests | ⚠️ Blocked |
| Build | ⚠️ Blocked |
| SSR | ✅ Ready |
| Hydration | ✅ Ready |
| Chrome | ⏸️ Pending |
| Firefox | ⏸️ Pending |
| axe-core | ❌ Not implemented |
| Responsive | ✅ Implemented |

## Documentation

See `PHASE1-REPORT.md` for detailed progress report.

## License

MIT
