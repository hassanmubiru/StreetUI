import { hydrate } from 'streetui';
import { createApp } from './app.js';

const app = createApp();
const root = document.getElementById('app');

if (root) {
  hydrate(app, root);
}
