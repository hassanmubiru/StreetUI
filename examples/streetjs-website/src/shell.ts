import { type PageDSL, derived, renderStyles } from 'streetui';
import { routerOutlet, ROUTER_OUTLET_KEY } from 'streetui';
import {
  siteLayout, siteHeader, headerInner, siteLogo, logoAccent,
  headerNav, navLink, themeToggle, siteFooter, footerInner, footerText, skipLink,
  brand,
} from './design-system.js';
import { theme } from './theme.js';

export function websiteShell(page: PageDSL, ctx: { renderOutlet?: () => void } = {}) {
  page.container('site', (site) => {
    // Skip link
    site.link('Skip to content', { href: '#main-content', id: 'skip-link', class: skipLink });

    // Header
    site.container('header', (h) => {
      h.container('header-inner', (hi) => {
        hi.link('Street·UI', { href: '/', id: 'logo', class: siteLogo });
        hi.container('nav', (nav) => {
          const links = [
            ['Docs', '/docs'], ['API', '/api'], ['Examples', '/examples'],
            ['Getting Started', '/getting-started'],
          ] as const;
          for (const [label, href] of links) {
            nav.link(label, { href, id: `nav-${label.toLowerCase().replace(/\s/g,'-')}`, class: navLink });
          }
        }, { id: 'main-nav', class: headerNav, role: 'navigation', ariaLabel: 'Main navigation' });
        hi.button(derived(() => theme.label.get()), {
          id: 'theme-toggle', class: themeToggle,
          ariaLabel: 'Toggle theme',
          onClick: () => theme.cycle(),
        });
      }, { id: 'header-inner', class: headerInner });
    }, { id: 'site-header', class: siteHeader, role: 'banner' });

    // Main content / router outlet
    site.container('main', (main) => {
      if (ctx.renderOutlet) {
        ctx.renderOutlet();
      } else {
        routerOutlet(main, 'main-content');
      }
    }, { id: 'main-content', role: 'main' });

    // Footer
    site.container('footer', (f) => {
      f.container('footer-inner', (fi) => {
        fi.text('Built with StreetUI 3.0.0', { id: 'footer-text', class: footerText });
        fi.link('GitHub', { href: 'https://github.com/streetui/streetui', id: 'footer-github', class: footerText });
      }, { id: 'footer-inner', class: footerInner });
    }, { id: 'site-footer', class: siteFooter, role: 'contentinfo' });
  }, { id: 'site-layout', class: siteLayout });
}
