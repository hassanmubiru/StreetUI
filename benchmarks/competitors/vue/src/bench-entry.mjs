// DEV-ONLY benchmark artifact — Vue browser bench entry. NOT part of the `streetui` runtime.
import { runBrowserScenarios } from './scenarios.mjs';

window.__bench = runBrowserScenarios;
