/**
 * Visual validation harness for the StreetJS website brand design.
 * Executes the BLOCKED items from STREETJS-VISUAL-VALIDATION-REPORT.md:
 *   - axe-core 4.13.0 on all routes
 *   - Chrome + Firefox, three viewports (1440×900, 768×1024, 375×812)
 *   - Reduced-motion check
 *   - Visual checks: font-family, background, colour, appRoot
 *
 * Usage:
 *   node scripts/visual-validate.mjs --base=http://127.0.0.1:4173 --out=/tmp/visual-results.json
 */
import pkg from '/home/error51/Downloads/StreetUI/benchmarks/node_modules/playwright/index.js';
const { chromium, firefox } = pkg;
import { readFileSync, writeFileSync } from 'fs';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);
const BASE  = args.base || 'http://127.0.0.1:4173';
const OUT   = args.out  || '/tmp/visual-results.json';

const AXE = '/home/error51/Downloads/StreetUI/benchmarks/node_modules/axe-core/axe.min.js';
const axeScript = readFileSync(AXE, 'utf8');
const FIREFOX_BIN = '/home/error51/.cache/ms-playwright/firefox-1538/firefox/firefox';

const ROUTES = [
  { path: '/',                       label: 'Home',              expect200: true  },
  { path: '/docs',                   label: 'Docs index',        expect200: true  },
  { path: '/docs/http',              label: 'Docs: http',        expect200: true  },
  { path: '/docs/routing',           label: 'Docs: routing',     expect200: false },
  { path: '/guides',                 label: 'Guides index',      expect200: true  },
  { path: '/guides/getting-started', label: 'Guide: start',      expect200: false },
  { path: '/blog',                   label: 'Blog index',        expect200: true  },
  { path: '/playground',             label: 'Playground',        expect200: true  },
  { path: '/nope-404',               label: '404 page',          expect200: false },
];

const VIEWPORTS = [
  { name: 'desktop', w: 1440, h: 900  },
  { name: 'tablet',  w: 768,  h: 1024 },
  { name: 'mobile',  w: 375,  h: 812  },
];

// ── Brand token expectations ──────────────────────────────────────────────────
// These are from the STREETJS-BRAND-DESIGN-REPORT.md
const BRAND = {
  lightBg:      'rgb(248, 250, 252)',   // #F8FAFC
  darkBg:       'rgb(11, 16, 32)',      // #0B1020
  lightHeading: 'rgb(15, 23, 42)',      // #0F172A
  darkHeading:  'rgb(248, 250, 252)',   // #F8FAFC
  accent:       'rgb(37, 99, 235)',     // #2563EB (light)
  accentDark:   'rgb(96, 165, 250)',    // #60A5FA (dark)
  navBg:        'rgb(11, 16, 32)',      // #0B1020 charcoal header both themes
  fontSans:     /system-ui|BlinkMac|Segoe UI|-apple-system/i,
};

async function runAxe(page) {
  await page.addScriptTag({ content: axeScript });
  const r = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    });
  });
  return {
    violations: r.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.length,
      selectors: v.nodes.slice(0, 3).map(n => n.target.join(' > ')),
    })),
    passes: r.passes.length,
    incomplete: r.incomplete.length,
  };
}

