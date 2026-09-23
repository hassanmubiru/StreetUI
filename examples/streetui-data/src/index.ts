/**
 * Browser entry for the StreetUI Data example.
 *
 * Mounts the data-driven application against the page origin, so it fetches
 * from a real `GET /api/products` served by whatever host is serving the page.
 * No product data is hardcoded in the UI — it is always fetched over HTTP.
 */

import { mountDataApp } from './data-app.js';

export * from './data-app.js';
export * from './api-server.js';

const root = document.getElementById('app');
if (root !== null) {
  mountDataApp(root, { baseUrl: window.location.origin });
}
