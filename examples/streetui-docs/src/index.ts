/**
 * Browser entry point — mounts the docs app into #app using real browser history.
 */
import { mountDocsApp } from './docs-app.js';

const container = document.getElementById('app');
if (container !== null) {
  mountDocsApp(container);
}