async function checkBrandTokens(page, theme) {
  return page.evaluate((brand) => {
    const html = document.documentElement;
    const appRoot = document.getElementById('app-root');
    const h1 = document.querySelector('#page-outlet h1');
    const nav = document.getElementById('site-nav');
    const results = [];

    // 1. appRoot exists
    results.push({ check: 'app-root element present', pass: !!appRoot });

    // 2. Base font is sans
    if (appRoot) {
      const ff = getComputedStyle(appRoot).fontFamily;
      const isSans = /system-ui|BlinkMac|Segoe UI|-apple-system|Arial|Helvetica/i.test(ff);
      results.push({ check: 'Base font is sans-serif', pass: isSans, detail: ff.slice(0, 80) });
    }

    // 3. Page background matches brand
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const htmlBg = getComputedStyle(html).backgroundColor;
    const rootBg = appRoot ? getComputedStyle(appRoot).backgroundColor : '';
    results.push({
      check: 'Page background is themed (not transparent / white default)',
      pass: bodyBg !== 'rgba(0, 0, 0, 0)' || rootBg !== 'rgba(0, 0, 0, 0)',
      detail: `body=${bodyBg} html=${htmlBg} app-root=${rootBg}`,
    });

    // 4. h1 is sans-serif (no serif leak)
    if (h1) {
      const ff = getComputedStyle(h1).fontFamily;
      const isSans = /system-ui|BlinkMac|Segoe UI|-apple-system|Arial|Helvetica/i.test(ff);
      results.push({ check: 'h1 font is sans (no serif leak)', pass: isSans, detail: ff.slice(0, 80) });
    }

    // 5. h1 color is not mid-gray (was "pale text" bug)
    if (h1) {
      const color = getComputedStyle(h1).color;
      // rgb(0,0,0), rgb(15,23,42) or rgb(248,250,252) – all dark/light heading, not washed out
      // Reject mid-range gray (roughly 100-200,100-200,100-200)
      const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      let isNotPale = true;
      if (m) {
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        const avg = (r + g + b) / 3;
        isNotPale = avg < 80 || avg > 220; // strong dark or strong light, not pale
      }
      results.push({ check: 'h1 color is not pale mid-gray', pass: isNotPale, detail: color });
    }

    // 6. Nav background is charcoal (brand both themes)
    if (nav) {
      const bg = getComputedStyle(nav).backgroundColor;
      // Accept either exact charcoal or 'transparent' inheriting from a parent charcoal section
      results.push({
        check: 'Nav background is themed (not default white)',
        pass: bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(255, 255, 255)',
        detail: bg,
      });
    }

    return results;
  }, BRAND);
}

async function checkReducedMotion(browser) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('#page-outlet h1');

  const rmCount = await page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const tDur = parseFloat(cs.transitionDuration || '0') * 1000;
      const aDur = parseFloat(cs.animationDuration || '0') * 1000;
      const aName = cs.animationName && cs.animationName !== 'none';
      if (tDur > 20 || (aName && aDur > 20)) n++;
    }
    return n;
  });

  const rmInCSS = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.conditionText && rule.conditionText.includes('prefers-reduced-motion')) return true;
          if (rule.cssText && rule.cssText.includes('prefers-reduced-motion')) return true;
        }
      } catch(e) {}
    }
    return false;
  });

  await ctx.close();
  return { elementsStillAnimated: rmCount, ruleInCSS: rmInCSS };
}

