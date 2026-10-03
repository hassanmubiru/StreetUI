/**
 * StreetUI Stress App — public barrel.
 *
 * The stress app is itself a StreetUI application; these are the pieces a host
 * (browser entry, server, or test) composes.
 */

export {
  createApp,
  mountApp,
  renderApp,
  STATE_KEY,
  OUTLET_ID,
} from './app.js';
export type {
  StressApp,
  StressAppOptions,
  MountedStressApp,
  AppState,
  RenderResult,
  Order,
} from './app.js';
