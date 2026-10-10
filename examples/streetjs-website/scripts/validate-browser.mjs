/**
 * Browser validation harness for the StreetJS website.
 * Runs axe-core accessibility audit + visual/interaction checks in Chrome and Firefox.
 * Outputs JSON to --out flag.
 *
 * Usage:
 *   node scripts/validate-browser.mjs --base=http://127.0.0.1:4173 --out=validation-results.json
 */
import { chromium, firefox } from '/home/error51/Downloads/StreetUI/benchmarks/node_modules/playwright/index.js';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
import { mkdirSync } from 'fs';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);
const BASE = args.base || 'http://127.0.0.1:4173';
const OUT = args.out || '/tmp/validation-results.json';

const AXE_PATH = '/home/error51/Downloads/StreetUI/benchmarks/node_modules/axe-core/axe.min.js';
const axeScript = readFileSync(AXE_PATH, 'utf8');

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

async function checkReducedMotion(page) {
  // Emulate prefers-reduced-motion: reduce and check no CSS animation/transition remains
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const animCount = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    let animated = 0;
    for (const el of all) {
      const cs = getComputedStyle(el);
      const anim = cs.animationName && cs.animationName !== 'none';
      const trans = cs.transitionDuration && cs.transitionDuration !== '0s';
      if (anim || trans) animated++;
    }
    return animated;
  });
  return animCount;
}

async function checkInteractions(page, browserName) {
  const results = [];

  // 1. Navigation works
  await page.goto(`${BASE}/`);
  await page.waitForSelector('#page-outlet h1');
  const h1Home = await page.$eval('#page-outlet h1', el => el.textContent.trim());
  results.push({ check: 'Home h1 present', pass: h1Home.length > 0, detail: h1Home });

  // 2. Client navigation via nav link
  const docsLink = await page.$('a[href="/docs"]');
  if (docsLink) {
    await docsLink.click();
    await page.waitForSelector('#page-outlet h1');
    const h1Docs = await page.$eval('#page-outlet h1', el => el.textContent.trim());
    results.push({ check: 'Client nav to /docs', pass: h1Docs.length > 0, detail: h1Docs });
  } else {
    results.push({ check: 'Client nav to /docs', pass: false, detail: 'nav link not found' });
  }

  // 3. Mobile menu (375px)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/`);
  await page.waitForSelector('#page-outlet h1');
  const menuBtn = await page.$('[aria-label*="menu" i], [aria-label*="nav" i], button.mobile-menu-toggle, #mobile-menu-toggle');
  if (menuBtn) {
    await menuBtn.click();
    await page.waitForTimeout(200);
    const menuOpen = await page.$('.mobile-menu-open, [data-mobile-open="true"], nav.open, .nav-open') !== null;
    results.push({ check: 'Mobile menu toggle', pass: menuOpen, detail: menuOpen ? 'opened' : 'state unclear' });
  } else {
    // check if nav is always visible at mobile
    const navVisible = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return false;
      const r = nav.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    results.push({ check: 'Mobile menu toggle', pass: navVisible, detail: navVisible ? 'nav always visible or toggle missing' : 'nav not visible' });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // 4. Theme toggle
  await page.goto(`${BASE}/`);
  await page.waitForSelector('#page-outlet h1');
  const themeBtn = await page.$('[aria-label*="theme" i], [aria-label*="dark" i], [aria-label*="light" i], #theme-toggle, .theme-toggle');
  if (themeBtn) {
    const themeBefore = await page.$eval('html', el => el.getAttribute('data-theme'));
    await themeBtn.click();
    await page.waitForTimeout(100);
    const themeAfter = await page.$eval('html', el => el.getAttribute('data-theme'));
    results.push({ check: 'Theme toggle changes data-theme', pass: themeBefore !== themeAfter, detail: `${themeBefore} → ${themeAfter}` });
  } else {
    results.push({ check: 'Theme toggle changes data-theme', pass: false, detail: 'theme toggle button not found' });
  }

  // 5. Search dialog opens
  await page.goto(`${BASE}/`);
  await page.waitForSelector('#page-outlet h1');
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(200);
  const searchOpen = await page.$('[role="dialog"], .search-dialog, #search-dialog, [aria-label*="search" i][role="dialog"]') !== null;
  results.push({ check: 'Search opens on Ctrl+K', pass: searchOpen, detail: searchOpen ? 'dialog opened' : 'dialog not found' });
  if (searchOpen) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }

  // 6. Skip link present and focusable
  await page.goto(`${BASE}/`);
  await page.waitForSelector('#page-outlet h1');
  const skipLink = await page.$('a[href="#main-content"], a.skip-link, a[href="#content"]');
  results.push({ check: 'Skip link present', pass: skipLink !== null, detail: skipLink ? 'found' : 'not found' });

  // 7. Focus visible ring (check :focus-visible CSS is defined)
  const focusVisibleDefined = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes('focus-visible')) return true;
        }
      } catch (e) {}
    }
    return false;
  });
  results.push({ check: ':focus-visible ring in stylesheet', pass: focusVisibleDefined, detail: focusVisibleDefined ? 'defined' : 'not found' });

  return results;
}

