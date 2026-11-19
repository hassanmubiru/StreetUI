import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { TEMPLATES, templateDir, type TemplateName } from './templates.js';

/** Methods/options that do not exist on the real StreetUI DSL. Any template
 * using them crashes at runtime in generated projects (dev/build do not
 * typecheck, per AGENTS.md in the templates). */
const FORBIDDEN_DSL_TOKENS = [
  'numberInput(',
  'textInput(',
  'emailInput(',
  'rangeInput(',
  'colorInput(',
  'checkbox(',
  'onInput:',
  'onKeydown:',
  'style:',
];

function readAppSource(template: TemplateName): string {
  return readFileSync(`${templateDir(template)}/src/app.ts`, 'utf8');
}

describe('template gallery', () => {
  it('every advertised template exists on disk', () => {
    for (const name of TEMPLATES) {
      expect(existsSync(templateDir(name))).toBe(true);
    }
  });

  it('every template uses only real DSL methods', () => {
    for (const name of TEMPLATES) {
      const src = readAppSource(name);
      for (const token of FORBIDDEN_DSL_TOKENS) {
        expect(src).not.toContain(token);
      }
    }
  });
});
