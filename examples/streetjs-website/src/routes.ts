import { type PageDSL } from 'streetui';
import {
  heroSection, heroBadge, heroTitle, heroSubtitle, heroActions,
  btnPrimary, btnSecondary, codeBlock, featuresGrid, featureCard,
  featureIcon, featureTitle, featureDesc, sectionHeading, sectionSubheading,
  pageTitle, bodyText, inlineCode, card, cardGrid, mainContent,
} from './design-system.js';

const INSTALL_CODE = `npm install streetui

# Create a new app
npx streetui create my-app
cd my-app && npm install && npm run dev`;

const COUNTER_CODE = `import { signal, streetui, compile, createRuntime, createRenderer, BrowserDOMAdapter } from 'streetui';

const count = signal(0);
const app = streetui.app({ name: 'Counter' });

app.page('home', page => {
  page.heading(count);
  page.button('Increment', { onClick: () => count.update(n => n + 1) });
});

const compiled = compile(app);
const runtime = createRuntime({ renderer: createRenderer({ domAdapter: new BrowserDOMAdapter() }) });
runtime.mount(compiled, document.getElementById('app')!);`;

const SSR_CODE = `import { compile, renderToString, hydrate } from 'streetui';

// Server
const compiled = compile(app);
const html = renderToString(compiled); // → deterministic HTML

// Client (zero re-creation)
hydrate(compiled, document.getElementById('app')!);`;

const ROUTER_CODE = `import { createRouter, mountRouter, routerOutlet } from 'streetui';

const router = createRouter({
  routes: [
    { path: '/',      builder: page => page.heading('Home') },
    { path: '/docs',  builder: page => page.heading('Docs') },
    { path: '*',      builder: page => page.heading('404') },
  ],
});

mountRouter(router, {
  container: document.getElementById('app')!,
  shell: shell => { shell.link('Home', { href: '/' }); routerOutlet(shell); },
});`;

export function homePage(page: PageDSL) {
  page.head({ title: 'StreetUI — TypeScript-first UI Framework', description: 'Build UIs from a semantic graph with fine-grained reactivity and a keyed real-DOM reconciler — no virtual DOM.' });
  page.container('home', (home) => {
    // Hero
    home.container('hero', (h) => {
      h.text('StreetUI 3.0', { id: 'hero-badge', class: heroBadge });
      h.heading('The TypeScript-first UI framework', { level: 1, id: 'hero-title', class: heroTitle });
      h.text('Build UIs from a semantic graph with fine-grained reactivity and a keyed real-DOM reconciler. No virtual DOM. No JSX. No second reactive system.', { id: 'hero-subtitle', class: heroSubtitle });
      h.container('hero-actions', (a) => {
        a.link('Get Started', { href: '/getting-started', id: 'cta-start', class: btnPrimary });
        a.link('View on GitHub', { href: 'https://github.com/streetui/streetui', id: 'cta-github', class: btnSecondary });
      }, { id: 'hero-actions', class: heroActions });
    }, { id: 'hero', class: heroSection });

    // Code example
    home.container('code-section', (cs) => {
      cs.heading('Start in 30 seconds', { level: 2, id: 'code-title', class: sectionHeading });
      cs.code(INSTALL_CODE, { id: 'install-code', class: codeBlock });
    }, { id: 'code-section', class: mainContent });

    // Features
    home.container('features', (f) => {
      f.heading('Everything you need', { level: 2, id: 'features-title', class: sectionHeading });
      f.text('One install. One import. Every layer owned end-to-end.', { id: 'features-sub', class: sectionSubheading });
      f.container('features-grid', (grid) => {
        const features = [
          ['⚡', 'Fine-grained reactivity', 'Signals update only the nodes that subscribe to them — no diffing, no re-renders, no wasted work.'],
          ['🏗️', 'Semantic compiler', 'DSL → Compiler → Semantic Application Graph → Runtime → Direct DOM. A real pipeline, not a transpiler.'],
          ['🌐', 'SSR + hydration', '13.5× faster SSR via static plan acceleration. Zero-node hydration adopts server DOM in place.'],
          ['🛣️', 'Built-in router', 'Client-side routing with dynamic params, query strings, active links, and route lifecycle — no dep.'],
          ['📝', 'Forms & validation', 'Reactive form model built on signals. Synchronous validators. No second state system.'],
          ['♿', 'Accessibility first', 'Focus management, ARIA utilities, live regions, deterministic a11y IDs — all first-class.'],
        ] as const;
        for (const [icon, title, desc] of features) {
          grid.container(`feat-${title.replace(/\s/g,'-').toLowerCase()}`, (fc) => {
            fc.text(icon, { id: `feat-icon-${title.slice(0,4)}`, class: featureIcon });
            fc.heading(title, { level: 3, id: `feat-title-${title.slice(0,4)}`, class: featureTitle });
            fc.text(desc, { id: `feat-desc-${title.slice(0,4)}`, class: featureDesc });
          }, { id: `feat-${title.slice(0,4)}`, class: featureCard });
        }
      }, { id: 'features-grid', class: featuresGrid });
    }, { id: 'features', class: mainContent });
  }, { id: 'home-page' });
}

