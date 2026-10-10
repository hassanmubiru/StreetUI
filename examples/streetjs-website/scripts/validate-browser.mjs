/**
 * Browser validation harness for the StreetJS website.
 * Runs axe-core accessibility audit + visual/interaction checks in Chrome and Firefox.
 * Outputs JSON to --out flag.
 *
 * Usage:
 *   node scripts/validate-browser.mjs --base=http://127.0.0.1:4173 --out=validation-results.json
 */
import pkg from '/home/error51/Downloads/StreetUI/benchmarks/node_modules/playwright/index.js';
const { chromium, firefox } = pkg;
import { readFileSync, writeFileSync } from 'fs';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);
const BASE = args.base || 'http://127.0.0.1:4173';
const OUT = args.out || '/tmp/validation-results.json';

const AXE_PATH = '/home/error51/Downloads/StreetUI/benchmarks/node_modules/axe-core/axe.min.js';
const axeScript = readFileSync(AXE_PATH, 'utf8');

// Playwright firefox binary (1538 available in this environment)
const FIREFOX_BINARY = '/home/error51/.cache/ms-playwright/firefox-1538/firefox/firefox';

const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/docs', label: 'Docs index' },
  { path: '/docs/http', label: 'Docs: http' },
  { path: '/docs/routing', label: 'Docs: routing' },
  { path: '/docs/components', label: 'Docs: components' },
  { path: '/guides', label: 'Guides index' },
  { path: '/guides/getting-started', label: 'Guide: getting-started' },
  { path: '/blog', label: 'Blog index' },
  { path: '/playground', label: 'Playground' },
  { path: '/nope-404', label: '404 page' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 375,  height: 812 },
];

async function runAxe(page) {
  await page.addScriptTag({ content: axeScript });
  const result = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    });
  });
  return {
    violations: result.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      selectors: v.nodes.slice(0, 3).map(n => n.target.join(' > ')),
    })),
    passes: result.passes.length,
    incomplete: result.incomplete.length,
    inapplicable: result.inapplicable.length,
  };
}

