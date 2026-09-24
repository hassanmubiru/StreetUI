// src/harness.ts
import { performance } from "node:perf_hooks";
import os from "node:os";
var DEFAULTS = { warmup: 8, iterations: 40, inner: 1 };
function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil(p / 100 * sortedAsc.length);
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[idx];
}
function summarize(name, category, n, inner, samplesMs, note) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = count === 0 ? 0 : sum / count;
  const median = count === 0 ? 0 : count % 2 === 1 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
  const min = count === 0 ? 0 : sorted[0];
  const max = count === 0 ? 0 : sorted[count - 1];
  const p95 = percentile(sorted, 95);
  const result = {
    name,
    category,
    n,
    samples: count,
    inner,
    medianMs: median,
    p95Ms: p95,
    minMs: min,
    maxMs: max,
    meanMs: mean,
    opsPerSec: median > 0 ? 1e3 / median : 0
  };
  return note === void 0 ? result : { ...result, note };
}
function bench(name, run, options) {
  const warmup = options.warmup ?? DEFAULTS.warmup;
  const iterations = options.iterations ?? DEFAULTS.iterations;
  const inner = Math.max(1, options.inner ?? DEFAULTS.inner);
  const n = options.n ?? null;
  const once = () => {
    const state = options.setup ? options.setup() : void 0;
    for (let k = 0; k < inner; k++) run(state);
    if (options.teardown) options.teardown(state);
  };
  for (let w = 0; w < warmup; w++) once();
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const state = options.setup ? options.setup() : void 0;
    const t0 = performance.now();
    for (let k = 0; k < inner; k++) run(state);
    const t1 = performance.now();
    if (options.teardown) options.teardown(state);
    samples.push((t1 - t0) / inner);
  }
  return summarize(name, options.category, n, inner, samples, options.note);
}
function environment() {
  const cpus = os.cpus();
  return {
    node: process.version,
    platform: os.platform(),
    osRelease: os.release(),
    arch: os.arch(),
    cpuModel: cpus.length > 0 ? cpus[0].model.trim() : "unknown",
    cpuCount: cpus.length,
    totalMemGB: Math.round(os.totalmem() / 1e9 * 10) / 10,
    capturedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/compare.ts
function compareResults(baseline, current, options = {}) {
  const band = options.band ?? 0.1;
  const baseByName = /* @__PURE__ */ new Map();
  for (const b of baseline) baseByName.set(b.name, b);
  const out = [];
  for (const cur of current) {
    const base = baseByName.get(cur.name);
    if (base === void 0 || base.medianMs <= 0) {
      out.push({
        name: cur.name,
        category: cur.category,
        n: cur.n,
        baselineMs: base?.medianMs ?? null,
        currentMs: cur.medianMs,
        deltaMs: null,
        deltaPct: null,
        status: "new"
      });
      continue;
    }
    const deltaMs = cur.medianMs - base.medianMs;
    const deltaPct = deltaMs / base.medianMs * 100;
    let status = "unchanged";
    if (deltaPct <= -band * 100) status = "improved";
    else if (deltaPct >= band * 100) status = "regressed";
    out.push({
      name: cur.name,
      category: cur.category,
      n: cur.n,
      baselineMs: base.medianMs,
      currentMs: cur.medianMs,
      deltaMs,
      deltaPct,
      status
    });
  }
  return out;
}

// src/report.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function resultsDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "results");
}
function writeSuite(fileName, suite) {
  const dir = resultsDir();
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, fileName);
  fs.writeFileSync(full, JSON.stringify(suite, null, 2) + "\n", "utf8");
  return full;
}
function readSuite(fileName) {
  const full = path.join(resultsDir(), fileName);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}
