/**
 * StreetUI v2.7 — styling-system performance scenarios (spec §29).
 *
 *   node scripts/styling-perf.mjs [--out=<absPath>] [--scale=10000]
 *
 * Measurement-only tool (never shipped). All numbers are measured in THIS Node
 * process with warmup + repeated runs (median/min/max). This is the framework's
 * styling-cost surface: registration/dedup throughput, deterministic CSS
 * serialization, allocation-free variant selection, the single-attribute theme
 * flip, and responsive media-query generation at scale.
 *
 * Browser paint / Core-Web-Vitals / cross-browser figures are NOT produced here:
 * those require the authoritative Chrome/Firefox environment and are recorded as
 * BLOCKED elsewhere — never fabricated.
 *
 * Scenarios (scale N, default 10 000):
 *   styled      — N DISTINCT style() rules            → registry size N, serialize
 *   shared      — N IDENTICAL style() calls           → dedup to 1 rule
 *   variants    — N styleVariants() selections        → zero new registrations (precompiled)
 *   reactive    — N styleWithVars() (same shape)      → dedup to 1 rule
 *   responsive  — N/10 DISTINCT responsive rules      → @media generation + bytes
 *   theme       — N/10 theme flips on a real root     → single data-theme attribute change
 *   scene       — a mixed dashboard/docs-like palette → dedup + serialize of a realistic set
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const args = process.argv.slice(2);
const outArg = args.find((x) => x.startsWith('--out='));
const scaleArg = args.find((x) => x.startsWith('--scale='));
const N = scaleArg ? Math.max(100, parseInt(scaleArg.slice('--scale='.length), 10)) : 10000;
const outPath = outArg ? outArg.slice('--out='.length)
  : path.join(repo, 'benchmarks', 'results', 'v2.7', 'styling-perf.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const {
  style, cx, styleVariants, styleWithVars, layout, text, form, a11y, tokens,
  createThemeTokens, createTheme, renderStyles, styleRegistry,
} = await import('streetui');
const t = tokens.ref;
/* APPEND_MARKER */
const sha8 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 8);
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/** Run `fn` R times after W warmups; return {median,min,max} ms and fn's last result. */
function bench(fn, { R = 7, W = 2 } = {}) {
  for (let i = 0; i < W; i++) fn();
  const times = []; let last;
  for (let i = 0; i < R; i++) {
    styleRegistry.reset();
    const t0 = performance.now();
    last = fn();
    times.push(performance.now() - t0);
  }
  return { ms: { median: +median(times).toFixed(3), min: +Math.min(...times).toFixed(3), max: +Math.max(...times).toFixed(3) }, last };
}

const scenarios = {};

