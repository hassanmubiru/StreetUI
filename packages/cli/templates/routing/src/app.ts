/**
 * __PROJECT_NAME__ — routing demo with page navigation.
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

export type PageId = 'home' | 'about' | 'contact';

export interface AppState {
  readonly currentPage: Signal<PageId>;
}

export interface AppSnapshot {
  readonly currentPage: PageId;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    currentPage: signal(seed?.currentPage ?? 'home'),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return { currentPage: state.currentPage.peek() };
}

export function buildApp(page: PageDSL, state: AppState): void {
  page.heading('Routing Demo', { id: 'brand', level: 1 });

  page.section('nav', (nav) => {
    nav.button('Home', {
      id: 'nav-home',
      onClick: () => state.currentPage.set('home'),
    });
    nav.button('About', {
      id: 'nav-about',
      onClick: () => state.currentPage.set('about'),
    });
    nav.button('Contact', {
      id: 'nav-contact',
      onClick: () => state.currentPage.set('contact'),
    });
  }, { id: 'nav' });

  const isHome = derived(() => state.currentPage.get() === 'home');
  const isAbout = derived(() => state.currentPage.get() === 'about');
  const isContact = derived(() => state.currentPage.get() === 'contact');

  page.when(isHome, (c) => {
    c.section('home-content', (section) => {
      section.heading('Welcome Home', { id: 'home-title', level: 2 });
      section.text('This is the home page.', { id: 'home-text' });
    }, { id: 'home-content' });
  });

  page.when(isAbout, (c) => {
    c.section('about-content', (section) => {
      section.heading('About Us', { id: 'about-title', level: 2 });
      section.text('This is the about page.', { id: 'about-text' });
    }, { id: 'about-content' });
  });

  page.when(isContact, (c) => {
    c.section('contact-content', (section) => {
      section.heading('Contact', { id: 'contact-title', level: 2 });
      section.text('This is the contact page.', { id: 'contact-text' });
    }, { id: 'contact-content' });
  });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
