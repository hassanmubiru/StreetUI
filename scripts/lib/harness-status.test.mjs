import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyExitCode,
  classifyStatus,
  exitCodeForStatus,
  formatSummary,
  hasRequireFlag,
  isCiEnvironment,
  summarizeReports,
  summaryForArtifact,
} from './harness-status.mjs';

test('verified statuses are the only non-fatal success statuses', () => {
  assert.equal(classifyStatus('OK'), 'verified');
  assert.equal(classifyStatus('pass'), 'verified');
  assert.equal(classifyStatus(' VERIFIED '), 'verified');
  assert.equal(classifyStatus('FAIL'), 'failed');
  assert.equal(classifyStatus('error'), 'failed');
  assert.equal(classifyStatus('BLOCKED'), 'blocked');
  assert.equal(classifyStatus('SKIPPED'), 'unknown');
  assert.equal(classifyStatus(undefined), 'unknown');
});

test('failures and errors are always nonzero', () => {
  assert.equal(exitCodeForStatus('FAIL'), 1);
  assert.equal(exitCodeForStatus('ERROR'), 1);
  assert.equal(exitCodeForStatus('FAIL', { ci: false, require: false }), 1);
  assert.equal(exitCodeForStatus('OK'), 0);
  assert.equal(exitCodeForStatus('PASS'), 0);
});

test('blocked is fatal only under CI or --require', () => {
  assert.equal(exitCodeForStatus('BLOCKED'), 0);
  assert.equal(exitCodeForStatus('BLOCKED', { ci: true }), 1);
  assert.equal(exitCodeForStatus('BLOCKED', { require: true }), 1);
});

test('unknown statuses fail closed', () => {
  assert.equal(exitCodeForStatus('SKIPPED'), 1);
  assert.equal(exitCodeForStatus(undefined), 1);
});

test('--require flag parsing accepts bare and valued forms', () => {
  assert.equal(hasRequireFlag(['--require']), true);
  assert.equal(hasRequireFlag(['--require=true']), true);
  assert.equal(hasRequireFlag(['--require=false']), false);
  assert.equal(hasRequireFlag(['--require=0']), false);
  assert.equal(hasRequireFlag([]), false);
  assert.equal(isCiEnvironment({ CI: 'true' }, []), true);
  assert.equal(isCiEnvironment({ CI: 'false' }, []), false);
  assert.equal(isCiEnvironment({}, ['--require']), true);
});

test('requested engine/mode without a verified result fails', () => {
  const summary = summarizeReports(
    [{ engine: 'firefox', mode: 'dev', status: 'BLOCKED', reason: 'no binary' }],
    { requestedEngines: ['firefox'], requestedModes: ['dev'], ci: true },
  );
  assert.equal(summary.exitCode, 1);
  assert.equal(summary.counts.blocked, 1);
  assert.equal(summary.counts.unreported, 0);
  assert.equal(summary.counts.missing, 1);

  // Locally a recorded BLOCKED combination is a non-fatal environment result.
  const localBlocked = summarizeReports(
    [{ engine: 'firefox', mode: 'dev', status: 'BLOCKED', reason: 'no binary' }],
    { requestedEngines: ['firefox'], requestedModes: ['dev'] },
  );
  assert.equal(localBlocked.exitCode, 0);

  // A combination the harness never reported at all is always a defect.
  const neverReported = summarizeReports([], { requestedEngines: ['firefox'], requestedModes: ['dev'] });
  assert.equal(neverReported.exitCode, 1);
  assert.equal(neverReported.counts.unreported, 1);

  const covered = summarizeReports(
    [{ engine: 'firefox', mode: 'dev', status: 'OK', actualEngine: 'firefox' }],
    { requestedEngines: ['firefox'], requestedModes: ['dev'] },
  );
  assert.equal(covered.exitCode, 0);
  assert.equal(covered.counts.missing, 0);

  // Reports that only carry requested* fields must still satisfy coverage.
  const requestedOnly = summarizeReports(
    [{ requestedEngine: 'webkit', requestedMode: 'prod', status: 'PASS', actualEngine: 'webkit' }],
    { requestedEngines: ['webkit'], requestedModes: ['prod'] },
  );
  assert.equal(requestedOnly.exitCode, 0);
  assert.equal(requestedOnly.counts.missing, 0);
});

test('a launched engine that differs from the request fails', () => {
  const summary = summarizeReports([{ engine: 'firefox', mode: 'dev', status: 'OK', actualEngine: 'chromium' }]);
  assert.equal(summary.exitCode, 1);
  assert.equal(summary.counts.mismatched, 1);
});

test('a browser that never launched is blocked, not a mismatch', () => {
  const summary = summarizeReports([
    { requestedEngine: 'webkit', requestedMode: 'dev', status: 'BLOCKED', actualEngine: null, reason: 'launch failed' },
  ]);
  assert.equal(summary.counts.mismatched, 0);
  assert.equal(summary.counts.blocked, 1);
  assert.equal(summary.exitCode, 0);
  assert.equal(summarizeReports([{ requestedEngine: 'webkit', mode: 'dev', status: 'BLOCKED', actualEngine: null }], { ci: true }).exitCode, 1);
});

test('applyExitCode sets process exit code and prints a summary', () => {
  const chunks = [];
  const summary = summarizeReports([{ engine: 'chromium', mode: 'dev', status: 'FAIL', reason: 'boom' }]);
  const previous = process.exitCode;
  try {
    const code = applyExitCode(summary, { ci: false, stdout: { write: (chunk) => chunks.push(chunk) } });
    assert.equal(code, 1);
    assert.equal(process.exitCode, 1);
    const text = formatSummary(summary);
    assert.match(text, /FAIL chromium\/dev: boom/);
    assert.match(chunks.join(''), /harness summary/);
  } finally {
    process.exitCode = previous;
  }
});

test('applyExitCode escalates a recorded BLOCKED under CI or --require', () => {
  const previous = process.exitCode;
  const sink = { write: () => {} };
  try {
    const summary = summarizeReports(
      [{ requestedEngine: 'webkit', requestedMode: 'prod', status: 'BLOCKED', reason: 'no browser' }],
      { requestedEngines: ['webkit'], requestedModes: ['prod'] },
    );
    assert.equal(applyExitCode(summary, { ci: false, stdout: sink }), 0);
    assert.equal(applyExitCode(summary, { ci: true, stdout: sink }), 1);
    const env = { ...process.env };
    delete env.CI;
    assert.equal(applyExitCode(summary, { env, argv: ['--require'], stdout: sink }), 1);
    assert.equal(applyExitCode(summary, { env, argv: [], stdout: sink }), 0);
  } finally {
    process.exitCode = previous;
  }
});

test('artifact summaries omit raw records but keep coverage', () => {
  const summary = summarizeReports(
    [{ requestedEngine: 'chromium', requestedMode: 'dev', status: 'PASS', actualEngine: 'chromium' }],
    { requestedEngines: ['chromium'], requestedModes: ['dev'] },
  );
  const artifact = summaryForArtifact(summary);
  assert.equal(Object.hasOwn(artifact, 'records'), false);
  assert.equal(artifact.counts.verified, 1);
  assert.equal(artifact.exitCode, 0);
});