function pad(s, width) {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}
function padStart(s, width) {
  return s.length >= width ? s : " ".repeat(width - s.length) + s;
}
function formatResults(results) {
  const lines = [];
  lines.push(
    pad("benchmark", 44) + padStart("n", 6) + padStart("median ms", 13) + padStart("p95 ms", 12) + padStart("ops/s", 14)
  );
  lines.push("-".repeat(89));
  for (const r of results) {
    lines.push(
      pad(r.name, 44) + padStart(r.n === null ? "-" : String(r.n), 6) + padStart(r.medianMs.toFixed(4), 13) + padStart(r.p95Ms.toFixed(4), 12) + padStart(r.opsPerSec >= 1 ? Math.round(r.opsPerSec).toLocaleString() : r.opsPerSec.toFixed(2), 14)
    );
  }
  return lines.join("\n");
}
function formatComparison(comparisons) {
  const lines = [];
  lines.push(
    pad("benchmark", 44) + padStart("base ms", 12) + padStart("cur ms", 12) + padStart("delta %", 11) + "  status"
  );
  lines.push("-".repeat(92));
  for (const c of comparisons) {
    const deltaStr = c.deltaPct === null ? "-" : (c.deltaPct >= 0 ? "+" : "") + c.deltaPct.toFixed(1);
    lines.push(
      pad(c.name, 44) + padStart(c.baselineMs === null ? "-" : c.baselineMs.toFixed(4), 12) + padStart(c.currentMs.toFixed(4), 12) + padStart(deltaStr, 11) + "  " + c.status
    );
  }
  return lines.join("\n");
}
function formatEnvironment(suite) {
  const e = suite.environment;
  return [
    `node       ${e.node}`,
    `platform   ${e.platform} ${e.osRelease}`,
    `arch       ${e.arch}`,
    `cpu        ${e.cpuModel} (${e.cpuCount} logical)`,
    `memory     ${e.totalMemGB} GB`,
    `captured   ${e.capturedAt}`
  ].join("\n");
}

// src/apps.ts
import { streetui } from "@streetui/dsl";
import { compile } from "@streetui/compiler";
import { signal } from "@streetui/state";
function makeItems(n, offset = 0) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const id = i + offset;
    out[i] = { id, label: `item-${id}` };
  }
  return out;
}
function buildFlatApp(n) {
  const app = streetui.app({ name: "flat", version: "0.7.0" });
  app.page("home", (page) => {
    page.section("main", (s) => {
      s.heading("Flat benchmark", { level: 1 });
      for (let i = 0; i < n; i++) {
        s.text(`text node ${i}`, { class: "row" });
      }
    });
  });
  return app;
}
function buildReactiveApp(n) {
  const sig = signal("initial");
  const app = streetui.app({ name: "reactive", version: "0.7.0" });
  app.page("home", (page) => {
    page.section("main", (s) => {
      for (let i = 0; i < n; i++) {
        s.text(sig, { class: "bound" });
      }
    });
  });
  return { app, sig };
}
function buildListApp(items) {
  const app = streetui.app({ name: "list", version: "0.7.0" });
  app.page("home", (page) => {
    page.section("main", (s) => {
      s.listOf("rows", items, (item, _i, content) => {
        content.text(item.label, { class: "cell" });
      });
    });
  });
  return app;
}
function buildConditionalApp(cond) {
  const app = streetui.app({ name: "conditional", version: "0.7.0" });
  app.page("home", (page) => {
    page.section("main", (s) => {
      s.when(
        cond,
        (then) => {
          then.heading("Visible", { level: 2 });
          then.text("branch content");
        },
        (els) => {
          els.text("hidden");
        }
      );
    });
  });
  return app;
}
function buildAttrApp(n) {
  const app = streetui.app({ name: "attrs", version: "0.7.0" });
  app.page("home", (page) => {
    page.section("main", (s) => {
      for (let i = 0; i < n; i++) {
        s.input({
          type: "text",
          placeholder: `field ${i}`,
          class: "form-control large",
          ariaLabel: `field ${i}`,
          role: "textbox"
        });
      }
    });
  });
  return app;
}
function compileApp(app) {
  return compile(app);
}

// src/dom-env.ts
import { Window } from "happy-dom";
var installed = false;
function installHappyDom() {
  if (installed) return;
  const win = new Window({ url: "http://localhost/" });
  const g = globalThis;
  g["window"] = win;
  g["document"] = win.document;
  g["Node"] = win.Node;
  g["Element"] = win.Element;
  g["HTMLElement"] = win.HTMLElement;
  g["Text"] = win.Text;
  g["Comment"] = win.Comment;
  g["DocumentFragment"] = win.DocumentFragment;
  g["Event"] = win.Event;
  g["CustomEvent"] = win.CustomEvent;
  installed = true;
}
function freshContainer() {
  return document.createElement("div");
}

// src/suites/compiler.ts
var SIZES = [10, 100, 1e3, 5e3];
function compilerSuite() {
  const results = [];
  for (const n of SIZES) {
    results.push(
      bench(
        `compiler/dsl-build n=${n}`,
        () => {
          buildFlatApp(n);
        },
        { category: "compiler", n, iterations: n >= 1e3 ? 25 : 60 }
      )
    );
  }
  for (const n of SIZES) {
    results.push(
      bench(
        `compiler/compile n=${n}`,
        (app) => {
          compileApp(app);
        },
        {
          category: "compiler",
          n,
          iterations: n >= 1e3 ? 25 : 60,
          setup: () => buildFlatApp(n)
        }
      )
    );
  }
  return results;
}

