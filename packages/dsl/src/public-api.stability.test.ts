/**
 * v1.0 public API contract — @streetui/dsl.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import { streetui, StreetApp, AppBuilder } from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'AppBuilder', 'ContainerBuilderImpl', 'FormBuilderImpl', 'ListBuilderImpl',
  'PageBuilderImpl', 'reactiveListItemKey', 'reactiveListItemSignature',
  'SectionBuilderImpl', 'StreetApp', 'streetui',
] as const;

describe('@streetui/dsl — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it('streetui.app builds an app with a declarable page', () => {
    const app = streetui.app({ name: 'contract' });
    expect(app).toBeDefined();
    app.page('home', (page) => page.heading('Hello'));
    // The entry object exposes the builder factory.
    expect(streetui.app).toBeTypeOf('function');
    expect(AppBuilder).toBeTypeOf('function');
    expect(StreetApp).toBeDefined();
  });
});
