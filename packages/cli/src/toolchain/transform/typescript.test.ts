import { describe, it, expect } from 'vitest';
import { transformModule, collectSpecifiers } from './typescript.js';

describe('TypeScript transform', () => {
  it('collects static and dynamic specifiers', () => {
    const source = `
      import { a } from './a.js';
      export * from './b.js';
      const mod = import('./c.js');
    `;
    const refs = collectSpecifiers(source, 'entry.ts');
    expect(refs.map((r) => r.text)).toContain('./a.js');
    expect(refs.map((r) => r.text)).toContain('./b.js');
    expect(refs.map((r) => r.text)).toContain('./c.js');
    expect(refs.find((r) => r.text === './c.js')?.dynamic).toBe(true);
  });

  it('rewrites resolvable specifiers', () => {
    const result = transformModule(`import { x } from './a.js';\nexport const y = x;`, {
      fileName: 'entry.ts',
      moduleId: '/entry.ts',
      mode: 'development',
      resolve: (spec) => (spec === './a.js' ? { url: '/src/a.ts?t=1', kind: 'ts', id: '/a.ts' } : undefined),
    });
    expect(result.code).toContain("/src/a.ts?t=1");
    expect(result.code).not.toContain("'./a.js'");
  });

  it('inlines process.env.NODE_ENV', () => {
    const result = transformModule(`export const mode = process.env.NODE_ENV;`, {
      fileName: 'e.ts',
      moduleId: '/e.ts',
      mode: 'production',
      resolve: () => undefined,
    });
    expect(result.code).toContain('"production"');
  });

  it('injects a hot context for import.meta.hot', () => {
    const result = transformModule(`if (import.meta.hot) import.meta.hot.accept(() => {});`, {
      fileName: 'h.ts',
      moduleId: '/h.ts',
      mode: 'development',
      resolve: () => undefined,
    });
    expect(result.usesHot).toBe(true);
    expect(result.code).toContain('createHotContext');
    expect(result.code).toContain('__streetui_hot');
  });

  it('rewrites a hot accept dependency to its resolved id', () => {
    const result = transformModule(`import.meta.hot.accept('./app.js', () => {});`, {
      fileName: 'main.ts',
      moduleId: '/main.ts',
      mode: 'development',
      resolve: (spec) => (spec === './app.js' ? { url: '/src/app.ts?t=1', kind: 'ts', id: '/app.ts' } : undefined),
      resolveId: (spec) => (spec === './app.js' ? '/app.ts' : undefined),
    });
    expect(result.code).toContain('/app.ts');
  });

  it('returns syntax diagnostics with positions', () => {
    const result = transformModule(`const x = ;`, {
      fileName: 'bad.ts',
      moduleId: '/bad.ts',
      mode: 'development',
      resolve: () => undefined,
    });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]?.line).toBeTypeOf('number');
  });
});
