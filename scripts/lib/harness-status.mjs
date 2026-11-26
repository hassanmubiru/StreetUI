/**
 * Shared exit semantics for verification harnesses.
 *
 * A harness must never turn a missing browser, an unverified request, or a
 * recorded failure into a green CI step. The rules here are the only allowed
 * way for a harness to decide its process exit code:
 *
 *   - FAIL / ERROR            → always nonzero
 *   - BLOCKED                 → nonzero under CI or `--require`
 *   - requested engine/mode   → nonzero when no verified result covers it
 *   - anything unknown        → treated as a failure (fail closed)
 *
 * `OK`, `PASS` and `VERIFIED` are the only statuses that count as verified.
 */

export const VERIFIED_STATUSES = Object.freeze(['OK', 'PASS', 'VERIFIED']);
export const FAILURE_STATUSES = Object.freeze(['FAIL', 'ERROR']);
export const BLOCKED_STATUSES = Object.freeze(['BLOCKED']);

const NETWORK_ERROR_PATTERN = /(?:\bETIMEDOUT\b|\bECONNRESET\b|\bECONNREFUSED\b|\bECONNABORTED\b|\bEAI_AGAIN\b|\bENETUNREACH\b|network request to .+ failed|socket hang up|getaddrinfo (?:EAI_AGAIN|ENOTFOUND)|fetch failed)/i;

/**
 * True when an error came from unavailable network infrastructure rather than
 * the artifact under test. Registry harnesses use this to report BLOCKED instead
 * of turning an npm timeout/reset/DNS outage into a product FAIL.
 *
 * Both Error objects (including npm's stderr/stdout) and plain strings are
 * accepted so callers do not have to lose the underlying network evidence.
 */
export function isNetworkError(error) {
  if (typeof error === 'string') return NETWORK_ERROR_PATTERN.test(error);
  if (error === null || typeof error !== 'object') return false;
  const parts = [];
  for (const key of ['message', 'code', 'stderr', 'stdout']) {
    const value = error[key];
    if (value !== undefined && value !== null) parts.push(String(value));
  }
  if (error.cause !== undefined) {
    parts.push(String(error.cause?.message ?? error.cause));
    if (error.cause?.code !== undefined) parts.push(String(error.cause.code));
  }
  return NETWORK_ERROR_PATTERN.test(parts.join('\n'));
}

/** `--require` may be passed bare or as `--require=true|false`. */
export function hasRequireFlag(argv = process.argv.slice(2)) {
  for (const arg of argv) {
    if (arg === '--require') return true;
    if (arg.startsWith('--require=')) {
      const value = arg.slice('--require='.length).trim().toLowerCase();
      return value !== 'false' && value !== '0';
    }
  }
  return false;
}

export function isCiEnvironment(env = process.env, argv = process.argv.slice(2)) {
  const ci = env.CI;
  const ciTruthy = ci !== undefined && ci !== '' && ci !== '0' && ci.toLowerCase() !== 'false';
  return ciTruthy || hasRequireFlag(argv);
}

export function classifyStatus(status) {
  const value = typeof status === 'string' ? status.trim().toUpperCase() : '';
  if (VERIFIED_STATUSES.includes(value)) return 'verified';
  if (FAILURE_STATUSES.includes(value)) return 'failed';
  if (BLOCKED_STATUSES.includes(value)) return 'blocked';
  return 'unknown';
}

function key(engine, mode) {
  return `${engine}/${mode}`;
}

/**
 * Evaluate a set of per-combination reports.
 *
 * @param {Array<object>} reports each with `engine`, `mode`, `status`, and
 *   optionally `requestedEngine`/`requestedMode`/`actualEngine`.
 * @param {object} [options]
 * @param {boolean} [options.require] force BLOCKED to be fatal
 * @param {boolean} [options.ci] CI detection result (see isCiEnvironment)
 * @param {string[]} [options.requestedEngines] combinations that must be covered
 * @param {string[]} [options.requestedModes]
 */