export function gettingStartedPage(page: PageDSL) {
  page.head({ title: 'Getting Started — StreetUI', description: 'Install StreetUI and build your first app in minutes.' });
  page.container('gs', (gs) => {
    gs.heading('Getting Started', { level: 1, id: 'gs-title', class: pageTitle });
    gs.text('Install StreetUI and build your first reactive app.', { id: 'gs-intro', class: bodyText });

    gs.heading('Installation', { level: 2, id: 'gs-install-title', class: sectionHeading });
    gs.code('npm install streetui', { id: 'gs-install', class: codeBlock });

    gs.heading('Create a new app', { level: 2, id: 'gs-create-title', class: sectionHeading });
    gs.code('npx streetui create my-app\ncd my-app && npm install\nnpm run dev', { id: 'gs-create', class: codeBlock });

    gs.heading('Your first component', { level: 2, id: 'gs-component-title', class: sectionHeading });
    gs.text('StreetUI uses a semantic TypeScript DSL instead of JSX. Here\'s a reactive counter:', { id: 'gs-component-intro', class: bodyText });
    gs.code(COUNTER_CODE, { id: 'gs-counter', class: codeBlock });

    gs.heading('SSR + Hydration', { level: 2, id: 'gs-ssr-title', class: sectionHeading });
    gs.text('Server render and hydrate with zero node recreation:', { id: 'gs-ssr-intro', class: bodyText });
    gs.code(SSR_CODE, { id: 'gs-ssr', class: codeBlock });
  }, { id: 'getting-started', class: mainContent });
}

export function docsPage(page: PageDSL) {
  page.head({ title: 'Documentation — StreetUI', description: 'Complete StreetUI documentation — reactivity, routing, SSR, forms, and more.' });
  page.container('docs', (d) => {
    d.heading('Documentation', { level: 1, id: 'docs-title', class: pageTitle });
    d.text('Everything you need to build production applications with StreetUI.', { id: 'docs-intro', class: bodyText });

    const sections = [
      ['Core Concepts', 'The DSL → Compiler → Graph → Runtime → Renderer pipeline.', '/docs/architecture'],
      ['Reactivity', 'Signals, derived state, effects, and batched updates.', '/docs/reactivity'],
      ['Routing', 'Client-side routing with dynamic params and route lifecycle.', '/docs/routing'],
      ['SSR & Hydration', 'Server rendering with static plan acceleration.', '/docs/ssr'],
      ['Forms', 'Reactive form model with synchronous validators.', '/docs/forms'],
      ['Components', 'First-class components with typed props and lifecycle.', '/docs/components'],
      ['Overlays', 'Portals, dialogs, popovers, tooltips, and toasts.', '/docs/overlays'],
      ['Accessibility', 'Focus management, ARIA utilities, and live regions.', '/docs/accessibility'],
      ['Styling', 'Type-safe CSS-in-JS with design tokens and theming.', '/docs/styling'],
    ] as const;

    d.container('docs-grid', (grid) => {
      for (const [title, desc, href] of sections) {
        grid.container(`doc-${title.replace(/\s/g,'-').toLowerCase()}`, (dc) => {
          dc.heading(title, { level: 3, id: `doc-title-${title.slice(0,5)}`, class: featureTitle });
          dc.text(desc, { id: `doc-desc-${title.slice(0,5)}`, class: featureDesc });
          dc.link('Read →', { href, id: `doc-link-${title.slice(0,5)}`, class: inlineCode });
        }, { id: `doc-${title.slice(0,5)}`, class: featureCard });
      }
    }, { id: 'docs-grid', class: featuresGrid });
  }, { id: 'docs-page', class: mainContent });
}