// src/suites/render.ts
import { createRenderer } from "@streetui/renderer";
var SIZES2 = [10, 100, 1e3, 5e3];
function renderSuite() {
  const results = [];
  const renderer = createRenderer();
  for (const n of SIZES2) {
    results.push(
      bench(
        `render/mount n=${n}`,
        (state) => {
          state.handle = renderer.mount(state.compiled, state.container);
        },
        {
          category: "render",
          n,
          iterations: n >= 1e3 ? 20 : 50,
          setup: () => ({
            compiled: compileApp(buildFlatApp(n)),
            container: freshContainer()
          }),
          teardown: (state) => state.handle?.unmount()
        }
      )
    );
  }
  return results;
}

// src/suites/reactivity.ts
import { signal as signal2, derived, batch } from "@streetui/state";
import { createRenderer as createRenderer2 } from "@streetui/renderer";
var SUBSCRIBERS = [1, 10, 100, 1e3];
var CHAIN_DEPTHS = [10, 100, 500];
function reactivitySuite() {
  const results = [];
  const renderer = createRenderer2();
  for (const n of SUBSCRIBERS) {
    results.push(
      bench(
        `reactivity/update-subscribers n=${n}`,
        (state) => {
          state.toggle = !state.toggle;
          state.sig.set(state.toggle ? "a" : "b");
        },
        {
          category: "reactivity",
          n,
          inner: 10,
          iterations: 40,
          setup: () => {
            const { app, sig } = buildReactiveApp(n);
            const compiled = compileApp(app);
            const handle = renderer.mount(compiled, freshContainer());
            return { sig, handle, toggle: false };
          },
          teardown: (state) => state.handle.unmount()
        }
      )
    );
  }
  for (const depth of CHAIN_DEPTHS) {
    results.push(
      bench(
        `reactivity/derived-chain depth=${depth}`,
        (state) => {
          state.i++;
          state.root.set(state.i);
          state.tail.get();
        },
        {
          category: "reactivity",
          n: depth,
          inner: 50,
          iterations: 40,
          setup: () => {
            const root = signal2(0);
            let cur = root;
            for (let d = 0; d < depth; d++) {
              const prev = cur;
              cur = derived(() => prev.get() + 1);
            }
            cur.get();
            return { root, tail: cur, i: 0 };
          }
        }
      )
    );
  }
  for (const n of [10, 100, 1e3]) {
    results.push(
      bench(
        `reactivity/batch-writes n=${n}`,
        (sigs) => {
          batch(() => {
            for (let i = 0; i < sigs.length; i++) sigs[i].update((v) => v + 1);
          });
        },
        {
          category: "reactivity",
          n,
          inner: 20,
          iterations: 40,
          setup: () => {
            const sigs = [];
            for (let i = 0; i < n; i++) sigs.push(signal2(0));
            return sigs;
          }
        }
      )
    );
  }
  return results;
}

// src/suites/lists.ts
import { signal as signal3 } from "@streetui/state";
import { createRenderer as createRenderer3 } from "@streetui/renderer";
var SIZES3 = [10, 100, 1e3, 5e3];
var TRANSITIONS = {
  append: (base, n) => [...base, ...makeItems(1, n)],
  prepend: (base, n) => [...makeItems(1, n), ...base],
  "remove-last": (base) => base.slice(0, base.length - 1),
  "remove-first": (base) => base.slice(1),
  "insert-middle": (base, n) => {
    const mid = Math.floor(base.length / 2);
    return [...base.slice(0, mid), ...makeItems(1, n), ...base.slice(mid)];
  },
  move: (base) => {
    if (base.length < 2) return [...base];
    const copy = [...base];
    const first = copy[0];
    const last = copy[copy.length - 1];
    copy[0] = last;
    copy[copy.length - 1] = first;
    return copy;
  },
  reverse: (base) => [...base].reverse(),
  "replace-all": (base, n) => makeItems(base.length, n * 10)
};
function iterationsFor(n) {
  if (n >= 5e3) return 15;
  if (n >= 1e3) return 20;
  return 40;
}
function warmupFor(n) {
  return n >= 1e3 ? 3 : 6;
}
function listsSuite() {
  const results = [];
  const renderer = createRenderer3();
  for (const [op, transition] of Object.entries(TRANSITIONS)) {
    for (const n of SIZES3) {
      results.push(
        bench(
          `lists/${op} n=${n}`,
          (state) => {
            state.items.set(state.target);
          },
          {
            category: "keyed-lists",
            n,
            iterations: iterationsFor(n),
            warmup: warmupFor(n),
            setup: () => {
              const base = makeItems(n);
              const items = signal3(base);
              const handle = renderer.mount(compileApp(buildListApp(items)), freshContainer());
              return { items, handle, target: transition(base, n) };
            },
            teardown: (state) => state.handle.unmount()
          }
        )
      );
    }
  }
  return results;
}