export function summarizeReports(reports, options = {}) {
  const list = Array.isArray(reports) ? reports.filter(Boolean) : [];
  const requireBlocked = Boolean(options.require || options.ci);
  const failures = [];
  const blocked = [];
  const unknown = [];
  const verified = [];
  const mismatched = [];

  for (const report of list) {
    const classification = classifyStatus(report.status);
    const requestedEngine = report.requestedEngine ?? report.engine;
    const requestedMode = report.requestedMode ?? report.mode;
    const label = `${requestedEngine ?? '?'}/${requestedMode ?? '?'}`;
    // Only a real launch can be a mismatch; a null actualEngine means the
    // browser never started, which the blocked/failed classification covers.
    if (
      typeof report.actualEngine === 'string' &&
      report.actualEngine.length > 0 &&
      requestedEngine !== undefined &&
      report.actualEngine !== requestedEngine
    ) {
      mismatched.push({ label, requestedEngine, actualEngine: report.actualEngine });
    }
    if (classification === 'verified') verified.push(report);
    else if (classification === 'failed') failures.push({ label, status: report.status, reason: report.reason });
    else if (classification === 'blocked') blocked.push({ label, status: report.status, reason: report.reason });
    else unknown.push({ label, status: report.status, reason: report.reason });
  }

  const requestedEngines = options.requestedEngines ?? [];
  const requestedModes = options.requestedModes ?? [];
  const requestedEngineOf = (report) => report.requestedEngine ?? report.engine;
  const requestedModeOf = (report) => report.requestedMode ?? report.mode;
  const missing = [];
  const unreported = [];
  for (const engine of requestedEngines) {
    for (const mode of requestedModes) {
      const matching = list.filter(
        (report) => requestedEngineOf(report) === engine && requestedModeOf(report) === mode,
      );
      if (matching.some((report) => classifyStatus(report.status) === 'verified')) continue;
      const entry = { label: key(engine, mode), engine, mode };
      // A combination with BLOCKED evidence is covered by the blocked rules;
      // a combination with no record at all is a harness defect and always fatal.
      if (matching.length === 0) unreported.push(entry);
      else missing.push(entry);
    }
  }

  let exitCode = 0;
  if (failures.length > 0 || unknown.length > 0 || mismatched.length > 0) exitCode = 1;
  else if (unreported.length > 0) exitCode = 1;
  else if (requireBlocked && (blocked.length > 0 || missing.length > 0)) exitCode = 1;

  return {
    exitCode,
    // Retained so `applyExitCode` can re-evaluate with CI/--require semantics.
    records: list,
    requestedEngines,
    requestedModes,
    counts: {
      total: list.length,
      verified: verified.length,
      failed: failures.length,
      blocked: blocked.length,
      unknown: unknown.length,
      missing: missing.length,
      unreported: unreported.length,
      mismatched: mismatched.length,
    },
    failures,
    blocked,
    unknown,
    missing,
    unreported,
    mismatched,
  };
}

/** Single-status convenience used by harnesses that write one artifact. */
export function exitCodeForStatus(status, { ci = false, require: requireFlag = false } = {}) {
  return summarizeReports([{ status }], { ci, require: requireFlag }).exitCode;
}

/** Re-evaluate a summary's records with CI/`--require` blocked semantics. */
function withCiSemantics(summary, ci) {
  if (summary.exitCode !== 0) return summary.exitCode;
  return summarizeReports(summary.records ?? [], {
    requestedEngines: summary.requestedEngines ?? [],
    requestedModes: summary.requestedModes ?? [],
    ci,
  }).exitCode;
}

/** Summary without the raw records, for writing into JSON artifacts. */
export function summaryForArtifact(summary, { ci = false } = {}) {
  const { records: _records, ...rest } = summary;
  return { ...rest, exitCode: withCiSemantics(summary, ci) };
}

export function formatSummary(summary) {
  const parts = Object.entries(summary.counts).map(([name, value]) => `${name}=${value}`);
  const lines = [`harness summary: ${parts.join(' ')} → exit ${summary.exitCode}`];
  for (const entry of summary.failures) lines.push(`  FAIL ${entry.label}: ${entry.reason ?? entry.status}`);
  for (const entry of summary.unknown) lines.push(`  UNKNOWN ${entry.label}: ${entry.reason ?? entry.status}`);
  for (const entry of summary.mismatched) {
    lines.push(`  MISMATCH ${entry.label}: requested ${entry.requestedEngine}, launched ${entry.actualEngine}`);
  }
  for (const entry of summary.missing) lines.push(`  MISSING ${entry.label}: requested but blocked, no verified result`);
  for (const entry of summary.unreported) lines.push(`  UNREPORTED ${entry.label}: requested but the harness produced no record`);
  for (const entry of summary.blocked) lines.push(`  BLOCKED ${entry.label}: ${entry.reason ?? 'no reason recorded'}`);
  return lines.join('\n');
}

/**
 * Set the process exit code and return it.
 *
 * CI detection (`CI` env or `--require`) is applied by default, so a harness
 * cannot accidentally exit 0 in CI merely because it forgot to pass the flag.
 */
export function applyExitCode(summary, options = {}) {
  const ci = options.ci ?? isCiEnvironment(options.env ?? process.env, options.argv ?? process.argv.slice(2));
  const exitCode = withCiSemantics(summary, ci);
  process.exitCode = exitCode;
  const stdout = options.stdout ?? process.stdout;
  stdout.write(`${formatSummary({ ...summary, exitCode })}\n`);
  return exitCode;
}