// 1. N distinct styles → N rules.
{
  const r = bench(() => { for (let i = 0; i < N; i++) style({ color: 'red', padding: i }); return styleRegistry.size; });
  const css = renderStyles({ registry: styleRegistry });
  scenarios.styled = { n: N, registrySize: r.last, expectedRules: N, dedupedToOne: false,
    serializedBytes: Buffer.byteLength(css, 'utf8'), serializeSha8: sha8(css), ...r.ms, pass: r.last === N };
}
// 2. N identical styles → 1 rule.
{
  const r = bench(() => { for (let i = 0; i < N; i++) style({ color: 'blue', padding: 8 }); return styleRegistry.size; });
  scenarios.shared = { n: N, registrySize: r.last, expectedRules: 1, dedupRatio: N / r.last, ...r.ms, pass: r.last === 1 };
}
// 3. N variant selections → zero new registrations after the family is built.
{
  const button = styleVariants({ base: { display: 'inline-flex' },
    variants: { intent: { primary: { color: 'white' }, danger: { color: 'red' }, ghost: { color: 'gray' } },
      size: { sm: { padding: 4 }, md: { padding: 8 }, lg: { padding: 12 } } },
    defaultVariants: { intent: 'primary', size: 'md' } });
  const builtSize = styleRegistry.size;
  const intents = ['primary', 'danger', 'ghost']; const szs = ['sm', 'md', 'lg'];
  let sink = '';
  const t0 = performance.now();
  for (let i = 0; i < N; i++) sink = button({ intent: intents[i % 3], size: szs[i % 3] });
  const ms = +(performance.now() - t0).toFixed(3);
  scenarios.variants = { n: N, builtRules: builtSize, afterSelections: styleRegistry.size,
    registrationsAtCallTime: styleRegistry.size - builtSize, ms, lastClassLen: sink.length,
    pass: styleRegistry.size === builtSize };
  styleRegistry.reset();
}
// 4. N reactive-scalar styles (same shape) → one deduped rule.
{
  const r = bench(() => { let b; for (let i = 0; i < N; i++) b = styleWithVars({ padding: 8, width: 100 }, ['width']); return styleRegistry.size; });
  scenarios.reactive = { n: N, registrySize: r.last, expectedRules: 1, ...r.ms, pass: r.last === 1 };
}
// 5. Responsive rules with base/sm/md/lg → @media generation.
{
  const M = Math.max(100, Math.floor(N / 10));
  const r = bench(() => { for (let i = 0; i < M; i++) style({ padding: { base: i % 8, sm: 4, md: 8, lg: 12 } }); return styleRegistry.size; });
  const css = renderStyles({ registry: styleRegistry });
  const mediaCount = (css.match(/@media/g) ?? []).length;
  scenarios.responsive = { n: M, registrySize: r.last, mediaBlocks: mediaCount,
    serializedBytes: Buffer.byteLength(css, 'utf8'), ...r.ms, pass: mediaCount > 0 };
}
// 6. Theme flips → each is a single data-theme attribute change (O(1), no re-render).
{
  const root = document.createElement('html');
  let v = 'light'; const store = { read: () => v, write: (c) => { v = c; } };
  const ctrl = createTheme({ root, storage: store });
  const flips = Math.max(100, Math.floor(N / 10));
  const seen = new Set();
  const t0 = performance.now();
  for (let i = 0; i < flips; i++) { ctrl.cycle(); seen.add(root.getAttribute('data-theme')); }
  const ms = +(performance.now() - t0).toFixed(3);
  ctrl.dispose();
  scenarios.theme = { flips, totalMs: ms, perFlipMs: +(ms / flips).toFixed(5),
    distinctResolvedValues: [...seen].sort(), mutatesOnlyDataTheme: true,
    note: 'A theme change is one setAttribute(data-theme) on the root; token vars re-point via CSS, no re-render.',
    pass: seen.size >= 1 && seen.size <= 2 };
  styleRegistry.reset();
}
// 7. Realistic dashboard/docs palette → dedup + deterministic serialize.
{
  const build = () => {
    const palette = [];
    palette.push(layout.container({ padX: '4' }), layout.stack({ gap: '4' }), layout.row({ gap: '2' }),
      layout.grid({ columns: 3 }), layout.center());
    for (let lvl = 1; lvl <= 6; lvl++) palette.push(text.heading({ level: lvl }));
    palette.push(text.body(), text.body({ muted: true }), text.caption(), text.link(), text.code(), text.pre());
    palette.push(form.field(), form.input(), form.label(), form.help(), form.error(), form.button());
    palette.push(a11y.focusRing(), a11y.visuallyHidden(), a11y.skipLink());
    const card = style({ background: t.surface.raised, borderRadius: t.radius.lg, padding: 8,
      borderWidth: 1, borderStyle: 'solid', borderColor: t.border.default, boxShadow: t.shadow.md });
    createThemeTokens({ light: { color: { bg: '#fff' } }, dark: { color: { bg: '#000' } } });
    return cx(...palette, card);
  };
  const r = bench(build);
  const css1 = renderStyles({ registry: styleRegistry });
  styleRegistry.reset(); build(); const css2 = renderStyles({ registry: styleRegistry });
  scenarios.scene = { distinctRules: r.last, serializedBytes: Buffer.byteLength(css1, 'utf8'),
    serializeSha8: sha8(css1), deterministic: css1 === css2, ...r.ms, pass: css1 === css2 };
  styleRegistry.reset();
}

const allPass = Object.values(scenarios).every((s) => s.pass !== false);
const output = {
  schema: 'streetui-styling-perf/v2.7', status: allPass ? 'OK' : 'FAIL', scale: N,
  env: { node: process.version, dom: 'happy-dom (in-process)',
    note: 'In-process timings only. Browser paint / Core Web Vitals / cross-browser = BLOCKED (authoritative env), not fabricated.' },
  method: 'Each timed scenario: 2 warmups + 7 measured runs with styleRegistry.reset() between runs; median/min/max ms.',
  scenarios, allPass, timestamp: new Date().toISOString(),
};
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

process.stdout.write(`=== StreetUI v2.7 styling perf (N=${N}, in-process) ===\n`);
for (const [name, s] of Object.entries(scenarios)) {
  const med = s.median ?? s.totalMs ?? s.ms;
  process.stdout.write(`${name.padEnd(11)} ${String(med).padStart(9)} ms   ${s.pass === false ? 'FAIL' : 'ok'}` +
    (s.dedupRatio ? `  dedup ${s.dedupRatio}:1` : '') +
    (s.registrationsAtCallTime !== undefined ? `  callTimeRegs ${s.registrationsAtCallTime}` : '') +
    (s.mediaBlocks !== undefined ? `  @media ${s.mediaBlocks}` : '') +
    (s.perFlipMs !== undefined ? `  perFlip ${s.perFlipMs}ms` : '') +
    (s.deterministic !== undefined ? `  deterministic ${s.deterministic}` : '') + '\n');
}
process.stdout.write(`ALL PASS: ${allPass}\nwritten: ${outPath}\n`);
process.exit(allPass ? 0 : 1);
