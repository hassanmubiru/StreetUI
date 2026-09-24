#!/usr/bin/env node
/**
 * StreetUI release-readiness check + machine-readable release manifest (v0.9 §23–§25).
 *
 * This is a NON-MUTATING gate: it only reads the workspace and reports. It never
 * edits a package.json, never rewrites versions, never publishes. Its job is to
 * answer one question before a release — "is this set of packages internally
 * consistent and safe to pack/publish?" — and to emit a machine-readable
 * manifest describing exactly what would ship.
 *
 * Checks performed (per public package):
 *   1. Publish metadata present & correct — name, version, license MIT,
 *      sideEffects:false, publishConfig.access:"public", a `files` whitelist,
 *      and dual-module `exports` with per-condition types (import→.d.ts,
 *      require→.d.cts). [error]
 *   2. Internal `workspace:*` dependencies resolve to a package that actually
 *      exists in the workspace. An unresolved internal dep is uninstallable
 *      outside the monorepo. [error]
 *   3. Concrete internal dependency ranges (non-workspace) are satisfiable by the
 *      depended package's current version. [error]
 *   4. Release version alignment across the public set — divergent versions are
 *      reported so a release owner can decide intentionally. [warn]
 *   5. Build presence — whether each package's `dist/` (referenced by `exports`)
 *      exists yet. Missing dist is expected before a build; reported as info. [info]
 *
 * The manifest is an emitted ARTIFACT (default: dist-tarballs/release-manifest.json),
 * not a source edit. Exit code is non-zero iff any [error] check fails.
 *
 * Usage:  node scripts/release-check.mjs [--manifest <path>] [--quiet]
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const manifestIdx = args.indexOf('--manifest');
const manifestPath =
  manifestIdx >= 0 && args[manifestIdx + 1]
    ? join(process.cwd(), args[manifestIdx + 1])
    : join(ROOT, 'dist-tarballs', 'release-manifest.json');

/** Packages intended to be published (mirrors apply-publish-metadata / pack-tarballs). */
const PUBLIC = new Set([
  'core', 'state', 'graph', 'dsl', 'compiler', 'runtime', 'events', 'scheduler',
  'dom', 'renderer', 'router', 'forms', 'i18n', 'context', 'devtools', 'testing',
  'cli',
]);