async function checkInteractions(page) {
  const results = [];

  // 1. Home h1 present
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('#page-outlet h1');
  const h1Home = await page.$eval('#page-outlet h1', el => el.textContent.trim());
  results.push({ check: 'Home h1 present', pass: h1Home.length > 0, detail: h1Home });

  // 2. Client navigation via nav link to /docs
  const docsLink = await page.$('a[href="/docs"]');
  if (docsLink) {
    await docsLink.click();
    await page.waitForSelector('#page-outlet h1');
    const h1Docs = await page.$eval('#page-outlet h1', el => el.textContent.trim());
    results.push({ check: 'Client nav to /docs', pass: h1Docs.length > 0, detail: h1Docs });
  } else {
    results.push({ check: 'Client nav to /docs', pass: false, detail: 'nav link not found' });
  }

  // 3. Mobile menu (375px) — check if hamburger/toggle exists, or nav is hidden/shown
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('#page-outlet h1');

  // Dump mobile HTML to see what selectors exist
  const mobileMenuInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent.trim().slice(0, 30),
      ariaLabel: b.getAttribute('aria-label'),
      id: b.id,
      className: b.className,
    }));
    const nav = document.querySelector('nav');
    const navVisible = nav ? (getComputedStyle(nav).display !== 'none' && nav.offsetWidth > 0) : false;
    return { buttons, navVisible };
  });

  // Try to find a hamburger/menu button
  const menuBtn = await page.$('[aria-label*="menu" i], [aria-label*="nav" i], #nav-toggle, #mobile-toggle, .hamburger, button[aria-expanded]');
  if (menuBtn) {
    await menuBtn.click();
    await page.waitForTimeout(200);
    const navOpenState = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return 'no nav';
      const visible = getComputedStyle(nav).display !== 'none' && nav.offsetHeight > 0;
      return visible ? 'visible' : 'hidden';
    });
    results.push({ check: 'Mobile menu toggle', pass: navOpenState === 'visible', detail: `after click: ${navOpenState}` });
  } else if (mobileMenuInfo.navVisible) {
    results.push({ check: 'Mobile menu toggle', pass: true, detail: 'nav always visible at mobile (no toggle needed)' });
  } else {
    results.push({ check: 'Mobile menu toggle', pass: false, detail: `no toggle found; buttons: ${JSON.stringify(mobileMenuInfo.buttons.slice(0,3))}` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // 4. Theme toggle — inspect actual markup
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('#page-outlet h1');

  const themeInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent.trim().slice(0, 30),
      ariaLabel: b.getAttribute('aria-label'),
      id: b.id,
      className: b.className,
    }));
    const htmlTheme = document.documentElement.getAttribute('data-theme');
    return { buttons, htmlTheme };
  });

  const themeBtn = await page.$(
    '#theme-toggle, .theme-toggle, [data-theme-toggle], [aria-label*="theme" i], [aria-label*="dark" i], [aria-label*="light" i], [aria-label*="color" i]'
  );
  if (themeBtn) {
    const themeBefore = await page.$eval('html', el => el.getAttribute('data-theme'));
    await themeBtn.click();
    await page.waitForTimeout(150);
    const themeAfter = await page.$eval('html', el => el.getAttribute('data-theme'));
    results.push({ check: 'Theme toggle changes data-theme', pass: themeBefore !== themeAfter, detail: `${themeBefore} → ${themeAfter}` });
  } else {
    // Look at all buttons to see if any is theme-related
    const themeCandidates = themeInfo.buttons.filter(b =>
      /theme|dark|light|mode|sun|moon/i.test(b.text + (b.ariaLabel || '') + b.className)
    );
    if (themeCandidates.length > 0) {
      results.push({ check: 'Theme toggle changes data-theme', pass: false, detail: `candidates: ${JSON.stringify(themeCandidates)}` });
    } else {
      results.push({ check: 'Theme toggle changes data-theme', pass: false, detail: `no theme button found; data-theme=${themeInfo.htmlTheme}; buttons: ${JSON.stringify(themeInfo.buttons.slice(0,5))}` });
    }
  }

  // 5. Search dialog opens (Ctrl+K)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('#page-outlet h1');
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  const searchInfo = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const any = document.querySelector('.search-dialog, #search-dialog, [data-search-open]');
    return {
      dialogRole: dialog ? { tagName: dialog.tagName, ariaLabel: dialog.getAttribute('aria-label'), visible: dialog.offsetWidth > 0 } : null,
      anySearch: any ? any.className : null,
    };
  });
  const searchOpen = searchInfo.dialogRole?.visible || searchInfo.anySearch !== null;
  results.push({ check: 'Search opens on Ctrl+K', pass: searchOpen, detail: JSON.stringify(searchInfo) });
  if (searchOpen) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }

  // 6. Skip link present
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('#page-outlet h1');
  const skipLinkInfo = await page.evaluate(() => {
    const candidates = ['a[href="#main-content"]', 'a[href="#content"]', 'a.skip-link', 'a[href="#main"]'];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return { found: true, href: el.href, text: el.textContent.trim() };
    }
    return { found: false };
  });
  results.push({ check: 'Skip link present', pass: skipLinkInfo.found, detail: JSON.stringify(skipLinkInfo) });

  // 7. :focus-visible ring in stylesheet
  const focusVisibleDefined = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes('focus-visible')) return true;
          // Also check @media blocks
          if (rule.cssRules) {
            for (const inner of rule.cssRules) {
              if (inner.selectorText && inner.selectorText.includes('focus-visible')) return true;
            }
          }
        }
      } catch (e) {}
    }
    return false;
  });
  results.push({ check: ':focus-visible ring in stylesheet', pass: focusVisibleDefined, detail: focusVisibleDefined ? 'defined' : 'not found' });

  // 8. Direct URL /docs loads (not SPA-only)
  await page.goto(`${BASE}/docs`, { waitUntil: 'networkidle', timeout: 15000 });
  const docsH1 = await page.$eval('#page-outlet h1', el => el.textContent.trim()).catch(() => null);
  results.push({ check: 'Direct URL /docs loads (SSR)', pass: docsH1 !== null && docsH1.length > 0, detail: docsH1 });

  // 9. Refresh on /playground
  await page.goto(`${BASE}/playground`, { waitUntil: 'networkidle', timeout: 15000 });
  const pgH1 = await page.$eval('#page-outlet h1', el => el.textContent.trim()).catch(() => null);
  results.push({ check: 'Direct URL /playground loads (SSR)', pass: pgH1 !== null && pgH1.length > 0, detail: pgH1 });

  return results;
}

