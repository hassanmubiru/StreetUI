/**
 * Server-side DOM node model.
 *
 * A tiny, dependency-free tree of plain objects that mirrors just enough of the
 * browser DOM for StreetUI's renderer to build a tree on the server and
 * serialize it to an HTML string. There is NO browser global here — these are
 * ordinary classes usable in any JavaScript environment (Node, workers, tests).
 *
 * The renderer never touches these types directly; it goes through the
 * `DOMAdapter` interface, and `ServerDOMAdapter` translates adapter calls into
 * operations on this model.
 */

export type ServerNodeKind = 'element' | 'text' | 'comment' | 'fragment' | 'raw';

export interface ServerNode {
  readonly kind: ServerNodeKind;
  parent: ServerParent | null;
}

export type ServerParent = ServerElement | ServerFragment;

/** A minimal inline-style holder mirroring `element.style.setProperty`. */
export class ServerStyle {
  readonly declarations = new Map<string, string>();
  setProperty(name: string, value: string): void {
    this.declarations.set(name, value);
  }
  get isEmpty(): boolean {
    return this.declarations.size === 0;
  }
  toCss(): string {
    return [...this.declarations.entries()].map(([k, v]) => `${k}: ${v}`).join('; ');
  }
}

export class ServerText implements ServerNode {
  readonly kind = 'text' as const;
  parent: ServerParent | null = null;
  data: string;
  constructor(data: string) {
    this.data = data;
  }
}

export class ServerComment implements ServerNode {
  readonly kind = 'comment' as const;
  parent: ServerParent | null = null;
  data: string;
  constructor(data: string) {
    this.data = data;
  }
}

export class ServerFragment implements ServerNode {
  readonly kind = 'fragment' as const;
  parent: ServerParent | null = null;
  readonly children: ServerNode[] = [];
}

/**
 * A pre-serialized, verbatim HTML fragment (v1.7 static SSR plan).
 *
 * Emitted for provably-static subtrees whose HTML the compiler-derived static
 * SSR plan already computed once. Serializing this node copies its stored
 * string directly — it allocates no ServerElement/ServerText, no attribute Map
 * and no children array for the collapsed subtree. The stored `html` is
 * produced by the exact same mount + serialize pipeline as the runtime path, so
 * the output is byte-identical (the v1.7 byte-identity gate proves this).
 *
 * This node is SSR-only: it is created solely via `ServerDOMAdapter.createRawHTML`
 * on the server render path and never appears in a browser build.
 */
export class ServerRawHTML implements ServerNode {
  readonly kind = 'raw' as const;
  parent: ServerParent | null = null;
  readonly html: string;
  constructor(html: string) {
    this.html = html;
  }
}

export class ServerElement implements ServerNode {
  readonly kind = 'element' as const;
  parent: ServerParent | null = null;
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  readonly children: ServerNode[] = [];

  // Lazily-allocated stores. On the 10k-row SSR corpus ~0% of elements carry JS
  // properties or inline styles (measured, §5: 1 of 80,029 elements uses
  // `properties`, 0 use `style`), so eagerly allocating a `properties` Map plus
  // a `ServerStyle` (which itself holds a Map) per element wasted ~240k
  // allocations per /users render — all in the dominant mount phase. These are
  // created on first WRITE via the `properties`/`style` getters; the serializer
  // reads the raw `_properties`/`_style` fields so a READ never forces an
  // allocation. Output is byte-identical: an unset store previously serialized
  // to nothing (empty `properties.has(...)` / `style.isEmpty`), and a null store
  // is skipped the same way.
  _properties: Map<string, unknown> | null = null;
  _style: ServerStyle | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
  }

  /** JS properties set via `setProperty` (e.g. input `value`, `checked`). Allocated on first access. */
  get properties(): Map<string, unknown> {
    return (this._properties ??= new Map());
  }

  /** Inline-style holder mirroring `element.style`. Allocated on first access. */
  get style(): ServerStyle {
    return (this._style ??= new ServerStyle());
  }
}

// ── HTML serialization ─────────────────────────────────────────────────────────

/**
 * HTML "void" elements — self-closing, never given a closing tag or children.
 */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Element properties that should be reflected into the serialized HTML so the
 * hydrated DOM carries the same initial state. `value`/`checked` matter for
 * form controls whose live state is a JS property, not an attribute.
 */
const SERIALIZED_PROPERTIES: Record<string, 'attr' | 'boolean'> = {
  value: 'attr',
  checked: 'boolean',
  selected: 'boolean',
};

