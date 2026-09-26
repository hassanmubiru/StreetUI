/**
 * StreetUI v1.8 — .cpuprofile parser (spec §6/§7).
 *
 * Reads a V8 .cpuprofile emitted by profile-client-js.mjs and buckets SELF-time
 * by source origin so we can see the JavaScript fraction that StreetUI actually
 * controls vs. happy-dom's DOM emulation and node internals.
 *
 * HONESTY: self-time here is Node+happy-dom JS time. happy-dom's createElement/
 * appendChild/etc. are pure JS emulation and dominate; in a real browser those
 * become native calls, so the happy-dom bucket is NOT indicative of browser
 * cost. Only the streetui bucket is StreetUI-controlled JS, and even that must
 * be validated in a real browser before any optimization ships (§10).
 *
 * Usage: node benchmarks/profile-parse.mjs <path-to.cpuprofile>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node profile-parse.mjs <file.cpuprofile>'); process.exit(2); }
const prof = JSON.parse(fs.readFileSync(file, 'utf8'));

// Build node-id -> node, and compute self sample counts.
const byId = new Map();
for (const n of prof.nodes) byId.set(n.id, n);
const selfSamples = new Map(); // id -> count
for (const id of prof.samples) selfSamples.set(id, (selfSamples.get(id) ?? 0) + 1);

const totalSamples = prof.samples.length;
// Sample interval (microseconds). deltas sum ~ wall time.
const totalUs = (prof.timeDeltas ?? []).reduce((a, b) => a + b, 0);
const usPerSample = totalSamples ? totalUs / totalSamples : 0;

function bucketOf(url, fn) {
  if (!url) return fn === '(garbage collector)' ? 'gc' : (fn === '(program)' || fn === '(idle)' || fn === '(root)') ? 'vm' : 'native/builtin';
  if (url.includes('/packages/') && url.includes('streetui')) return 'streetui';
  if (url.includes('/happy-dom/')) return 'happy-dom';
  if (url.includes('/streetui/dist/') || url.includes('/node_modules/streetui/')) return 'streetui';
  if (url.startsWith('node:')) return 'node-core';
  if (url.includes('/node_modules/')) return 'other-deps';
  return 'app/other';
}

const buckets = new Map();
const perFn = new Map();
for (const [id, count] of selfSamples) {
  const n = byId.get(id);
  if (!n) continue;
  const cf = n.callFrame ?? {};
  const b = bucketOf(cf.url ?? '', cf.functionName ?? '');
  buckets.set(b, (buckets.get(b) ?? 0) + count);
  if (b === 'streetui') {
    const short = (cf.url ?? '').split('/packages/').pop()?.split('/dist/').pop() ?? cf.url;
    const key = `${cf.functionName || '(anon)'} @ ${short}:${cf.lineNumber}`;
    perFn.set(key, (perFn.get(key) ?? 0) + count);
  }
}

const pct = (c) => `${(100 * c / totalSamples).toFixed(1)}%`;
const ms = (c) => `${(c * usPerSample / 1000).toFixed(1)}ms`;

console.log(`\n=== .cpuprofile self-time buckets (Node+happy-dom JS; NOT a browser) ===`);
console.log(`total samples=${totalSamples}  ~wall=${(totalUs/1000).toFixed(0)}ms  (${usPerSample.toFixed(0)}us/sample)\n`);
const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
for (const [b, c] of sorted) console.log(`  ${b.padEnd(16)} ${pct(c).padStart(7)}  ${ms(c).padStart(9)}`);

console.log(`\n=== StreetUI-controlled JS self-time, by function (the only bucket StreetUI owns) ===`);
const fns = [...perFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [k, c] of fns) console.log(`  ${pct(c).padStart(7)} ${ms(c).padStart(9)}  ${k}`);

const streetuiPct = 100 * (buckets.get('streetui') ?? 0) / totalSamples;
console.log(`\nStreetUI-controlled JS = ${streetuiPct.toFixed(1)}% of JS self-time in THIS Node run.`);
console.log(`happy-dom emulation = ${(100*(buckets.get('happy-dom')??0)/totalSamples).toFixed(1)}% (becomes native in a real browser; NOT a StreetUI cost).`);
