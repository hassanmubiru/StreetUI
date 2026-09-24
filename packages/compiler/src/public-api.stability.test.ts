/**
 * v1.0 public API contract — @streetui/compiler.
 */
import { describe, it, expect } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import * as API from './index.js';
import { compile, compileGraph, transformGraph, validateGraph } from './index.js';

const FROZEN_VALUE_EXPORTS = ['compile', 'compileGraph', 'transformGraph', 'validateGraph'] as const;

describe('@streetui/compiler — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value as a function', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeTypeOf('function');
    }
  });

  it('compile turns a DSL app into a compiled application', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'compiled' });
    app.page('home', (page) => page.heading('Title'));
    const compiled = compile(app);
    expect(compiled).toBeDefined();
    expect(compiled.graph).toBeDefined();
  });
});