async function runBrowser(browserType, name) {
  console.log(`\n=== ${name} ===`);
  const browser = await browserType.launch({ headless: true });
  const results = {
    browser: name,
    axe: {},
    visualRoutes: {},
    reducedMotion: {},
    interactions: [],
  };

  // --- axe-core on primary routes ---
  console.log('  Running axe-core...');
  for (const route of ROUTES) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      const res = await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      const status = res ? res.status() : 0;
      if (status >= 400) {
        // 404 pages are expected for the last route — still run axe
      }
      await page.waitForSelector('body', { timeout: 5000 });
      const axeResult = await runAxe(page);
      results.axe[route.path] = { label: route.label, status, ...axeResult };
      const vCount = axeResult.violations.length;
      console.log(`    ${route.path}: status=${status} violations=${vCount} passes=${axeResult.passes}`);
    } catch (e) {
      results.axe[route.path] = { label: route.label, error: e.message };
      console.log(`    ${route.path}: ERROR ${e.message}`);
    }
    await page.close();
  }

  // --- Visual route check: status, h1, title, viewport ---
  console.log('  Visual route check...');
  for (const vp of VIEWPORTS) {
    results.visualRoutes[vp.name] = {};
    for (const route of ROUTES.slice(0, 6)) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      try {
        const res = await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        const status = res ? res.status() : 0;
        const title = await page.title();
        const h1 = await page.$eval('#page-outlet h1', el => el.textContent.trim()).catch(() => null);
        const bodyVisible = await page.evaluate(() => document.body.offsetHeight > 0);
        results.visualRoutes[vp.name][route.path] = { status, title, h1, bodyVisible };
      } catch (e) {
        results.visualRoutes[vp.name][route.path] = { error: e.message };
      }
      await page.close();
    }
  }

  // --- Reduced-motion check on home page ---
  console.log('  Reduced-motion check...');
  const rmPage = await browser.newPage();
  await rmPage.setViewportSize({ width: 1440, height: 900 });
  try {
    await rmPage.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
    await rmPage.waitForSelector('#page-outlet h1');
    const withMotion = await rmPage.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if ((cs.animationName && cs.animationName !== 'none') ||
            (cs.transitionDuration && cs.transitionDuration !== '0s')) n++;
      }
      return n;
    });
    await rmPage.emulateMedia({ reducedMotion: 'reduce' });
    const withReduced = await rmPage.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if ((cs.animationName && cs.animationName !== 'none') ||
            (cs.transitionDuration && cs.transitionDuration !== '0s')) n++;
      }
      return n;
    });
    results.reducedMotion = { withMotion, withReduced, elementsStillAnimated: withReduced };
    console.log(`    normal=${withMotion} elements with animation/transition, reduced=${withReduced}`);
  } catch (e) {
    results.reducedMotion = { error: e.message };
  }
  await rmPage.close();

  // --- Interaction checks (Chrome only to save time, note that in output) ---
  if (name === 'Chrome') {
    console.log('  Interaction checks...');
    const iPage = await browser.newPage();
    await iPage.setViewportSize({ width: 1440, height: 900 });
    results.interactions = await checkInteractions(iPage, name).catch(e => [{ error: e.message }]);
    for (const r of results.interactions) {
      console.log(`    ${r.check}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
    }
    await iPage.close();
  }

  await browser.close();
  return results;
}

async function main() {
  console.log(`\nStreetJS Website — Browser Validation Harness`);
  console.log(`BASE: ${BASE}`);
  console.log(`axe-core: ${AXE_PATH}`);

  const chromeResult = await runBrowser(chromium, 'Chrome');
  const firefoxResult = await runBrowser(firefox, 'Firefox');

  const output = {
    timestamp: new Date().toISOString(),
    base: BASE,
    chrome: chromeResult,
    firefox: firefoxResult,
  };

  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\nResults written to ${OUT}`);

  // Summary
  let totalViolations = 0;
  for (const [path, r] of Object.entries(chromeResult.axe)) {
    if (r.violations) totalViolations += r.violations.length;
  }
  console.log(`\n=== SUMMARY ===`);
  console.log(`Chrome axe violations (total across all routes): ${totalViolations}`);
  if (totalViolations > 0) {
    for (const [path, r] of Object.entries(chromeResult.axe)) {
      if (r.violations && r.violations.length > 0) {
        console.log(`  ${path}: ${r.violations.length} violation(s)`);
        for (const v of r.violations) {
          console.log(`    [${v.impact}] ${v.id}: ${v.help}`);
        }
      }
    }
  }
  console.log(`Reduced-motion elements still animated: ${chromeResult.reducedMotion.elementsStillAnimated ?? 'N/A'}`);

  return totalViolations;
}

main().then(violations => {
  process.exit(violations > 0 ? 1 : 0);
}).catch(e => {
  console.error(e);
  process.exit(2);
});
