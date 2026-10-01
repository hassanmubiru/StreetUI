/**
 * StreetUI Website — public barrel for the example package.
 *
 * The website is itself a StreetUI application; these are the pieces a host
 * (browser entry, server, or test) composes.
 */

export { createWebsite, mountWebsite } from './website.js';
export type { Website, MountedWebsite, WebsiteOptions } from './website.js';
export { buildRoutes } from './routes.js';
export type { RoutesDeps } from './routes.js';
export { websiteShell, createSearchState } from './shell.js';
export type { ShellContext, SearchState } from './shell.js';
export { createTheme } from './theme.js';
export type { ThemeController, ThemeChoice, ResolvedTheme, ThemeStorage } from './theme.js';
export { createPlaygroundState, buildPlayground } from './playground.js';
export type { PlaygroundState, DemoId } from './playground.js';
export { renderWebsite, STATE_KEY } from './server-entry.js';
export * from './content.js';
