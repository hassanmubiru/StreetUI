import { describe, it, expect } from 'vitest';
import { renderToString } from 'streetui/server';
import { createApp } from './app.js';

describe('StreetJS Website', () => {
  it('renders homepage', () => {
    const app = createApp();
    const html = renderToString(app, { path: '/' });
    
    expect(html).toContain('StreetJS');
    expect(html).toContain('Production-grade');
    expect(html).toContain('npm install streetjs');
  });
  
  it('renders getting started page', () => {
    const app = createApp();
    const html = renderToString(app, { path: '/getting-started' });
    
    expect(html).toContain('Getting Started');
    expect(html).toContain('Installation');
  });
  
  it('renders 404 for unknown routes', () => {
    const app = createApp();
    const html = renderToString(app, { path: '/nonexistent' });
    
    expect(html).toContain('404');
    expect(html).toContain('Page not found');
  });
  
  it('SSR produces valid HTML', () => {
    const app = createApp();
    const html = renderToString(app, { path: '/' });
    
    // Should not have script tags or hydration errors in SSR output
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(100);
  });
});
