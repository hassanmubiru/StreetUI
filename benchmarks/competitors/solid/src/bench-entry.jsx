// DEV-ONLY benchmark artifact — Solid browser bench entry. NOT part of the `streetui` runtime.
import { runBrowserScenarios } from './scenarios.jsx';

window.__bench = runBrowserScenarios;
