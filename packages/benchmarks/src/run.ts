/**
 * Runnable benchmark entry — `node dist/run.js [--baseline] [--suite=name,...]`.
 *
 *   (default)     run all suites, write results/current.json, and if a stored
 *                 baseline exists, print the regression comparison.
 *   --baseline    run all suites and write results/baseline.json (the reference
 *                 the next default run compares against).
 *   --suite=a,b   run only the named suites.
 *
 * happy-dom is installed as the global DOM *before* any renderer import touches
 * `document`, so the real BrowserDOMAdapter runs unchanged.
 */

import { installHappyDom } from './dom-env.js';

installHappyDom();

const { runAllSuites } = await import('./index.js');
const { compareResults } = await import('./compare.js');
const {
  writeSuite,
  readSuite,
  formatResults,
  formatComparison,
  formatEnvironment,
} = await import('./report.js');

function parseArgs(argv: readonly string[]): { baseline: boolean; filter: string[] } {
  let baseline = false;
  let filter: string[] = [];
  for (const arg of argv) {
    if (arg === '--baseline') baseline = true;
    else if (arg.startsWith('--suite=')) {
      filter = arg
        .slice('--suite='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  return { baseline, filter };
}

const { baseline, filter } = parseArgs(process.argv.slice(2));

const suite = runAllSuites({
  filter,
  onSuite: (name) => process.stderr.write(`  running ${name}…\n`),
});

process.stdout.write('\nEnvironment\n');
process.stdout.write(formatEnvironment(suite) + '\n\n');
process.stdout.write(formatResults(suite.results) + '\n\n');

const fileName = baseline ? 'baseline.json' : 'current.json';
const written = writeSuite(fileName, suite);
process.stdout.write(`Wrote ${suite.results.length} results → ${written}\n`);

if (!baseline) {
  const base = readSuite('baseline.json');
  if (base !== null) {
    process.stdout.write('\nComparison vs baseline.json\n');
    const comparisons = compareResults(base.results, suite.results);
    process.stdout.write(formatComparison(comparisons) + '\n');
  } else {
    process.stdout.write('\n(no baseline.json yet — run with --baseline to record one)\n');
  }
}
