/**
 * DevTools view (2.0 §8) — a DOM-free HTML renderer for a {@link DevToolsSnapshot}.
 *
 * This is the "initial UI" layer: it turns the headless snapshot (already
 * composed from the existing read-only inspectors) into a single self-contained
 * HTML string a host can inject into a panel, an iframe, or a static report. It
 * is deliberately a *pure string builder*:
 *
 *   - No DOM API is touched and nothing is mounted, so it runs anywhere (Node,
 *     a worker, a test) and adds nothing to the running app.
 *   - It reads ONLY the snapshot — no second graph, no reactive subscriptions,
 *     no retained resource/DOM references.
 *   - Every dynamic value is HTML-escaped, so an app's data (signal values that
 *     the caller chose to expose, route paths, form labels) can never break out
 *     of the markup.
 *
 * HONEST SCOPE: this produces markup. Whether it *renders* correctly in a real
 * browser, is accessible to a screen reader, or performs at 60fps is NOT claimed
 * here and has NOT been verified — no browser/AT is available in this
 * environment (the §24 browser gate remains BLOCKED). The value proven by tests
 * is that the string faithfully and safely reflects the snapshot.
 *
 * EFFECTS (§8): StreetUI keeps no global registry of effects (that would require
 * instrumenting the reactive runtime, which DevTools deliberately does not do).
 * The closest safe signal is each live signal's `observerCount` — the number of
 * effects/derivations currently depending on it — which the Signals section
 * shows. The view labels this honestly rather than inventing an effect list.
 */

import type { DevToolsSnapshot } from './panels.js';

