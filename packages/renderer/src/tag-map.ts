/**
 * Maps semantic node types to HTML tag names.
 */

import type { SemanticNodeType } from '@streetui/core';

const TAG_MAP: Partial<Record<SemanticNodeType, string>> = {
  application: 'div',
  page: 'div',
  section: 'section',
  container: 'div',
  heading: 'h1',
  text: 'span',
  button: 'button',
  input: 'input',
  form: 'form',
  list: 'ul',
  'list-item': 'li',
  image: 'img',
  link: 'a',
  component: 'div',
  slot: 'div',
  fragment: 'div',
  'reactive-list': 'ul',
  // A portal renders as a neutral inline anchor <div> at its declaration site;
  // its children are relocated to a document.body container on the browser
  // (see the portal branch in mount.ts). On the server (no body) it renders
  // inline, so the anchor tag is what SSR/hydration positionally match on.
  portal: 'div',
  // A `head()` node renders as a neutral, empty inline anchor <div> at its
  // declaration site (like a portal anchor). Its actual contribution — title/
  // meta/link/etc. — is applied to `document.head` by `wireHeadBehavior` on the
  // browser, and emitted separately by `renderHead()` on the server. Keeping a
  // one-node/one-element anchor preserves positional hydration.
  head: 'div',
};

export function resolveTag(type: SemanticNodeType): string {
  return TAG_MAP[type] ?? 'div';
}