/**
 * Precomputed `[name, kind]` pairs of SERIALIZED_PROPERTIES. Hoisted to module
 * scope so `serializeAttributes` does not allocate a fresh entries array for
 * every element serialized (measured hot: ~80k elements on the 10k-row route).
 */
const SERIALIZED_PROPERTY_ENTRIES: ReadonlyArray<readonly [string, 'attr' | 'boolean']> =
  Object.entries(SERIALIZED_PROPERTIES) as Array<[string, 'attr' | 'boolean']>;

// Fast-path escaping. The chained `.replace(/…/g, …)` form makes 3–4 full
// passes and allocates an intermediate string per pass even when nothing needs
// escaping. These variants scan once and, in the overwhelmingly common case of
// no special character, return the input unchanged (zero allocation). Output is
// byte-identical to the chained form (verified over the real SSR corpus).
const TEXT_SPECIAL = /[&<>]/;
const ATTR_SPECIAL = /[&<>"]/;

/** Escape text node content. */
export function escapeHtmlText(value: string): string {
  if (!TEXT_SPECIAL.test(value)) return value;
  let out = '';
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    let esc: string;
    switch (value.charCodeAt(i)) {
      case 38: esc = '&amp;'; break; // &
      case 60: esc = '&lt;'; break;  // <
      case 62: esc = '&gt;'; break;  // >
      default: continue;
    }
    out += value.slice(last, i) + esc;
    last = i + 1;
  }
  return out + value.slice(last);
}

/** Escape a double-quoted attribute value. */
export function escapeHtmlAttr(value: string): string {
  if (!ATTR_SPECIAL.test(value)) return value;
  let out = '';
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    let esc: string;
    switch (value.charCodeAt(i)) {
      case 38: esc = '&amp;'; break;  // &
      case 60: esc = '&lt;'; break;   // <
      case 62: esc = '&gt;'; break;   // >
      case 34: esc = '&quot;'; break; // "
      default: continue;
    }
    out += value.slice(last, i) + esc;
    last = i + 1;
  }
  return out + value.slice(last);
}

function serializeAttributes(el: ServerElement): string {
  const parts: string[] = [];

  for (const [name, value] of el.attributes) {
    if (value === '') {
      parts.push(` ${name}`);
    } else {
      parts.push(` ${name}="${escapeHtmlAttr(value)}"`);
    }
  }

  // Read the raw backing field (may be null): most elements have no JS
  // properties, so skipping the whole loop avoids touching a store that was
  // never allocated (§5).
  const props = el._properties;
  if (props !== null) {
    for (const [name, kind] of SERIALIZED_PROPERTY_ENTRIES) {
      if (!props.has(name)) continue;
      if (el.attributes.has(name)) continue; // an explicit attribute already won
      const raw = props.get(name);
      if (kind === 'boolean') {
        if (raw === true) parts.push(` ${name}`);
      } else {
        if (raw !== undefined && raw !== null) {
          parts.push(` ${name}="${escapeHtmlAttr(String(raw))}"`);
        }
      }
    }
  }

  const style = el._style;
  if (style !== null && !style.isEmpty && !el.attributes.has('style')) {
    parts.push(` style="${escapeHtmlAttr(style.toCss())}"`);
  }

  return parts.join('');
}

/** Serialize a single server node (element/text/comment/fragment/raw) to HTML. */
export function serializeServerNode(node: ServerNode): string {
  switch (node.kind) {
    case 'text':
      return escapeHtmlText((node as ServerText).data);
    case 'comment':
      return `<!--${(node as ServerComment).data}-->`;
    case 'fragment':
      return serializeChildren(node as ServerFragment);
    case 'raw':
      // Verbatim: the string was produced by this same serializer for a static
      // subtree, so it is already correctly escaped. Copy it as-is (§8).
      return (node as ServerRawHTML).html;
    case 'element': {
      const el = node as ServerElement;
      const tag = el.tagName;
      const attrs = serializeAttributes(el);
      if (VOID_ELEMENTS.has(tag)) {
        return `<${tag}${attrs}>`;
      }
      return `<${tag}${attrs}>${serializeChildren(el)}</${tag}>`;
    }
  }
}

/** Serialize the children of an element or fragment (its "inner HTML"). */
export function serializeChildren(node: ServerElement | ServerFragment): string {
  let out = '';
  for (const child of node.children) {
    out += serializeServerNode(child);
  }
  return out;
}