/** Escape a string for safe interpolation into HTML text/attribute content. */
export function escapeHtml(value: unknown): string {
  const s = typeof value === 'string' ? value : stringifyValue(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

function section(title: string, count: number | undefined, body: string): string {
  const badge = count === undefined ? '' : ` <span class="st-count">${count}</span>`;
  return `<section class="st-panel"><h2>${escapeHtml(title)}${badge}</h2>${body}</section>`;
}

function ul(items: readonly string[]): string {
  if (items.length === 0) return '<p class="st-empty">(none)</p>';
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

/**
 * Render a snapshot to a complete, self-contained HTML document string. The
 * markup is static; call `renderDevToolsHTML(session.refresh())` again to
 * reflect new state (DevTools pulls — it is never pushed to).
 */
export function renderDevToolsHTML(s: DevToolsSnapshot): string {
  const app = s.application;
  const parts: string[] = [];

  parts.push(
    section(
      'Application',
      undefined,
      `<p>${escapeHtml(app.identity.name)} <span class="st-dim">v${escapeHtml(app.identity.version)}</span></p>` +
        `<p class="st-dim">${app.nodeCount} nodes · depth ${app.maxDepth} · ${app.pages.length} page(s) · ` +
        `${app.signalCount} signals · ${app.eventHandlers} handlers · ${app.stateBindings} bindings</p>`,
    ),
  );

  // Component tree (§9).
  parts.push(
    section(
      'Components',
      s.components.length,
      ul(
        s.components.map(
          (c) =>
            `<span class="st-depth" style="--d:${c.depth}"></span>` +
            `<code>${escapeHtml(c.name)}</code>` +
            (c.key !== undefined ? ` <span class="st-key">#${escapeHtml(c.key)}</span>` : '') +
            ` <span class="st-dim">${c.childCount} child(ren)</span>`,
        ),
      ),
    ),
  );

  // Graph / DOM association (§8): the node tree the components/elements map to.
  parts.push(section('Graph', undefined, `<pre class="st-tree">${escapeHtml(renderNodeTree(s.graph))}</pre>`));

  // Signals + effects-as-observers (§10 / §8-effects).
  parts.push(
    section(
      'Signals',
      s.signals.boundSignalIds.length,
      `<p class="st-dim">${s.signals.boundSignalIds.length} bound in graph · ` +
        `effects shown as observer counts (no global effect registry)</p>` +
        ul(
          Object.entries(s.signals.live).map(
            ([label, sig]) =>
              `<code>${escapeHtml(label)}</code> <span class="st-key">[${escapeHtml(sig.kind)}]</span>` +
              ` = <code>${escapeHtml(sig.value)}</code>` +
              ` <span class="st-dim">observers ${escapeHtml(sig.observerCount ?? '?')}</span>`,
          ),
        ),
    ),
  );

  // Router (§11).
  if (s.router !== undefined) {
    parts.push(
      section(
        'Router',
        undefined,
        `<p><code>${escapeHtml(s.router.path)}</code> <span class="st-dim">(${escapeHtml(s.router.pattern)})` +
          `${s.router.isFallback ? ' · fallback' : ''}</span></p>`,
      ),
    );
  }

  // Resources (§12) — status only; no payloads retained.
  if (s.resources !== undefined) {
    parts.push(
      section(
        'Resources',
        Object.keys(s.resources).length,
        ul(
          Object.entries(s.resources).map(
            ([label, r]) =>
              `<code>${escapeHtml(label)}</code>: ${escapeHtml(r.status)}` +
              (r.loading ? ' <span class="st-dim">(loading)</span>' : '') +
              (r.hasError ? ` <span class="st-err">!${escapeHtml(r.errorName)}</span>` : ''),
          ),
        ),
      ),
    );
  }

  // Overlays (§13) — in containment/graph order.
  parts.push(
    section(
      'Overlays',
      s.overlays.length,
      ul(
        s.overlays.map((o) => {
          const kind = o.modal ? 'modal' : o.menu ? 'menu' : o.takesFocus ? 'focusable' : 'non-modal';
          return (
            `<code>${escapeHtml(o.key ?? o.id)}</code> <span class="st-key">[${kind}]</span> ` +
            `<span class="st-dim">${o.open ? 'open' : 'closed'}` +
            `${o.closeOnEscape ? ' · esc' : ''}${o.restoreFocus ? ' · restore' : ''}</span>`
          );
        }),
      ),
    ),
  );

  // Transitions (§14) — structural, never interfering.
  parts.push(
    section(
      'Transitions',
      s.transitions.length,
      ul(
        s.transitions.map(
          (t) =>
            `<code>${escapeHtml(t.key ?? t.id)}</code> on <code>&lt;${escapeHtml(t.nodeType)}&gt;</code> ` +
            `<span class="st-dim">${t.duration}ms${t.appear ? ' · appear' : ''}</span>`,
        ),
      ),
    ),
  );

  // Forms + i18n, when present.
  if (s.forms !== undefined) {
    parts.push(
      section(
        'Forms',
        Object.keys(s.forms).length,
        ul(
          Object.entries(s.forms).map(
            ([label, f]) =>
              `<code>${escapeHtml(label)}</code>: ${f.valid ? 'valid' : 'invalid'} · ${escapeHtml(f.status)} · ${f.fields.length} field(s)`,
          ),
        ),
      ),
    );
  }
  if (s.i18n !== undefined) {
    const missing = s.i18n.missingKeys;
    parts.push(
      section(
        'i18n',
        undefined,
        `<p><code>${escapeHtml(s.i18n.locale)}</code> of [${s.i18n.locales.map(escapeHtml).join(', ')}]` +
          `${missing !== undefined ? ` <span class="st-dim">· missing ${missing.length}</span>` : ''}</p>`,
      ),
    );
  }

  // Performance (§15) — labelled NOT a production profiler.
  parts.push(
    section(
      'Performance',
      s.performance.diagnostics.length,
      `<p class="st-dim">Structural counts, not runtime timings — not a production profiler.</p>` +
        ul(s.performance.diagnostics.map((d) => `<code>${escapeHtml(d.code)}</code>: ${escapeHtml(d.message)}`)),
    ),
  );

  // Diagnostics (§8).
  parts.push(
    section(
      'Diagnostics',
      s.diagnostics.errors + s.diagnostics.warnings,
      `<p class="st-dim">${s.diagnostics.errors} error(s) · ${s.diagnostics.warnings} warning(s)</p>` +
        ul(s.diagnostics.messages.map((m) => escapeHtml(m))),
    ),
  );

  const title = `StreetUI DevTools — ${escapeHtml(app.identity.name)}`;
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<title>${title}</title><style>${DEVTOOLS_CSS}</style></head>` +
    `<body class="st-devtools"><header class="st-header"><h1>${title} ` +
    `<span class="st-dim">v${escapeHtml(app.identity.version)}</span></h1></header>` +
    `<main>${parts.join('')}</main></body></html>`
  );
}

/** Indented plain-text tree of the inspected graph (id, type, key). */
function renderNodeTree(node: DevToolsSnapshot['graph']): string {
  const lines: string[] = [];
  const walk = (n: DevToolsSnapshot['graph']): void => {
    const indent = '  '.repeat(n.depth);
    const key = n.key !== undefined ? ` #${n.key}` : '';
    lines.push(`${indent}<${n.type}${key}> ${n.id}`);
    for (const c of n.children) walk(c);
  };
  walk(node);
  return lines.join('\n');
}

/** Minimal, self-contained styling for the view. Inlined so there is no asset. */
const DEVTOOLS_CSS = [
  '.st-devtools{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;color:#e6e6e6;background:#1e1e28}',
  '.st-header{padding:12px 16px;border-bottom:1px solid #333;background:#15151c}',
  '.st-header h1{font-size:14px;margin:0}',
  'main{padding:8px 16px}',
  '.st-panel{margin:12px 0;border:1px solid #2c2c38;border-radius:6px;overflow:hidden}',
  '.st-panel h2{font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin:0;padding:6px 10px;background:#23232e}',
  '.st-panel ul{list-style:none;margin:0;padding:6px 10px}',
  '.st-panel li{padding:1px 0}',
  '.st-panel p{margin:6px 10px}',
  '.st-count{background:#3a3a4a;border-radius:10px;padding:0 7px;font-size:11px;float:right}',
  '.st-dim{color:#8a8a9a}.st-key{color:#7db4ff}.st-err{color:#ff8a8a}.st-empty{color:#6a6a7a}',
  '.st-tree{margin:6px 10px;white-space:pre;overflow:auto;color:#c8c8d4}',
  '.st-depth{display:inline-block}.st-depth{width:calc(var(--d,0)*12px)}',
  'code{color:#d7d7e0}',
].join('');
