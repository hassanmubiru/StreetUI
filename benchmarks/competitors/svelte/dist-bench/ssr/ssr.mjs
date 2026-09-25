const HYDRATION_START = "[";
const HYDRATION_END = "]";
const CONTENT_REGEX = /[&<]/g;
function escape_html(value, is_attr) {
  const str = String(value ?? "");
  const pattern = CONTENT_REGEX;
  pattern.lastIndex = 0;
  let escaped = "";
  let last = 0;
  while (pattern.test(str)) {
    const i = pattern.lastIndex - 1;
    const ch = str[i];
    escaped += str.substring(last, i) + (ch === "&" ? "&amp;" : ch === '"' ? "&quot;" : "&lt;");
    last = i + 1;
  }
  return escaped + str.substring(last);
}
var current_component = null;
function push(fn) {
  current_component = { p: current_component, c: null, d: null };
}
function pop() {
  var component = (
    /** @type {Component} */
    current_component
  );
  var ondestroy = component.d;
  if (ondestroy) {
    on_destroy.push(...ondestroy);
  }
  current_component = component.p;
}
const BLOCK_OPEN = `<!--${HYDRATION_START}-->`;
const BLOCK_CLOSE = `<!--${HYDRATION_END}-->`;
let on_destroy = [];
function render(component, options = {}) {
  const payload = { out: "", css: /* @__PURE__ */ new Set(), head: { title: "", out: "" } };
  const prev_on_destroy = on_destroy;
  on_destroy = [];
  payload.out += BLOCK_OPEN;
  if (options.context) {
    push();
    current_component.c = options.context;
  }
  component(payload, options.props ?? {}, {}, {});
  if (options.context) {
    pop();
  }
  payload.out += BLOCK_CLOSE;
  for (const cleanup of on_destroy) cleanup();
  on_destroy = prev_on_destroy;
  let head = payload.head.out + payload.head.title;
  for (const { hash, code } of payload.css) {
    head += `<style id="${hash}">${code}</style>`;
  }
  return {
    head,
    html: payload.out,
    body: payload.out
  };
}
function ensure_array_like(array_like_or_iterator) {
  if (array_like_or_iterator) {
    return array_like_or_iterator.length !== void 0 ? array_like_or_iterator : Array.from(array_like_or_iterator);
  }
  return [];
}
function Flat($$payload, $$props) {
  let { n } = $$props;
  const each_array = ensure_array_like(Array.from({ length: n }, (_, i) => i));
  $$payload.out += `<section class="main"><!--[-->`;
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let i = each_array[$$index];
    $$payload.out += `<div class="row">node ${escape_html(i)}</div>`;
  }
  $$payload.out += `<!--]--></section>`;
}
const now = () => globalThis.performance.now();
const round = (x) => Math.round(x * 1e4) / 1e4;
async function measure(fn, { warmup = 5, iterations = 25, setup } = {}) {
  for (let i = 0; i < warmup; i++) {
    const s = setup?.();
    await fn(s);
  }
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const s = setup?.();
    const t0 = now();
    await fn(s);
    samples.push(now() - t0);
  }
  samples.sort((a, b) => a - b);
  const med = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.min(samples.length - 1, Math.ceil(0.95 * samples.length) - 1)];
  return {
    medianMs: round(med),
    p95Ms: round(p95),
    minMs: round(samples[0]),
    maxMs: round(samples[samples.length - 1]),
    samples: samples.length
  };
}
const N_BIG = 1e4;
async function runSSR() {
  let bytes = 0;
  const timing = await measure(
    () => {
      bytes = Buffer.byteLength(render(Flat, { props: { n: N_BIG } }).html, "utf8");
    },
    { iterations: 20, warmup: 5 }
  );
  return {
    nodes: N_BIG,
    ...timing,
    outputBytes: bytes,
    note: "render() of a 10k-node app; output size in bytes"
  };
}
export {
  runSSR
};
