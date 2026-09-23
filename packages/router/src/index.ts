/**
 * @streetui/router — client-side routing for StreetUI applications.
 *
 * Public surface:
 *   - createRouter            route table + reactive currentRoute + navigation
 *   - mountRouter             DOM integration (shell + outlet + link interception)
 *   - routerOutlet            declare the outlet inside a shell
 *   - createBrowserHistory    window.history-backed navigation source
 *   - createMemoryHistory     in-memory navigation source (tests / non-DOM)
 *   - matching helpers        matchPattern / matchRoutes / normalizePath
 *   - all router types
 */

export * from './types.js';
export * from './matching.js';
export * from './history.js';
export * from './router.js';
export * from './mount-router.js';
