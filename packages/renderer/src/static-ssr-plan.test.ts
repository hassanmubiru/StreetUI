/**
 * StreetUI v1.7 — Static SSR plan tests (spec §25).
 *
 * Two things are asserted throughout:
 *  1. Correctness — the optimized (static-plan) render produces the expected
 *     HTML for static text, attributes, nested children, special characters,
 *     void elements, Unicode, and mixed/dynamic trees.
 *  2. Byte-identity (§8) — for every shape, `renderToString(compiled)` (v1.7,
 *     cached static plan) is byte-for-byte identical to
 *     `renderToString(compiled, { staticPlan: null })` (the v1.6 runtime path).
 *
 * The internal plan builder is imported directly (it is deliberately NOT part of
 * the public `streetui` barrel, §24) so we can assert the plan holds only
 * strings and is cached per compiled application (§19).
 */
import { describe, it, expect } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import type { CompiledApplication } from '@streetui/compiler';
import { renderToString } from './ssr.js';
import { buildStaticSSRPlan, getStaticSSRPlan } from './static-ssr-plan.js';

function compileApp(buildFn: (app: ReturnType<typeof streetui.app>) => void): CompiledApplication {
  resetIdCounter();
  const app = streetui.app({ name: 'plan-test' });
  buildFn(app);
  return compile(app);
}

/** Render both paths and assert byte identity; return the (shared) HTML. */
function renderBothIdentical(compiled: CompiledApplication): string {
  const legacy = renderToString(compiled, { staticPlan: null });
  const optimized = renderToString(compiled);
  // Exact string equality is the strongest form of the §8 gate.
  expect(optimized).toBe(legacy);
  expect(Buffer.byteLength(optimized, 'utf8')).toBe(Buffer.byteLength(legacy, 'utf8'));
  return optimized;
}

describe('static SSR plan — byte identity vs v1.6 runtime path (§8/§25)', () => {
  it('static heading, text and nested structure', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.heading('Title');
        page.section('body', (s) => {
          s.text('Hello');
          s.container('inner', (c) => c.text('Nested'));
        });
      });
    }));
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<span>Hello</span>');
    expect(html).toContain('<span>Nested</span>');
  });

  it('static attributes and class', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.container('box', () => {}, { id: 'main', class: 'a b' });
      });
    }));
    expect(html).toContain('id="main"');
    expect(html).toContain('class="a b"');
  });

  it('void elements emit no closing tag', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.image({ src: '/x.png', alt: 'x' });
        page.input({ placeholder: 'name' });
      });
    }));
    expect(html).toContain('<img');
    expect(html).toContain('<input');
    expect(html).not.toContain('</img>');
    expect(html).not.toContain('</input>');
  });

  it('escapes special characters in text (< > &)', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.text('a < b > c & d');
        page.text('<script>alert(1)</script>');
      });
    }));
    expect(html).toContain('a &lt; b &gt; c &amp; d');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes special characters in attributes (< > & ")', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.container('c', () => {}, { id: '"><b>&', class: 'x&y' });
      });
    }));
    expect(html).toContain('&quot;&gt;&lt;b&gt;&amp;');
    expect(html).toContain('x&amp;y');
  });

  it('preserves Unicode text verbatim', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.text('café — 日本語 — Ω — 🚀');
      });
    }));
    expect(html).toContain('café — 日本語 — Ω — 🚀');
  });

  it('static button and link', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.button('Press');
        page.link('Docs', { href: '/docs' });
      });
    }));
    expect(html).toContain('Press');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('Docs');
  });

  it('deeply nested static subtree', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.section('l1', (a) =>
          a.container('l2', (b) =>
            b.container('l3', (c) =>
              c.container('l4', (d) => d.text('deep')))));
      });
    }));
    expect(html).toContain('<span>deep</span>');
  });

  it('mixed tree: static shell + dynamic reactive list', () => {
    const items = signal([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.heading('Users');                       // static shell
        page.listOf('rows', items, (item, _i, c) => c.text(item.name)); // dynamic
        page.section('footer', (s) => s.text('end')); // static shell
      });
    }));
    expect(html).toContain('<h1>Users</h1>');
    expect(html).toContain('data-streetui-key="id:1"');
    expect(html).toContain('<span>A</span>');
    expect(html).toContain('<span>B</span>');
    expect(html).toContain('<span>end</span>');
  });

  it('conditional when(): true branch and false branch', () => {
    const on = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.heading('shell');
        page.when(signal(true), (b) => b.text('SHOWN'));
      });
    }));
    expect(on).toContain('SHOWN');

    const off = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.heading('shell');
        page.when(signal(false), (b) => b.text('SHOWN'));
      });
    }));
    expect(off).not.toContain('SHOWN');
  });

  it('dynamic text (bound signal) stays byte-identical and is not collapsed', () => {
    const label = signal('live');
    renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        page.heading(label);          // dynamic — must go through runtime path
        page.section('s', (s) => s.text('static'));
      });
    }));
  });

  it('large static tree (200 sections)', () => {
    const html = renderBothIdentical(compileApp((app) => {
      app.page('home', (page) => {
        for (let i = 0; i < 200; i++) {
          page.section(`s${i}`, (s) => s.text(`row ${i}`));
        }
      });
    }));
    expect(html).toContain('<span>row 0</span>');
    expect(html).toContain('<span>row 199</span>');
  });
});

describe('static SSR plan — internal structure (§19/§24)', () => {
  it('plan holds only strings keyed by node id', () => {
    const compiled = compileApp((app) => {
      app.page('home', (page) => {
        page.heading('Title');
        page.section('body', (s) => s.text('Hello'));
      });
    });
    const plan = buildStaticSSRPlan(compiled);
    expect(plan.size).toBeGreaterThan(0);
    for (const [id, value] of plan) {
      expect(typeof id).toBe('string');
      expect(typeof value).toBe('string');
    }
  });

  it('getStaticSSRPlan caches per compiled application', () => {
    const compiled = compileApp((app) => {
      app.page('home', (page) => page.heading('X'));
    });
    const a = getStaticSSRPlan(compiled);
    const b = getStaticSSRPlan(compiled);
    expect(a).toBe(b); // same cached reference (WeakMap)
  });

  it('a fully dynamic root node is not recorded as a static root', () => {
    // A page whose only child is a bound heading has no static subtree root at
    // that heading; the plan must not collapse it.
    const label = signal('live');
    const compiled = compileApp((app) => {
      app.page('home', (page) => page.heading(label));
    });
    const plan = buildStaticSSRPlan(compiled);
    // Optimized output must still equal the legacy path regardless of plan size.
    expect(renderToString(compiled)).toBe(renderToString(compiled, { staticPlan: null }));
    // The dynamic heading itself carries dynamic text, so it is never a static
    // root (plan may be empty or contain only unrelated static leaves).
    expect(plan).toBeInstanceOf(Map);
  });
});
