import { describe, it, expect } from 'vitest';
import {
  resolveTemplateName,
  materialisedName,
  applyTokens,
  isTextFile,
  DEFAULT_TEMPLATE,
  TEMPLATES,
} from './templates.js';

describe('resolveTemplateName', () => {
  it('defaults when none is given', () => {
    expect(resolveTemplateName(undefined)).toBe(DEFAULT_TEMPLATE);
  });

  it('accepts every advertised template', () => {
    for (const name of TEMPLATES) {
      expect(resolveTemplateName(name)).toBe(name);
    }
  });

  it('throws with a helpful list for an unknown template', () => {
    expect(() => resolveTemplateName('angular')).toThrow(/Unknown template/);
  });
});

describe('materialisedName', () => {
  it('un-prefixes the npm-mangled special files', () => {
    expect(materialisedName('_gitignore')).toBe('.gitignore');
    expect(materialisedName('_npmrc')).toBe('.npmrc');
    expect(materialisedName('_package.json')).toBe('package.json');
  });

  it('leaves ordinary file names untouched', () => {
    expect(materialisedName('app.ts')).toBe('app.ts');
    expect(materialisedName('styles.css')).toBe('styles.css');
  });
});

describe('applyTokens', () => {
  it('substitutes project name and framework version everywhere', () => {
    const out = applyTokens('name=__PROJECT_NAME__ ver=__FRAMEWORK_VERSION__ __PROJECT_NAME__', {
      projectName: 'demo',
      frameworkVersion: '0.6.0',
    });
    expect(out).toBe('name=demo ver=0.6.0 demo');
  });
});

describe('isTextFile', () => {
  it('treats known source/text extensions as text', () => {
    expect(isTextFile('app.ts')).toBe(true);
    expect(isTextFile('README.md')).toBe(true);
    expect(isTextFile('styles.css')).toBe(true);
    expect(isTextFile('_gitignore')).toBe(true); // no dotted extension
  });

  it('treats binary-ish files as non-text', () => {
    expect(isTextFile('logo.png')).toBe(false);
    expect(isTextFile('font.woff2')).toBe(false);
  });
});
