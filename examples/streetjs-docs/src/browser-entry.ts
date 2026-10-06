import { mountRouter, styleRegistry, adoptServerStyles, renderStyles } from 'streetui';
import { BrowserDOMAdapter } from 'streetui';
import { createClientApp } from './app.js';
import { websiteShell } from './shell.js';
import { theme } from './theme.js';

const container = document.getElementById('app')!;
const hasSSR = !!container.querySelector('[data-streetui-css]');

// Apply theme
theme.set(theme.choice.get());

// Install or adopt styles
if (hasSSR) {
  adoptServerStyles(new BrowserDOMAdapter(), null, { registry: styleRegistry });
} else {
  const sheet = renderStyles({ registry: styleRegistry });
  if (sheet) {
    const style = document.createElement('style');
    style.setAttribute('data-streetui-css', '');
    style.textContent = sheet;
    document.head.appendChild(style);
  }
}

const router = createClientApp();
mountRouter(router, {
  container,
  outletId: 'main-content',
  hydrate: hasSSR,
  shell: (page) => {
    const { default: websiteShellFn } = { default: websiteShell };
    websiteShellFn(page);
  },
});