// src/suites/attributes.ts
import { applyProp, patchProp } from "@streetui/renderer";
import { BrowserDOMAdapter } from "@streetui/dom";
function attributesSuite() {
  const dom = new BrowserDOMAdapter();
  const results = [];
  const setup = () => ({ el: dom.createElement("div"), i: 0 });
  results.push(
    bench(
      "attributes/set-attribute (title)",
      (s) => {
        applyProp(dom, s.el, "title", `t-${s.i++ & 1}`);
      },
      { category: "attributes", n: null, inner: 500, iterations: 40, setup }
    )
  );
  results.push(
    bench(
      "attributes/set-class",
      (s) => {
        applyProp(dom, s.el, "class", (s.i++ & 1) === 0 ? "a b c" : "d e f");
      },
      { category: "attributes", n: null, inner: 500, iterations: 40, setup }
    )
  );
  results.push(
    bench(
      "attributes/set-style-object",
      (s) => {
        applyProp(dom, s.el, "style", { color: (s.i++ & 1) === 0 ? "red" : "blue", margin: "4px" });
      },
      { category: "attributes", n: null, inner: 300, iterations: 40, setup }
    )
  );
  results.push(
    bench(
      "attributes/set-property (value)",
      (s) => {
        const input = dom.createElement("input");
        applyProp(dom, input, "value", `v-${s.i++ & 1}`);
      },
      { category: "attributes", n: null, inner: 300, iterations: 40, setup }
    )
  );
  results.push(
    bench(
      "attributes/set-text-content",
      (s) => {
        dom.setTextContent(s.el, `text ${s.i++ & 1}`);
      },
      { category: "attributes", n: null, inner: 500, iterations: 40, setup }
    )
  );
  results.push(
    bench(
      "attributes/patch-unchanged (noop)",
      (s) => {
        patchProp(dom, s.el, "title", "same", "same");
      },
      { category: "attributes", n: null, inner: 1e3, iterations: 40, setup }
    )
  );
  return results;
}

// src/suites/events.ts
import { streetui as streetui2 } from "@streetui/dsl";
import { compile as compile2 } from "@streetui/compiler";
import { createRenderer as createRenderer4 } from "@streetui/renderer";
var SIZES4 = [10, 100, 1e3];
function buttonApp(n) {
  let clicks = 0;
  const app = streetui2.app({ name: "events", version: "0.7.0" });
  app.page("home", (page) => {
    page.section("main", (s) => {
      for (let i = 0; i < n; i++) {
        s.button(`btn ${i}`, {
          onClick: () => {
            clicks++;
          }
        });
      }
    });
  });
  return compile2(app);
}
function eventsSuite() {
  const results = [];
  const renderer = createRenderer4();
  for (const n of SIZES4) {
    results.push(
      bench(
        `events/register n=${n}`,
        (state) => {
          state.handle = renderer.mount(state.compiled, state.container);
        },
        {
          category: "events",
          n,
          iterations: n >= 1e3 ? 20 : 50,
          setup: () => ({ compiled: buttonApp(n), container: freshContainer() }),
          teardown: (state) => state.handle?.unmount()
        }
      )
    );
  }
  for (const n of SIZES4) {
    results.push(
      bench(
        `events/dispatch n=${n}`,
        (state) => {
          for (const btn of state.buttons) {
            btn.dispatchEvent(new Event("click", { bubbles: true }));
          }
        },
        {
          category: "events",
          n,
          iterations: 40,
          setup: () => {
            const container = freshContainer();
            const handle = renderer.mount(buttonApp(n), container);
            const buttons = Array.from(container.querySelectorAll("button"));
            return { handle, buttons };
          },
          teardown: (state) => state.handle.unmount()
        }
      )
    );
  }
  for (const n of SIZES4) {
    results.push(
      bench(
        `events/cleanup n=${n}`,
        (state) => {
          state.handle.unmount();
        },
        {
          category: "events",
          n,
          iterations: n >= 1e3 ? 20 : 50,
          setup: () => ({ handle: renderer.mount(buttonApp(n), freshContainer()) })
        }
      )
    );
  }
  return results;
}