export function apiPage(page: PageDSL) {
  page.head({ title: 'API Reference — StreetUI', description: 'Complete StreetUI API reference for all public exports.' });
  page.container('api', (a) => {
    a.heading('API Reference', { level: 1, id: 'api-title', class: pageTitle });
    a.text('All public exports from the streetui package.', { id: 'api-intro', class: bodyText });

    const modules = [
      ['Reactivity', ['signal(initialValue)', 'derived(() => expr)', 'effect(() => sideEffect)', 'batch(() => updates)', 'flushSync()']],
      ['DSL & Compiler', ['streetui.app(options)', 'compile(app)', 'page.heading(text, opts)', 'page.text(content, opts)', 'page.button(label, opts)', 'page.link(label, opts)', 'page.input(opts)', 'page.when(condition, builder)', 'page.listOf(key, signal, builder)']],
      ['Renderer', ['createRenderer(options)', 'createRuntime(options)', 'runtime.mount(compiled, el)', 'renderToString(compiled)', 'hydrate(compiled, el)']],
      ['Router', ['createRouter(options)', 'mountRouter(router, options)', 'routerOutlet(scope)', 'createBrowserHistory()', 'createMemoryHistory(path)']],
      ['Forms', ['createForm(options)', 'required()', 'email()', 'minLength(n)', 'maxLength(n)', 'pattern(regex)']],
    ] as const;

    for (const [modName, exports] of modules) {
      a.container(`api-${modName.toLowerCase()}`, (m) => {
        m.heading(modName, { level: 2, id: `api-mod-${modName.toLowerCase()}`, class: sectionHeading });
        for (const exp of exports) {
          m.code(exp, { id: `api-${exp.slice(0,10).replace(/[^a-z]/gi,'-')}`, class: inlineCode });
        }
      }, { id: `api-section-${modName.toLowerCase()}`, class: card });
    }
  }, { id: 'api-page', class: mainContent });
}

export function examplesPage(page: PageDSL) {
  page.head({ title: 'Examples — StreetUI', description: 'Real-world StreetUI examples and code samples.' });
  page.container('examples', (ex) => {
    ex.heading('Examples', { level: 1, id: 'examples-title', class: pageTitle });
    ex.text('Real applications built entirely with StreetUI.', { id: 'examples-intro', class: bodyText });

    ex.heading('Reactive Counter', { level: 2, id: 'ex-counter-title', class: sectionHeading });
    ex.code(COUNTER_CODE, { id: 'ex-counter', class: codeBlock });

    ex.heading('Client-Side Router', { level: 2, id: 'ex-router-title', class: sectionHeading });
    ex.code(ROUTER_CODE, { id: 'ex-router', class: codeBlock });

    ex.heading('SSR + Hydration', { level: 2, id: 'ex-ssr-title', class: sectionHeading });
    ex.code(SSR_CODE, { id: 'ex-ssr', class: codeBlock });
  }, { id: 'examples-page', class: mainContent });
}

export function notFoundPage(page: PageDSL) {
  page.head({ title: '404 — StreetUI' });
  page.container('nf', (nf) => {
    nf.heading('404 — Not Found', { level: 1, id: 'nf-title', class: pageTitle });
    nf.text('The page you are looking for does not exist.', { id: 'nf-body', class: bodyText });
    nf.link('← Back to home', { href: '/', id: 'nf-back', class: btnPrimary });
  }, { id: 'not-found', class: mainContent });
}

export function placeholderPage(title: string) {
  return (page: PageDSL) => {
    page.head({ title: `${title} — StreetUI` });
    page.container('placeholder', (pl) => {
      pl.heading(title, { level: 1, id: 'ph-title', class: pageTitle });
      pl.text('This page is coming soon.', { id: 'ph-body', class: bodyText });
    }, { id: 'placeholder-page', class: mainContent });
  };
}
