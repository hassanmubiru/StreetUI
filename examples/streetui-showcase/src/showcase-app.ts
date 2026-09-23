/**
 * StreetUI Showcase Application
 *
 * A real application built entirely on the StreetUI public API. It exercises
 * the full pipeline for every feature:
 *
 *   StreetUI DSL → Compiler → Semantic Application Graph → Runtime → Renderer → real DOM
 *
 * There is no virtual DOM, no React/Vue/Preact, and no fake backend. All state
 * lives in framework-owned signals; the keyed reconciler patches the real DOM.
 *
 * `createShowcaseApp()` returns the compiled application plus its state signals
 * and a set of imperative actions (the same ones the UI buttons invoke), so the
 * integration tests can drive the app exactly like a user would.
 */

import { signal, derived, type Signal } from '@streetui/state';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { createRuntime } from '@streetui/runtime';
import { createRenderer } from '@streetui/renderer';
import { BrowserDOMAdapter } from '@streetui/dom';

export interface Feature {
  readonly id: number;
  readonly name: string;
}

export interface ShowcaseState {
  readonly count: Signal<number>;
  readonly features: Signal<Feature[]>;
  readonly formName: Signal<string>;
  readonly formEmail: Signal<string>;
  readonly formMessage: Signal<string>;
  readonly submitted: Signal<boolean>;
  readonly showDetails: Signal<boolean>;
  readonly lastEvent: Signal<string>;
}

export interface ShowcaseActions {
  increment(): void;
  decrement(): void;
  reset(): void;
  addFeature(name?: string): void;
  removeLastFeature(): void;
  removeFeatureById(id: number): void;
  reorderFeatures(): void;
  renameFeature(id: number, name: string): void;
  clearFeatures(): void;
  toggleDetails(): void;
  submitForm(): void;
}