// src/suites/conditional.ts
import { signal as signal4 } from "@streetui/state";
import { createRenderer as createRenderer5 } from "@streetui/renderer";
function conditionalSuite() {
  const renderer = createRenderer5();
  return [
    bench(
      "conditional/toggle",
      (state) => {
        state.cond.set(!state.cond.peek());
      },
      {
        category: "conditional",
        n: null,
        inner: 50,
        iterations: 40,
        setup: () => {
          const cond = signal4(true);
          const handle = renderer.mount(compileApp(buildConditionalApp(cond)), freshContainer());
          return { cond, handle };
        },
        teardown: (state) => state.handle.unmount()
      }
    )
  ];
}

// src/suites/unmount.ts
import { signal as signal5 } from "@streetui/state";
import { createRenderer as createRenderer6 } from "@streetui/renderer";
var SIZES5 = [100, 1e3, 5e3];
function unmountSuite() {
  const renderer = createRenderer6();
  const results = [];
  for (const n of SIZES5) {
    results.push(
      bench(
        `unmount/flat n=${n}`,
        (state) => {
          state.handle.unmount();
        },
        {
          category: "unmount",
          n,
          iterations: n >= 1e3 ? 20 : 50,
          setup: () => ({
            handle: renderer.mount(compileApp(buildFlatApp(n)), freshContainer())
          })
        }
      )
    );
  }
  for (const n of SIZES5) {
    results.push(
      bench(
        `unmount/list n=${n}`,
        (state) => {
          state.handle.unmount();
        },
        {
          category: "unmount",
          n,
          iterations: n >= 1e3 ? 20 : 50,
          setup: () => {
            const items = signal5(makeItems(n));
            return { handle: renderer.mount(compileApp(buildListApp(items)), freshContainer()) };
          }
        }
      )
    );
  }
  return results;
}

// src/suites/ssr.ts
import { renderToString } from "@streetui/renderer";
var SIZES6 = [10, 100, 1e3, 5e3];
function ssrSuite() {
  const results = [];
  for (const n of SIZES6) {
    results.push(
      bench(
        `ssr/render-to-string n=${n}`,
        (compiled) => {
          renderToString(compiled);
        },
        {
          category: "ssr",
          n,
          iterations: n >= 1e3 ? 25 : 60,
          setup: () => compileApp(buildFlatApp(n))
        }
      )
    );
  }
  return results;
}

// src/suites/hydration.ts
import { createRenderer as createRenderer7, renderToString as renderToString2 } from "@streetui/renderer";
var SIZES7 = [10, 100, 1e3, 5e3];
function hydrationSuite() {
  const results = [];
  const renderer = createRenderer7();
  for (const n of SIZES7) {
    results.push(
      bench(
        `hydration/hydrate n=${n}`,
        (state) => {
          state.handle = renderer.hydrate(state.compiled, state.container);
        },
        {
          category: "hydration",
          n,
          iterations: n >= 1e3 ? 20 : 50,
          setup: () => {
            const compiled = compileApp(buildFlatApp(n));
            const html = renderToString2(compiled);
            const container = freshContainer();
            container.innerHTML = html;
            return { compiled, container };
          },
          teardown: (state) => state.handle?.unmount()
        }
      )
    );
  }
  return results;
}

// src/index.ts
var SUITES = [
  { name: "compiler", run: compilerSuite },
  { name: "render", run: renderSuite },
  { name: "reactivity", run: reactivitySuite },
  { name: "conditional", run: conditionalSuite },
  { name: "keyed-lists", run: listsSuite },
  { name: "attributes", run: attributesSuite },
  { name: "events", run: eventsSuite },
  { name: "unmount", run: unmountSuite },
  { name: "ssr", run: ssrSuite },
  { name: "hydration", run: hydrationSuite }
];
function runAllSuites(options = {}) {
  const filter = options.filter;
  const results = [];
  for (const suite of SUITES) {
    if (filter !== void 0 && filter.length > 0 && !filter.includes(suite.name)) continue;
    options.onSuite?.(suite.name);
    results.push(...suite.run());
  }
  return { environment: environment(), results };
}
export {
  SUITES,
  bench,
  buildAttrApp,
  buildConditionalApp,
  buildFlatApp,
  buildListApp,
  buildReactiveApp,
  compareResults,
  compileApp,
  environment,
  formatComparison,
  formatEnvironment,
  formatResults,
  freshContainer,
  installHappyDom,
  makeItems,
  readSuite,
  resultsDir,
  runAllSuites,
  summarize,
  writeSuite
};
//# sourceMappingURL=index.js.map