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

// __APPEND_MARKER__