/** Minimal email shape check — enough for client-side validation state. */
function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function createShowcaseApp() {
  // ── Reactive state (framework-owned signals) ────────────────────────────────
  const count = signal(0);
  const features = signal<Feature[]>([
    { id: 1, name: 'Core' },
    { id: 2, name: 'Renderer' },
    { id: 3, name: 'Runtime' },
  ]);
  const formName = signal('');
  const formEmail = signal('');
  const formMessage = signal('');
  const submitted = signal(false);
  const showDetails = signal(false);
  const lastEvent = signal('none');

  let nextId = 4;

  // ── Derived display signals ──────────────────────────────────────────────────
  // `text()`/`button()` accept Bindable<string>, so numeric or boolean state is
  // projected to a string through a derived signal (see API-ISSUES.md #1).
  const countText = derived(() => String(count.get()));
  const featureCountText = derived(() => `${features.get().length} package(s)`);
  const toggleLabel = derived(() => (showDetails.get() ? 'Hide details' : 'Show details'));
  const detailsItems = derived<{ id: string; text: string }[]>(() =>
    showDetails.get()
      ? [{
          id: 'details',
          text: 'StreetUI compiles a semantic graph, binds signals in the runtime, and a keyed reconciler patches the real DOM — no virtual DOM.',
        }]
      : [],
  );
  const validationText = derived(() => {
    const n = formName.get().trim();
    const e = formEmail.get().trim();
    const m = formMessage.get().trim();
    if (n === '' || e === '' || m === '') return 'All fields are required.';
    if (!isValidEmail(e)) return 'Please enter a valid email address.';
    return 'Looks good.';
  });
  const isValid = derived(() => validationText.get() === 'Looks good.');
  const submittedText = derived(() =>
    submitted.get() ? `Thanks ${formName.peek()}, your message was submitted.` : '',
  );
  const lastEventText = derived(() => `Last event: ${lastEvent.get()}`);

  // ── Actions (also invoked by the UI event handlers) ──────────────────────────
  const actions: ShowcaseActions = {
    increment() { count.update((n) => n + 1); lastEvent.set('click:increment'); },
    decrement() { count.update((n) => n - 1); lastEvent.set('click:decrement'); },
    reset() { count.set(0); lastEvent.set('click:reset'); },
    addFeature(name = 'New Package') {
      const id = nextId++;
      features.update((arr) => [...arr, { id, name }]);
      lastEvent.set('click:add-feature');
    },
    removeLastFeature() {
      features.update((arr) => arr.slice(0, Math.max(0, arr.length - 1)));
      lastEvent.set('click:remove-feature');
    },
    removeFeatureById(id) {
      features.update((arr) => arr.filter((f) => f.id !== id));
    },
    reorderFeatures() {
      features.update((arr) => (arr.length > 1 ? [...arr.slice(1), arr[0]!] : arr));
      lastEvent.set('click:reorder');
    },
    renameFeature(id, name) {
      features.update((arr) => arr.map((f) => (f.id === id ? { ...f, name } : f)));
      lastEvent.set('click:rename');
    },
    clearFeatures() { features.set([]); lastEvent.set('click:clear'); },
    toggleDetails() { showDetails.update((v) => !v); lastEvent.set('click:toggle-details'); },
    submitForm() {
      lastEvent.set('submit:form');
      submitted.set(isValid.peek());
    },
  };

  // ── DSL definition (the whole app is one page) ───────────────────────────────
  const app = streetui.app({ name: 'StreetUI Showcase', version: '1.0.0' });

  app.page('home', (page) => {
    // Navigation
    page.section('nav', (nav) => {
      nav.heading('StreetUI', { level: 1, id: 'brand' });
      nav.link('Home', { href: '#home', id: 'nav-home' });
      nav.link('Features', { href: '#features', id: 'nav-features' });
      nav.link('GitHub', { href: 'https://example.com', external: true, id: 'nav-github' });
    }, { id: 'navbar' });

    // Hero
    page.section('hero', (hero) => {
      hero.heading('Build UIs from a semantic graph', { level: 1, id: 'hero-title' });
      hero.text(
        'A TypeScript-first framework with its own reactivity and a keyed real-DOM reconciler — no virtual DOM.',
        { id: 'hero-tagline' },
      );
      hero.button('Get started', { id: 'hero-cta', onClick: () => actions.increment() });
    }, { id: 'hero' });

    // Framework description
    page.section('about', (about) => {
      about.heading('Why StreetUI', { level: 2 });
      about.text(
        'Your app compiles into a semantic application graph. The runtime binds signals; the renderer patches only what changed.',
        {},
      );
    }, { id: 'about' });

    // Feature sections
    page.section('features', (fs) => {
      fs.heading('Feature sections', { level: 2 });
      fs.container('feature-reactivity', (c) => {
        c.heading('Framework-owned reactivity', { level: 3 });
        c.text('Signals, derived values, effects and batching ship in @streetui/state.', {});
      });
      fs.container('feature-renderer', (c) => {
        c.heading('Real-DOM renderer', { level: 3 });
        c.text('A keyed reconciler updates the actual DOM and preserves element identity.', {});
      });
    }, { id: 'feature-list' });

    // Interactive counter — reactive value via a derived string signal
    page.section('counter', (c) => {
      c.heading('Interactive counter', { level: 2 });
      c.text(countText, { id: 'counter-value' });
      c.button('Increment', { id: 'btn-increment', onClick: () => actions.increment() });
      c.button('Decrement', { id: 'btn-decrement', onClick: () => actions.decrement() });
      c.button('Reset', { id: 'btn-reset', onClick: () => actions.reset() });
    }, { id: 'counter' });

    // Reactive list — driven by listOf over the `features` signal
    page.section('reactive-list', (c) => {
      c.heading('Reactive list', { level: 2 });
      c.text(featureCountText, { id: 'feature-count' });
      c.listOf('features', features, (item, _i, content) => {
        content.text(item.name, { id: `feature-${item.id}` });
      }, { id: 'features-list' });
      c.button('Add', { id: 'btn-add', onClick: () => actions.addFeature() });
      c.button('Remove', { id: 'btn-remove', onClick: () => actions.removeLastFeature() });
      c.button('Reorder', { id: 'btn-reorder', onClick: () => actions.reorderFeatures() });
      c.button('Update item', {
        id: 'btn-update',
        onClick: () => actions.renameFeature(1, 'Core (updated)'),
      });
      c.button('Clear', { id: 'btn-clear', onClick: () => actions.clearFeatures() });
    }, { id: 'list-demo' });

    // Contact form — controlled inputs, validation state, submitted state
    page.section('contact', (c) => {
      c.heading('Contact form', { level: 2 });
      c.form('contact-form', (form) => {
        form.input({
          id: 'field-name', type: 'text', placeholder: 'Name', value: formName,
          onInput: (v) => { formName.set(v); lastEvent.set('input:name'); },
        });
        form.input({
          id: 'field-email', type: 'email', placeholder: 'Email', value: formEmail,
          onInput: (v) => formEmail.set(v),
          onChange: (v) => { formEmail.set(v); lastEvent.set('change:email'); },
        });
        form.input({
          id: 'field-message', type: 'text', placeholder: 'Message', value: formMessage,
          onInput: (v) => { formMessage.set(v); lastEvent.set('input:message'); },
        });
        form.text(validationText, { id: 'form-validation' });
        form.text(submittedText, { id: 'form-submitted' });
        form.button('Submit', { id: 'btn-submit' });
      }, { id: 'the-form', onSubmit: () => actions.submitForm() });
    }, { id: 'contact' });

    // Conditional rendering — state-controlled via a derived 0/1-item list
    page.section('conditional', (c) => {
      c.heading('Conditional rendering', { level: 2 });
      c.button(toggleLabel, { id: 'btn-toggle', onClick: () => actions.toggleDetails() });
      c.listOf('details', detailsItems, (item, _i, content) => {
        content.text(item.text, { id: 'details-text' });
      }, { id: 'details-region' });
    }, { id: 'conditional' });

    // Events readout
    page.section('events', (c) => {
      c.heading('Events', { level: 2 });
      c.text(lastEventText, { id: 'event-readout' });
    }, { id: 'events' });

    // Footer
    page.section('footer', (c) => {
      c.text('StreetUI Showcase — built entirely with the StreetUI public API.', {
        id: 'footer-text',
      });
    }, { id: 'site-footer' });

  });

  const compiled = compile(app);

  const state: ShowcaseState = {
    count, features, formName, formEmail, formMessage, submitted, showDetails, lastEvent,
  };

  return { compiled, state, actions };
}

export function mountShowcaseApp(container: Element) {
  const { compiled, state, actions } = createShowcaseApp();
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const runtime = createRuntime({ renderer });
  const mounted = runtime.mount(compiled, container);
  return { compiled, state, actions, mounted, unmount: () => mounted.unmount() };
}


