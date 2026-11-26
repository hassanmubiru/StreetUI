import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  COORDINATED,
  COORDINATED_DIRS,
  EXTRA,
  PUBLIC_DIRS,
  PUBLISH_ORDER,
  REQUIRED_FILES,
  REQUIRED_SUBPATHS,
  UNSCOPED,
  dirForName,
  expectedLicense,
  isCoordinated,
  packageName,
} from './public-packages.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = (dir) => JSON.parse(fs.readFileSync(path.join(repo, 'packages', dir, 'package.json'), 'utf8'));

test('the release set is 18 coordinated packages plus the initializer', () => {
  assert.equal(COORDINATED.length, 18);
  assert.equal(EXTRA.length, 1);
  assert.deepEqual(PUBLIC_DIRS, PUBLISH_ORDER);
  assert.equal(PUBLIC_DIRS.length, 19);
  assert.equal(new Set(PUBLIC_DIRS).size, 19);
  assert.deepEqual(COORDINATED_DIRS, COORDINATED);
});

test('every published directory exists and exposes the documented name', () => {
  for (const dir of PUBLIC_DIRS) {
    const pkg = manifest(dir);
    assert.equal(pkg.name, packageName(dir), `${dir} package name disagrees with public-packages.mjs`);
    assert.equal(pkg.name, pkg.name.startsWith('@streetui/') ? `@streetui/${dir}` : dir);
    assert.equal(UNSCOPED.has(dir), !pkg.name.startsWith('@streetui/'), `${dir} scoping is inconsistent`);
  }
});

test('the initializer is the only extra and is not lockstep-versioned', () => {
  assert.equal(isCoordinated('create-streetui'), false);
  assert.equal(isCoordinated('core'), true);
  assert.equal(expectedLicense('create-streetui'), 'Apache-2.0');
  assert.equal(expectedLicense('cli'), 'MIT');
  for (const dir of COORDINATED) {
    const pkg = manifest(dir);
    assert.equal(pkg.version, '3.2.2', `${dir} is not on the coordinated version`);
    assert.equal(pkg.license, 'MIT');
  }
  const initializer = manifest('create-streetui');
  assert.equal(initializer.version, '3.2.2');
  assert.equal(initializer.license, 'Apache-2.0');
});

test('the playground is not part of the release set', () => {
  assert.equal(PUBLIC_DIRS.includes('playground'), false);
  assert.equal(manifest('playground').private, true, 'packages/playground must be private so it cannot be published');
});

test('publish order places dependencies before dependents', () => {
  const seen = new Set();
  for (const dir of PUBLISH_ORDER) {
    const pkg = manifest(dir);
    // Only runtime deps constrain publish order; devDependencies are test-only.
    const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
    for (const [name, range] of Object.entries(deps)) {
      if (!String(range).startsWith('workspace:')) continue;
      const dependencyDir = dirForName(name);
      if (dependencyDir === dir || !PUBLIC_DIRS.includes(dependencyDir)) continue;
      assert.ok(seen.has(dependencyDir), `${dir} is published before its workspace dependency ${dependencyDir}`);
    }
    seen.add(dir);
  }
});

test('round-trips names and directories', () => {
  for (const dir of PUBLIC_DIRS) assert.equal(dirForName(packageName(dir)), dir);
});

test('required subpaths and files actually exist in their manifests', () => {
  for (const [dir, subpaths] of Object.entries(REQUIRED_SUBPATHS)) {
    const pkg = manifest(dir);
    for (const subpath of subpaths) {
      assert.ok(Object.hasOwn(pkg.exports ?? {}, subpath), `${dir} must keep the ${subpath} export`);
    }
  }
  for (const [dir, entries] of Object.entries(REQUIRED_FILES)) {
    const pkg = manifest(dir);
    for (const entry of entries) {
      assert.ok((pkg.files ?? []).includes(entry), `${dir} must keep "${entry}" in files`);
    }
  }
});
