import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertBrowserEngine,
  assertLaunchedBrowser,
  assertNoUnknownSelectionFlags,
  enginesFromArgv,
  flagValue,
  modesFromArgv,
  normalizeEngines,
  normalizeModes,
  resolveBrowserType,
} from './browser-engines.mjs';

test('normalizeModes expands both into real dev and prod runs', () => {
  assert.deepEqual(normalizeModes('both'), ['dev', 'prod']);
  assert.deepEqual(normalizeModes('dev,both,prod'), ['dev', 'prod']);
  assert.deepEqual(normalizeModes(undefined), ['dev', 'prod']);
  assert.throws(() => normalizeModes('production'), /Unknown server mode/);
});

test('normalizeEngines validates and de-duplicates without substitution', () => {
  assert.deepEqual(normalizeEngines('webkit,firefox,webkit'), ['webkit', 'firefox']);
  assert.deepEqual(normalizeEngines('all'), ['chromium', 'firefox', 'webkit']);
  assert.deepEqual(normalizeEngines(undefined), ['chromium', 'firefox']);
  assert.throws(() => normalizeEngines('chrome'), /Unknown browser engine/);
  assert.throws(() => assertBrowserEngine('safari'), /Unknown browser engine/);
});

test('flagValue supports space and equals forms and never swallows the next flag', () => {
  assert.equal(flagValue('--engine', ['--engine', 'webkit']), 'webkit');
  assert.equal(flagValue('--engine', ['--engine=webkit']), 'webkit');
  assert.equal(flagValue('--engine', ['--mode', 'dev']), undefined);
  assert.equal(flagValue('--engine', []), undefined);
  assert.equal(flagValue('--mode', ['--mode', 'dev', '--require']), 'dev');
});

test('enginesFromArgv accepts both spellings so a requested engine is never dropped', () => {
  // The regression: a harness that only knew `--engine` ignored `--engines` and
  // still exited 0 with no record for the requested engine.
  assert.deepEqual(enginesFromArgv(['--engine', 'webkit'], ['chromium']), ['webkit']);
  assert.deepEqual(enginesFromArgv(['--engines', 'webkit'], ['chromium']), ['webkit']);
  assert.deepEqual(enginesFromArgv(['--engines=webkit,firefox'], ['chromium']), ['webkit', 'firefox']);
  assert.deepEqual(enginesFromArgv([], ['chromium']), ['chromium']);
  assert.throws(() => enginesFromArgv(['--engine', 'webkit', '--engines', 'firefox']), /not both/);
});

test('modesFromArgv defaults and expands both', () => {
  assert.deepEqual(modesFromArgv([], ['dev']), ['dev']);
  assert.deepEqual(modesFromArgv(['--mode', 'both'], ['dev']), ['dev', 'prod']);
});

test('assertNoUnknownSelectionFlags rejects engine/mode-shaped flags the harness ignores', () => {
  assert.doesNotThrow(() => assertNoUnknownSelectionFlags(['--engine', 'chromium', '--mode', 'dev']));
  assert.doesNotThrow(() => assertNoUnknownSelectionFlags(['--require', '--out=x.json']));
  assert.throws(() => assertNoUnknownSelectionFlags(['--browser', 'webkit']), /Unknown selection flag/);
  assert.throws(() => assertNoUnknownSelectionFlags(['--target=web']), /Unknown selection flag/);
  assert.throws(() => assertNoUnknownSelectionFlags(['--engine=chromium', '--servers', 'dev']), /Unknown selection flag/);
});

test('browser type and launched browser must match the request', () => {
  const fakeType = { launch: async () => ({}) };
  assert.equal(resolveBrowserType({ webkit: fakeType }, 'webkit'), fakeType);
  assert.throws(() => resolveBrowserType({ chromium: fakeType }, 'webkit'), /does not provide webkit/);
  const browser = { browserType: () => ({ name: () => 'chromium' }) };
  assert.throws(() => assertLaunchedBrowser(browser, 'webkit'), /Requested webkit.*launched chromium/);
  assert.equal(assertLaunchedBrowser(browser, 'chromium'), browser);
});
