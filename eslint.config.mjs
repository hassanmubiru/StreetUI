import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      'examples/streetjs-website/netlify-static/**',
      'examples/streetjs-website/netlify/functions/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // These public DSL interfaces intentionally preserve distinct names while
      // inheriting the same builder surface.
      '@typescript-eslint/no-empty-object-type': 'off',
      // The renderer/runtime uses a stable instance reference for returned handles.
      '@typescript-eslint/no-this-alias': 'off',
      // Existing tests intentionally import public values to exercise package
      // resolution and export shape; unused imports are not a correctness gate.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