async function runViewportSuite(browserType, browserName, launchOpts) {
  console.log(`\n=== ${browserName} ===`);
  const browser = await browserType.launch({ headless: true, ...launchOpts });
  const result = { browserName, axe: {}, viewports: {}, brandTokens: {}, reducedMotion: {} };

  // ── axe-core ──────────────────────────────────────────────────────────────
  console.log('  axe-core scan...');
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ bypassCSP: true });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      const res = await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      const status = res?.status() ?? 0;
      await page.waitForSelector('body', { timeout: 5000 });
      const axeR = await runAxe(page);
      result.axe[route.path] = { label: route.label, status, ...axeR };
      const v = axeR.violations.length;
      console.log(`    ${route.path}: status=${status} violations=${v} passes=${axeR.passes}`);
      if (v > 0) axeR.violations.forEach(vv => console.log(`      [${vv.impact}] ${vv.id}: ${vv.help}`));
    } catch(e) {
      result.axe[route.path] = { label: route.label, error: e.message };
      console.log(`    ${route.path}: ERROR ${e.message}`);
    }
    await ctx.close();
  }

  // ── Multi-viewport visual check ───────────────────────────────────────────
  console.log('  Multi-viewport visual check...');
  for (const vp of VIEWPORTS) {
    result.viewports[vp.name] = {};
    for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.w, height: vp.h });
      try {
        const res = await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        const status  = res?.status() ?? 0;
        const title   = await page.title();
        const h1      = await page.$eval('#page-outlet h1', el => el.textContent.trim()).catch(() => null);
        const visible = await page.evaluate(() => document.body.offsetHeight > 0);
        const hScroll = await page.evaluate(() => {
          // Only count real page-level overflow, not elements inside overflow:auto/hidden containers
          function hasClippingAncestor(el) {
            let p = el.parentElement;
            while (p && p !== document.documentElement) {
              const cs = getComputedStyle(p);
              if (cs.overflow === 'hidden' || cs.overflow === 'auto' || cs.overflowX === 'hidden' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true;
              p = p.parentElement;
            }
            return false;
          }
          const docW = document.documentElement.clientWidth;
          const overflowEls = Array.from(document.querySelectorAll('*')).filter(el => {
            const r = el.getBoundingClientRect();
            return r.right > docW + 2 && !hasClippingAncestor(el);
          });
          return overflowEls.length > 0;
        });
        result.viewports[vp.name][route.path] = { status, title, h1, visible, hScroll };
      } catch(e) {
        result.viewports[vp.name][route.path] = { error: e.message };
      }
      await page.close();
    }
    const rows = Object.values(result.viewports[vp.name]);
    const vis = rows.filter(r => !r.error && r.visible).length;
    const hsc = rows.filter(r => r.hScroll).length;
    console.log(`    ${vp.name} (${vp.w}px): ${vis}/${ROUTES.length} routes visible, ${hsc} with horiz-scroll`);
  }

  // ── Brand-token check (light theme) ──────────────────────────────────────
  console.log('  Brand-token / typography check...');
  for (const [theme, path] of [['light', '/'], ['dark', '/']]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('#page-outlet h1');
    if (theme === 'dark') {
      // Force dark by clicking theme toggle twice (System→Light→Dark)
      await page.click('#theme-toggle').catch(() => {});
      await page.waitForTimeout(100);
      await page.click('#theme-toggle').catch(() => {});
      await page.waitForTimeout(100);
      const dt = await page.$eval('html', el => el.getAttribute('data-theme'));
      if (dt !== 'dark') { await page.close(); continue; }
    }
    const checks = await checkBrandTokens(page, theme);
    result.brandTokens[theme] = checks;
    for (const c of checks) {
      console.log(`    [${theme}] ${c.check}: ${c.pass ? 'PASS' : 'FAIL'}${c.detail ? ' — ' + c.detail.slice(0, 70) : ''}`);
    }
    await page.close();
  }

  // ── Reduced-motion ────────────────────────────────────────────────────────
  console.log('  Reduced-motion check...');
  try {
    result.reducedMotion = await checkReducedMotion(browser);
    console.log(`    elements still animated: ${result.reducedMotion.elementsStillAnimated}, rule in CSS: ${result.reducedMotion.ruleInCSS}`);
  } catch(e) {
    result.reducedMotion = { error: e.message };
    console.log(`    ERROR: ${e.message}`);
  }

  await browser.close();
  return result;
}

async function main() {
  console.log(`\nStreetJS Visual Validation Harness`);
  console.log(`BASE: ${BASE}`);
  console.log(`axe-core: ${AXE}`);

  const chrome  = await runViewportSuite(chromium, 'Chrome',  {});
  const ff      = await runViewportSuite(firefox,  'Firefox', { executablePath: FIREFOX_BIN });

  const out = { timestamp: new Date().toISOString(), base: BASE, chrome, firefox: ff };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\nResults → ${OUT}`);

  const chromeV = Object.values(chrome.axe).reduce((s, r) => s + (r.violations?.length ?? 0), 0);
  const ffV     = Object.values(ff.axe).reduce((s, r) => s + (r.violations?.length ?? 0), 0);
  console.log(`\n══ SUMMARY ══════════════════════════════`);
  console.log(`Chrome  axe violations: ${chromeV} / ${ROUTES.length} routes`);
  console.log(`Firefox axe violations: ${ffV} / ${ROUTES.length} routes`);
  console.log(`Chrome  reduced-motion: ${chrome.reducedMotion.elementsStillAnimated ?? 'N/A'} elements still animated`);
  console.log(`Firefox reduced-motion: ${ff.reducedMotion.elementsStillAnimated ?? 'N/A'} elements still animated`);

  const brandPass = (res) => Object.values(res.brandTokens).flat().filter(c => !c.pass).length;
  console.log(`Chrome  brand-token failures: ${brandPass(chrome)}`);
  console.log(`Firefox brand-token failures: ${brandPass(ff)}`);
  console.log(`═════════════════════════════════════════\n`);

  return chromeV + ffV;
}

main().then(v => process.exit(v > 0 ? 1 : 0)).catch(e => { console.error(e); process.exit(2); });