async function runBrowser(browserType, name, browserOptions = {}) {
  console.log(`\n=== ${name} ===`);
  const browser = await browserType.launch({ headless: true, ...browserOptions });
  const results = {
    browser: name,
    axe: {},
    visualRoutes: {},
    reducedMotion: {},
    interactions: [],
  };

  // --- axe-core: use bypassCSP context ---
  console.log('  Running axe-core (bypass CSP)...');
  for (const route of ROUTES) {
    // bypassCSP allows injecting axe-core script despite CSP header
    const ctx = await browser.newContext({ bypassCSP: true });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      const res = await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      const status = res ? res.status() : 0;
      await page.waitForSelector('body', { timeout: 5000 });
      const axeResult = await runAxe(page);
      results.axe[route.path] = { label: route.label, status, ...axeResult };
      const vCount = axeResult.violations.length;
      const critCount = axeResult.violations.filter(v => v.impact === 'critical').length;
      console.log(`    ${route.path}: status=${status} violations=${vCount} (${critCount} critical) passes=${axeResult.passes}`);
      if (vCount > 0) {
        for (const v of axeResult.violations) {
          console.log(`      [${v.impact}] ${v.id}: ${v.help}`);
        }
      }
    } catch (e) {
      results.axe[route.path] = { label: route.label, error: e.message };
      console.log(`    ${route.path}: ERROR ${e.message}`);
    }
    await ctx.close();
  }

  // --- Visual route check across viewports ---
  console.log('  Visual route check...');
  for (const vp of VIEWPORTS) {
    results.visualRoutes[vp.name] = {};
    for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      try {
        const res = await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        const status = res ? res.status() : 0;
        const title = await page.title();
        const h1 = await page.$eval('#page-outlet h1', el => el.textContent.trim()).catch(() => null);
        const bodyVisible = await page.evaluate(() => document.body.offsetHeight > 0);
        const noScrollIssue = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
        results.visualRoutes[vp.name][route.path] = { status, title, h1, bodyVisible, noHorizScroll: noScrollIssue };
      } catch (e) {
        results.visualRoutes[vp.name][route.path] = { error: e.message };
      }
      await page.close();
    }
  }
  // Summary
  for (const vp of VIEWPORTS) {
    const routes = results.visualRoutes[vp.name];
    const ok = Object.values(routes).filter(r => !r.error && r.bodyVisible).length;
    const hscroll = Object.values(routes).filter(r => r.noHorizScroll === false).length;
    console.log(`    ${vp.name} (${vp.width}px): ${ok}/${ROUTES.length} routes visible, ${hscroll} with horiz-scroll`);
  }

  // --- Reduced-motion check ---
  console.log('  Reduced-motion check...');
  const rmCtx = await browser.newContext({ reducedMotion: 'reduce' });
  const rmPage = await rmCtx.newPage();
  await rmPage.setViewportSize({ width: 1440, height: 900 });
  try {
    await rmPage.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
    await rmPage.waitForSelector('#page-outlet h1');

    // Normal motion
    const normalCtx = await browser.newContext({ reducedMotion: 'no-preference' });
    const normalPage = await normalCtx.newPage();
    await normalPage.setViewportSize({ width: 1440, height: 900 });
    await normalPage.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
    await normalPage.waitForSelector('#page-outlet h1');
    const withMotion = await normalPage.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if ((cs.animationName && cs.animationName !== 'none') ||
            (cs.transitionDuration && cs.transitionDuration !== '0s')) n++;
      }
      return n;
    });
    await normalCtx.close();

    // Reduced motion
    const withReduced = await rmPage.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if ((cs.animationName && cs.animationName !== 'none') ||
            (cs.transitionDuration && cs.transitionDuration !== '0s')) n++;
      }
      return n;
    });

    results.reducedMotion = { withMotion, withReduced, reduction: withMotion - withReduced };
    console.log(`    normal=${withMotion} animated elements, reduced=${withReduced} (reduction=${withMotion - withReduced})`);
  } catch (e) {
    results.reducedMotion = { error: e.message };
    console.log(`    ERROR: ${e.message}`);
  }
  await rmCtx.close();

  // --- Interaction checks (Chrome only) ---
  if (name === 'Chrome') {
    console.log('  Interaction checks...');
    const iPage = await browser.newPage();
    await iPage.setViewportSize({ width: 1440, height: 900 });
    results.interactions = await checkInteractions(iPage).catch(e => [{ error: e.message }]);
    for (const r of results.interactions) {
      if (r.error) {
        console.log(`    ERROR: ${r.error}`);
      } else {
        console.log(`    ${r.check}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
      }
    }
    await iPage.close();
  }

  await browser.close();
  return results;
}

async function main() {
  console.log(`\nStreetJS Website — Browser Validation Harness`);
  console.log(`BASE: ${BASE}`);
  console.log(`Chrome: Playwright Chromium (headless)`);
  console.log(`Firefox: ${FIREFOX_BINARY}`);
  console.log(`axe-core: ${AXE_PATH}\n`);

  const chromeResult = await runBrowser(chromium, 'Chrome');
  const firefoxResult = await runBrowser(firefox, 'Firefox', {
    executablePath: FIREFOX_BINARY,
  });

  const output = {
    timestamp: new Date().toISOString(),
    base: BASE,
    axeCorePath: AXE_PATH,
    chrome: chromeResult,
    firefox: firefoxResult,
  };

  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\nResults written to ${OUT}`);

  // --- Summary ---
  let chromeViolations = 0;
  let firefoxViolations = 0;
  for (const r of Object.values(chromeResult.axe)) {
    if (r.violations) chromeViolations += r.violations.length;
  }
  for (const r of Object.values(firefoxResult.axe)) {
    if (r.violations) firefoxViolations += r.violations.length;
  }

  console.log(`\n=================== FINAL SUMMARY ===================`);
  console.log(`Chrome axe violations across ${ROUTES.length} routes: ${chromeViolations}`);
  console.log(`Firefox axe violations across ${ROUTES.length} routes: ${firefoxViolations}`);
  console.log(`Reduced-motion (Chrome): normal=${chromeResult.reducedMotion.withMotion}, reduced=${chromeResult.reducedMotion.withReduced}`);
  const interPass = chromeResult.interactions.filter(r => r.pass).length;
  const interTotal = chromeResult.interactions.filter(r => !r.error).length;
  console.log(`Interaction checks (Chrome): ${interPass}/${interTotal} passed`);
  console.log(`=====================================================\n`);

  return chromeViolations + firefoxViolations;
}

main().then(violations => {
  process.exit(violations > 0 ? 1 : 0);
}).catch(e => {
  console.error(e);
  process.exit(2);
});
