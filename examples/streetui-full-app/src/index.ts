/**
 * Compile the full app for a given set of deps, provided under the app's theme.
 * The ThemeContext must be active while the page builder runs, so we compile
 * inside `ThemeContext.provide(...)`.
 */
import { streetui } from 'streetui';
import { compile, type CompiledApplication } from 'streetui';
import { buildApp } from './app.js';
import { ThemeContext, type AppDeps, type Theme } from './deps.js';

export function compileApp(deps: AppDeps, theme: Theme = { name: 'light' }): CompiledApplication {
  return ThemeContext.provide(theme, () => {
    const app = streetui.app({ name: 'full-app' });
    app.page('home', (page) => buildApp(page, deps));
    return compile(app);
  });
}

export * from './deps.js';
export { buildApp } from './app.js';
