/* Run with NODE_PATH pointing to a temporary puppeteer-core installation. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const nested = app.split('<main className="app-main-content">')[1].split('</main>')[0];
const routes = ['/dashboard', ...Array.from(nested.matchAll(/<Route path="([^"]+)"/g), m => m[1])
  .filter(route => route !== '*').map(route => '/app' + route.replace(':id', '1'))];
const baseURL = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:3000';
const reportPath = process.env.LAYOUT_REPORT || '/tmp/netmon-layout-browser.json';
const screenshotDir = '/tmp/netmon-layout-screenshots';
fs.mkdirSync(screenshotDir, { recursive: true });

async function geometry(page) {
  return page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const surface = document.querySelector('.page-surface, .dashboard-main');
    if (!surface) return { missingSurface: true, overflow: [], oversized: [] };
    const overflow = [...surface.querySelectorAll('*')].filter(el => {
      if (!visible(el) || el.closest('svg')) return false;
      const r = el.getBoundingClientRect();
      if (r.right <= innerWidth + 2 && r.left >= -2) return false;
      // Ignore decorative clipping here; meaningful clipped controls are checked below.
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(parent).overflowX)) return false;
      }
      return true;
    }).map(el => ({ tag: el.tagName, cls: el.className, right: Math.round(el.getBoundingClientRect().right) })).slice(0, 15);
    const oversized = [...surface.querySelectorAll('h1, h2, h3, .stat-value, .metric-value, .bandwidth-value, .score-value, .status-value, .status-number, .countdown-value, .count-value, .asn-number, .uptime-value')].filter(el => visible(el) && parseFloat(getComputedStyle(el).fontSize) > 28.1)
      .map(el => ({ text: el.textContent.slice(0, 50), size: getComputedStyle(el).fontSize }));
    const controls = [...surface.querySelectorAll('button, input, select, textarea')].filter(visible);
    const overlaps = [];
    const clipped = controls.filter(el => {
      const r = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== surface; p = p.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return false;
        if (['hidden', 'clip'].includes(getComputedStyle(p).overflowX)) {
          const parent = p.getBoundingClientRect();
          if (r.left < parent.left - 2 || r.right > parent.right + 2) return true;
        }
      }
      return false;
    }).map(el => el.className || el.tagName);
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (a.contains(b) || b.contains(a) || a.closest('.modal-overlay') !== b.closest('.modal-overlay')) continue;
      // Password reveal buttons sit inside padded inputs by design.
      if (a.closest('.input-wrapper') && a.closest('.input-wrapper') === b.closest('.input-wrapper')) continue;
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      if (Math.min(ar.right, br.right) - Math.max(ar.left, br.left) > 2 &&
          Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top) > 2) {
        overlaps.push([a.className || a.tagName, b.className || b.tagName]);
      }
    }
    const h1 = surface.querySelector('h1');
    return {
      missingSurface: false, overflow, oversized, overlaps, clipped,
      title: h1?.textContent, titleSize: h1 && getComputedStyle(h1).fontSize,
      font: getComputedStyle(surface).fontFamily,
      contentLeft: Math.round(surface.getBoundingClientRect().left),
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({ browser: 'firefox', executablePath: '/usr/bin/firefox',
    userDataDir: path.join(root, '../.netmon-coord/firefox-layout-profile'), headless: true });
  const report = [];
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
        document.head.appendChild(style);
      });
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear()); // Isolated test profile only.
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#username');
    report.push({ route: '/', width: 1440, ...(await geometry(page)) });
    await page.screenshot({ path: path.join(screenshotDir, 'login.png'), fullPage: true });
    // Exercise the existing simulated sign-in; no real account is used.
    await page.type('#username', 'layout_preview');
    await page.type('#password', 'preview-only');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.dashboard-main');
    const widths = (process.env.LAYOUT_WIDTHS || '1440,390,320').split(',').map(Number);
    for (const width of widths) {
      await page.setViewport({ width, height: 1000 });
      for (const route of routes) {
        await page.goto(baseURL + route, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.page-surface, .dashboard-main');
        await new Promise(resolve => setTimeout(resolve, 100));
        const initial = await geometry(page);
        const result = { route, width, ...initial, tabs: [] };
        const tabs = await page.$$('[data-page] [class$="-tabs"] > button, [data-page] .tabs > button');
        for (let i = 0; i < tabs.length; i++) {
          const current = await page.$$('[data-page] [class$="-tabs"] > button, [data-page] .tabs > button');
          if (!current[i]) continue;
          await current[i].evaluate(el => el.click());
          await new Promise(resolve => setTimeout(resolve, 40));
          result.tabs.push(await geometry(page));
        }
        if (['/dashboard', '/app/', '/app/devices', '/app/performance', '/app/network-management', '/app/icmp'].includes(route)) {
          await page.screenshot({ path: path.join(screenshotDir, route.replaceAll('/', '_') + '-' + width + '.png'), fullPage: true });
        }
        report.push(result);
        if (report.length % 10 === 0) console.log(`Checked ${report.length} route/viewport combinations`);
      }
    }
    // Mobile navigation must open above content and close on selection.
    await page.goto(baseURL + '/app/devices', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mobile-nav-toggle');
    await page.click('.mobile-nav-toggle');
    await page.waitForFunction(() => document.querySelector('.noc-sidebar').getBoundingClientRect().left >= -0.1);
    const mobileNavigation = await page.$eval('.noc-sidebar', el => el.getBoundingClientRect().left >= 0);
    await page.click('.mobile-nav-toggle');
    // Adversarial content length: long headings and device names must remain usable.
    await page.evaluate(() => {
      document.querySelector('h1').textContent = 'Infrastructure monitoring across multiple regions and network environments';
      const device = document.querySelector('.device-name');
      if (device) device.textContent = 'core-router-with-a-very-long-hostname.production.example.internal';
    });
    const longContent = await geometry(page);
    fs.writeFileSync(reportPath, JSON.stringify({ mobileNavigation, longContent, report }, null, 2));
    const failures = report.filter(r => r.missingSurface || r.overflow.length || r.oversized.length || r.overlaps?.length || r.clipped?.length || r.tabs?.some(t => t.overflow.length || t.oversized.length || t.overlaps?.length || t.clipped?.length));
    console.log(JSON.stringify({ checks: report.length, routes: routes.length, failures: failures.length, mobileNavigation, reportPath }));
    if (failures.length || !mobileNavigation || longContent.overflow.length || longContent.overlaps.length || longContent.clipped.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
