import { hydrate } from 'streetui';
import { createApp } from './app.js';
import { initializeTheme } from './theme.js';

// Initialize theme before hydration
initializeTheme();

const app = createApp();
const root = document.getElementById('app');

if (root) {
  hydrate(app, root);
}
