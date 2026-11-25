#!/usr/bin/env node
/**
 * Single source of truth for the StreetUI release set.
 *
 * Every release script (release-check, pack-tarballs, apply-publish-metadata,
 * publish-packages, reconcile-registry, verify-tarballs) imports this module
 * instead of keeping its own list. Five divergent copies previously existed,
 * which is how `create-streetui` came to be packed but never published and how
 * `apply-publish-metadata` came to silently drop subpath exports.
 *
 * `packages` is the full packed/published set (19 entries: the 18 coordinated
 * `3.x` packages plus the `create-streetui` initializer). `PUBLIC_DIRS` /
 * `PUBLIC_NAMES` are the 18 coordinated packages that share one version.
 */

/** The 18 packages that share the coordinated release version. */
export const COORDINATED = [
  'core',
  'state',
  'graph',
  'dsl',
  'compiler',
  'runtime',
  'events',
  'scheduler',
  'dom',
  'renderer',
  'router',
  'forms',
  'i18n',
  'context',
  'devtools',
  'testing',
  'cli',
  'streetui',
];

/** Extra artifacts that ship with a release but are not part of the lockstep set. */
export const EXTRA = ['create-streetui'];

/** Every packed/published directory, in dependency order (leaves first). */
export const PUBLISH_ORDER = [
  // Tier 1 — zero internal deps
  'core',
  'events',
  'scheduler',
  // Tier 2 — depend only on tier 1
  'state',
  'graph',
  // Tier 3 — depend on tiers 1-2
  'dsl',
  'compiler',
  'runtime',
  // Tier 4 — depend on tiers 1-3
  'dom',
  'renderer',
  // Tier 5 — integrations / extensions
  'router',
  'forms',
  'i18n',
  'context',
  'devtools',
  'testing',
  // CLI (toolchain; depends on `typescript` only)
  'cli',
  // Unified single-package consumer entry (bundles everything above)
  'streetui',
  // `npm create streetui@latest` wrapper over @streetui/cli
  'create-streetui',
];

/** All packed directories (19). */
export const PUBLIC_DIRS = [...PUBLISH_ORDER];

/** The 18 coordinated directories. */
export const COORDINATED_DIRS = COORDINATED;

/**
 * Directories whose package name is unscoped. `streetui` is the unified
 * consumer entry; `create-streetui` is the `npm create` initializer.
 */
export const UNSCOPED = new Set(['streetui', 'create-streetui']);

/** Package name for a directory. */
export function packageName(dir) {
  return UNSCOPED.has(dir) ? dir : `@streetui/${dir}`;
}

/** Directory for a package name. */
export function dirForName(name) {
  return name.startsWith('@streetui/') ? name.replace(/^@streetui\//, '') : name;
}

/** True when `dir` belongs to the lockstep (18-package) version set. */
export function isCoordinated(dir) {
  return COORDINATED.includes(dir);
}

/** Expected license per package. */
export function expectedLicense(dir) {
  return dir === 'create-streetui' ? 'Apache-2.0' : 'MIT';
}

/**
 * Subpath exports that must never be dropped by metadata rewriting. Each entry
 * maps a package directory to subpaths (other than `.`) its manifest must keep.
 */
export const REQUIRED_SUBPATHS = {
  streetui: ['./server', './testing', './diagnostics', './package.json'],
  compiler: ['./diagnostics'],
};

/** `files` entries that must survive metadata rewriting. */
export const REQUIRED_FILES = {
  streetui: ['templates'],
  cli: ['templates'],
};
