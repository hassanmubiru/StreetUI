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
};

export function resolveTag(type: SemanticNodeType): string {
  return TAG_MAP[type] ?? 'div';
}
