import { describe, it, expect } from 'vitest';
import { renderPage } from './server-entry.js';

describe('streetjs-website SSR', () => {
  it('renders the home page', () => {
    const { html, styles } = renderPage('/');
    expect(html).toContain('TypeScript-first UI Framework');
    expect(html).toContain('id="hero-title"');
    expect(styles).toContain('data-streetui-css');
  });

  it('renders getting started page', () => {
    const { html } = renderPage('/getting-started');
    expect(html).toContain('Getting Started');
    expect(html).toContain('npm install streetui');
  });

  it('renders docs page', () => {
    const { html } = renderPage('/docs');
    expect(html).toContain('Documentation');
  });

  it('renders api page', () => {
    const { html } = renderPage('/api');
    expect(html).toContain('API Reference');
    expect(html).toContain('signal(');
  });

  it('renders examples page', () => {
    const { html } = renderPage('/examples');
    expect(html).toContain('Examples');
    expect(html).toContain('counter');
  });

  it('renders 404 for unknown routes', () => {
    const { html } = renderPage('/unknown-route');
    expect(html).toContain('404');
    expect(html).toContain('Not Found');
  });

  it('stylesheet is byte-identical across routes', () => {
    const r1 = renderPage('/');
    const r2 = renderPage('/docs');
    const r3 = renderPage('/api');
    expect(r1.styles).toBe(r2.styles);
    expect(r2.styles).toBe(r3.styles);
  });

  it('shell elements are present on every route', () => {
    for (const path of ['/', '/docs', '/api', '/examples']) {
      const { html } = renderPage(path);
      expect(html).toContain('id="site-header"');
      expect(html).toContain('id="site-footer"');
      expect(html).toContain('id="skip-link"');
    }
  });
});
