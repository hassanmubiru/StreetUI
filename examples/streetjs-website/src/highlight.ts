/**
 * StreetJS website — a tiny, dependency-free TypeScript highlighter.
 *
 * It tokenizes a code string into a flat list of `{ text, kind }` spans so the
 * builder can render each span with a design-system token colour. It is
 * deterministic (same input → same tokens on server and client), does no I/O,
 * and adds no dependency. It is deliberately small: enough to make real
 * StreetJS examples readable, not a full TS parser.
 */

import type { CodeTokenKind } from './design-system.js';

export interface CodeToken {
  readonly text: string;
  readonly kind: CodeTokenKind;
}

const KEYWORDS = new Set([
  'import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'class',
  'extends', 'implements', 'interface', 'type', 'enum', 'new', 'await', 'async', 'if',
  'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'throw', 'try',
  'catch', 'finally', 'this', 'super', 'public', 'private', 'protected', 'readonly',
  'static', 'get', 'set', 'void', 'as', 'in', 'of', 'typeof', 'instanceof', 'true',
  'false', 'null', 'undefined', 'default', 'yield', 'declare', 'namespace', 'keyof',
]);

const WORD = /[A-Za-z_$][\w$]*/y;
const NUMBER = /\d[\d_]*(?:\.\d+)?(?:n)?/y;
const LINE_COMMENT = /\/\/[^\n]*/y;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//y;
const DECORATOR = /@[A-Za-z_]\w*/y;
const WS = /\s+/y;

function stringAt(src: string, i: number): string | null {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== '`') return null;
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === q) { j += 1; break; }
    j += 1;
  }
  return src.slice(i, j);
}

/** Tokenize TypeScript/JavaScript source for display highlighting. */
export function highlightTs(src: string): CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;
  const push = (text: string, kind: CodeTokenKind): void => {
    if (text.length === 0) return;
    const last = out[out.length - 1];
    if (last !== undefined && last.kind === kind) {
      out[out.length - 1] = { text: last.text + text, kind };
    } else {
      out.push({ text, kind });
    }
  };
  const tryRe = (re: RegExp): string | null => {
    re.lastIndex = i;
    const m = re.exec(src);
    return m !== null && m.index === i ? m[0] : null;
  };

  while (i < src.length) {
    let m: string | null;
    if ((m = tryRe(WS)) !== null) { push(m, 'plain'); i += m.length; continue; }
    if ((m = tryRe(LINE_COMMENT)) !== null) { push(m, 'comment'); i += m.length; continue; }
    if ((m = tryRe(BLOCK_COMMENT)) !== null) { push(m, 'comment'); i += m.length; continue; }
    m = stringAt(src, i);
    if (m !== null) { push(m, 'string'); i += m.length; continue; }
    if ((m = tryRe(DECORATOR)) !== null) { push(m, 'decorator'); i += m.length; continue; }
    if ((m = tryRe(NUMBER)) !== null) { push(m, 'number'); i += m.length; continue; }
    if ((m = tryRe(WORD)) !== null) {
      let j = i + m.length;
      while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j += 1;
      const isCall = src[j] === '(';
      const kind: CodeTokenKind = KEYWORDS.has(m) ? 'keyword'
        : /^[A-Z]/.test(m) ? 'type'
        : isCall ? 'fn'
        : 'plain';
      push(m, kind);
      i += m.length;
      continue;
    }
    push(src[i] ?? '', 'punct');
    i += 1;
  }
  return out;
}
