// DEV-ONLY benchmark artifact — React browser bench entry. NOT part of the `streetui` runtime.
// Loaded by index.html; exposes the scenario runner to Playwright as window.__bench.
import { runBrowserScenarios } from './scenarios.jsx';

window.__bench = runBrowserScenarios;
