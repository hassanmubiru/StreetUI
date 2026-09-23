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

export type ServerNodeKind = 'element' | 'text' | 'comment' | 'fragment';

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

export class ServerElement implements ServerNode {
  readonly kind = 'element' as const;
  parent: ServerParent | null = null;
  readonly tagName: string;
  readonly attributes = new Map<string, string>();
  /** JS properties set via `setProperty` (e.g. input `value`, `checked`). */
  readonly properties = new Map<string, unknown>();
  readonly children: ServerNode[] = [];
  readonly style = new ServerStyle();

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
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

/** Escape text node content. */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape a double-quoted attribute value. */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

  for (const [name, kind] of Object.entries(SERIALIZED_PROPERTIES)) {
    if (!el.properties.has(name)) continue;
    if (el.attributes.has(name)) continue; // an explicit attribute already won
    const raw = el.properties.get(name);
    if (kind === 'boolean') {
      if (raw === true) parts.push(` ${name}`);
    } else {
      if (raw !== undefined && raw !== null) {
        parts.push(` ${name}="${escapeHtmlAttr(String(raw))}"`);
      }
    }
  }

  if (!el.style.isEmpty && !el.attributes.has('style')) {
    parts.push(` style="${escapeHtmlAttr(el.style.toCss())}"`);
  }

  return parts.join('');
}

/** Serialize a single server node (element/text/comment/fragment) to HTML. */
export function serializeServerNode(node: ServerNode): string {
  switch (node.kind) {
    case 'text':
      return escapeHtmlText((node as ServerText).data);
    case 'comment':
      return `<!--${(node as ServerComment).data}-->`;
    case 'fragment':
      return serializeChildren(node as ServerFragment);
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
