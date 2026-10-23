import { dateInputChecks } from './date-input-browser.mjs';
import { analyticsConsentChecks } from './analytics-consent-browser.mjs';
// Optional browser checks: Playwright is test tooling, never a web dependency.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(process.env.WEB_ROOT || 'web');
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/SchengenStay/, '') || '/';
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = (process.env.SITE_URL || `http://127.0.0.1:${server.address().port}/SchengenStay/`).replace(/\/$/, '');
let browser;
let checks = 0;
async function check(name, body) {
  await body();
  checks++;
  console.log(`PASS ${name}`);
}

try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, timezoneId: 'Europe/Minsk', locale: 'en-GB' });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-23T12:00:00Z') });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  const go = async route => { await page.locator(`nav a[href="#${route}"]`).click(); await page.waitForFunction(route => location.hash === `#${route}` && document.querySelector('nav [aria-current="page"]').getAttribute('href') === `#${route}`, route); };
  const save = () => page.locator('dialog button[type="submit"]').click();
  // close() queues the close event; teardown/focus restoration happen in that
  // event, not necessarily before Playwright's click promise settles.
  const waitForDialogClose = () => page.locator('dialog').waitFor({ state: 'detached' });
  const fillDates = async (entry, exit) => { await page.locator('#field-entry').fill(entry); await page.locator('#field-exit').fill(exit); };

  await check('empty dashboard requires explicit calculation context', async () => {
    await page.goto(`${origin}/`);
    await page.waitForSelector('h1');
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), '—');
    assert.equal(await page.locator('.metric.remaining .metric-value').innerText(), '—');
    assert.match(await page.locator('.session-notice').innerText(), /Memory only by default/);
    assert.equal(await page.locator('.trip-row').count(), 0);
    await page.goto(`${origin}/#__proto__`);
    await page.getByRole('heading', { name: 'Your next chapter starts here.' }).waitFor();
  });
  await check('keyboard skip link keeps the current route and reaches main', async () => {
    await go('history');
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
    assert.equal(new URL(page.url()).hash, '#history');
  });
  await check('trip form reports required fields and reversed dates accessibly', async () => {
    await page.getByRole('button', { name: 'Add trip', exact: true }).first().click();
    await save();
    assert.equal(await page.locator('#field-entry').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'field-entry');
    await fillDates('2024-02-28', '2024-02-27');
    await save();
    assert.match(await page.locator('#field-exit-error').innerText(), /on or after/);
  });
  await check('trip create and edit work; free text is rendered literally', async () => {
    await page.locator('#field-label').fill('<img src=x onerror=alert(1)>');
    await page.locator('#field-note').fill('Synthetic browser-test record');
    await fillDates('2024-02-28', '2024-03-01');
    await save();
    await waitForDialogClose();
    assert.equal(await page.locator('dialog').count(), 0);
    assert.equal(await page.locator('.trip-row').count(), 1);
    assert.match(await page.locator('.trip-row h3').innerText(), /<img/);
    assert.equal(await page.locator('img[src="x"]').count(), 0);
    await page.getByRole('button', { name: /^Edit:/ }).click();
    await page.locator('#field-label').fill('Alpine break');
    await page.locator('#field-exit').fill('2024-03-02');
    await save();
    await waitForDialogClose();
    assert.equal(await page.locator('.trip-row h3').innerText(), 'Alpine break');
    assert.equal(await page.locator('.trip-row').count(), 1);
  });
  await check('overlaps are rejected; Escape closes the dialog and restores focus', async () => {
    await page.getByRole('button', { name: 'Add trip', exact: true }).click();
    await fillDates('2024-03-02', '2024-03-03');
    await save();
    assert.match(await page.locator('#field-entry-error').innerText(), /overlap/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog', { state: 'detached' });
    assert.equal(await page.locator('dialog').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Add trip');
  });
  await check('fixed, maximum and earliest scenarios stay unevaluated until explicitly run', async () => {
    await go('planner');
    for (const mode of ['fixed', 'maximum', 'earliest']) {
      await page.getByRole('button', { name: 'New scenario', exact: true }).first().click();
      await page.locator('#field-label').fill(`Test ${mode}`);
      await page.locator('#field-mode').selectOption(mode);
      await page.locator('#field-entry').fill('2027-01-10');
      if (mode === 'fixed') await page.locator('#field-exit').fill('2027-01-15');
      if (mode === 'earliest') {
        await page.locator('#field-length').fill('0');
        await save();
        assert.equal(await page.locator('#field-length').getAttribute('aria-invalid'), 'true');
        await page.locator('#field-length').fill('20');
      }
      await save();
      await waitForDialogClose();
    }
    assert.equal(await page.locator('.scenario-card').count(), 3);
    for (const text of await page.locator('.scenario-result').allTextContents()) assert.match(text, /No calculation to show/);
    await page.getByRole('button', { name: 'Edit: Test fixed', exact: true }).click();
    await page.locator('#field-exit').fill('2027-01-16');
    await save();
    await waitForDialogClose();
    assert.equal(await page.locator('.scenario-card').count(), 3);
    await go('history');
    assert.equal(await page.locator('.trip-row').count(), 1);
  });
  await check('calculator date changes invalidate results and show basic date feedback', async () => {
    await go('calculator');
    assert.equal(await page.getByRole('button', { name: 'Check history', exact: true }).isEnabled(), true);
    await page.locator('#field-checkDate').fill('2024-03-02');
    await page.locator('#field-checkDate').blur();
    assert.equal(await page.locator('[data-computation-state]').getAttribute('data-computation-state'), 'empty');
    await page.locator('#field-checkDate').fill('');
    await page.locator('#field-checkDate').blur();
    assert.equal(await page.locator('[data-computation-state]').getAttribute('data-computation-state'), 'empty');
    await page.locator('#field-checkDate').fill('0001-01-01');
    await page.locator('#field-checkDate').blur();
    assert.equal(await page.locator('#field-checkDate').getAttribute('aria-invalid'), 'true');
  });
  await check('calendar month navigation displays only fixed tentative intervals', async () => {
    await go('calendar');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next month', exact: true }).click();
    assert.match(await page.locator('.calendar-toolbar h3').innerText(), /January 2027/);
    assert.equal(await page.locator('.calendar-day.tentative').count(), 7);
    assert.equal(await page.locator('.calendar-day.recorded').count(), 0);
    await page.locator('[data-date="2027-01-10"]').click();
    assert.match(await page.locator('.day-detail').innerText(), /Test fixed/);
    assert.doesNotMatch(await page.locator('.day-detail').innerText(), /Test maximum|Test earliest/);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.date), '2027-01-11');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-date="2027-01-11"]').getAttribute('aria-pressed'), 'true');
  });
  await check('English/Russian and dark/light changes work without losing entries', async () => {
    await go('settings');
    await page.locator('#field-language').selectOption('ru');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    await page.getByRole('button', { name: 'Тёмное', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await go('history');
    assert.match(await page.locator('h1').innerText(), /Каждая поездка/);
    assert.equal(await page.locator('.trip-row').count(), 1);
    await go('settings');
    await page.locator('#field-language').selectOption('en');
    await page.getByRole('button', { name: 'Light', exact: true }).click();
  });
  await check('removal requires confirmation, cancellation preserves records', async () => {
    await go('history');
    await page.getByRole('button', { name: 'Remove: Alpine break', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Cancel');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await waitForDialogClose();
    assert.equal(await page.locator('.trip-row').count(), 1);
    await page.getByRole('button', { name: 'Remove: Alpine break', exact: true }).click();
    await page.getByRole('button', { name: 'Remove entry', exact: true }).click();
    await waitForDialogClose();
    assert.equal(await page.locator('.trip-row').count(), 0);
    await go('planner');
    await page.getByRole('button', { name: 'Remove: Test earliest', exact: true }).click();
    await page.getByRole('button', { name: 'Remove entry', exact: true }).click();
    await waitForDialogClose();
    assert.equal(await page.locator('.scenario-card').count(), 2);
  });
  await check('reload starts a new session with no browser storage', async () => {
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(await context.cookies(), []);
    await page.reload();
    await page.waitForSelector('h1');
    assert.equal(await page.locator('.scenario-card').count(), 0);
  });
  await check('all screens fit desktop, tablet, mobile and narrow mobile in both languages', async () => {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const language of ['en', 'ru']) {
        await page.goto(`${origin}/#settings`);
        await page.locator('#field-language').selectOption(language);
        for (const route of ['dashboard', 'history', 'calculator', 'planner', 'calendar', 'settings', 'guide']) {
          await page.evaluate(route => { location.hash = route; }, route);
          await page.waitForFunction(route => document.querySelector('nav [aria-current="page"]').getAttribute('href') === `#${route}`, route);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route}/${language}/${width} overflows: ${await page.evaluate(() => [...document.querySelectorAll("main *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => el.className || el.tagName).slice(0, 10))}`);
          assert.equal(await page.locator('h1').count(), 1);
          assert.equal(await page.locator('main').count(), 1);
          assert.equal(await page.locator('nav [aria-current="page"]').count(), 1);
          assert.ok(await page.locator('h1').isVisible());
          assert.doesNotMatch(await page.locator('body').innerText(), /Python|Pyodide|WebAssembly|Web Worker/i);
        }
      }
    }
  });
  await check('mobile menu supports keyboard use and dialog fits narrow screens', async () => {
    await page.goto(`${origin}/#settings`);
    await page.locator('#field-language').selectOption('en');
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    assert.equal(await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#dashboard');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded'), 'false');
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await go('history');
    await page.getByRole('button', { name: 'Add trip', exact: true }).first().click();
    assert.ok(await page.locator('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => !!document.activeElement.closest('dialog')));
    }
    await page.keyboard.press('Escape');
  });
  await check('loading/error components expose accessible states without numerical fixtures', async () => {
    const states = await page.evaluate(async () => {
      const { computationState } = await import('./scripts/components.js');
      const { translator } = await import('./scripts/i18n.js');
      return ['empty', 'loading', 'error', 'unavailable'].map(state => {
        const node = computationState(translator('en'), state);
        return { state, role: node.getAttribute('role'), busy: node.getAttribute('aria-busy'), text: node.textContent };
      });
    });
    assert.equal(states.find(item => item.state === 'loading').busy, 'true');
    assert.equal(states.find(item => item.state === 'error').role, 'alert');
    for (const state of states) assert.doesNotMatch(state.text, /\d/);
  });
  await check('local assets only, with no browser errors or remote data requests', async () => {
    assert.deepEqual(errors, []);
    assert.ok(requests.every(url => url.startsWith(origin + '/')));
  });
  await check('named controls, landmarks and base text contrast in both themes', async () => {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await go('settings');
    for (const theme of ['Dark', 'Light']) {
      await page.getByRole('button', { name: theme, exact: true }).click();
      const issues = await page.evaluate(() => {
        const issues = [];
        for (const control of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
          if (!control.labels?.length && !control.getAttribute('aria-label')) issues.push('Unnamed field');
        }
        for (const button of document.querySelectorAll('button')) {
          if (!button.textContent.trim() && !button.getAttribute('aria-label')) issues.push('Unnamed button');
        }
        for (const image of document.images) if (!image.hasAttribute('alt')) issues.push('Missing image alternative');
        const style = getComputedStyle(document.documentElement);
        function luminance(hex) {
          const raw = hex.trim().replace('#', '');
          const value = raw.length === 3 ? [...raw].map(c => c + c).join('') : raw;
          const rgb = value.match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        }
        for (const [foreground, background] of [['--text', '--bg'], ['--muted', '--surface'], ['--muted', '--bg'], ['--on-primary', '--primary'], ['--warm-text', '--warm'], ['--sage-text', '--sage']]) {
          const a = luminance(style.getPropertyValue(foreground)), b = luminance(style.getPropertyValue(background));
          if ((Math.max(a, b) + .05) / (Math.min(a, b) + .05) < 4.5) issues.push(`Contrast: ${foreground}/${background}`);
        }
        return issues;
      });
      assert.deepEqual(issues, []);
    }
  });
  await check('a failed module load shows an honest startup error', async () => {
    const failed = await context.newPage();
    await failed.route('**/scripts/app.js', route => route.abort());
    await failed.goto(`${origin}/`);
    await failed.getByRole('heading', { name: 'The workspace could not open.' }).waitFor();
    assert.equal(await failed.getByRole('button', { name: 'Reload interface' }).count(), 1);
    await failed.close();
  });
  await dateInputChecks({ browser, origin, check });
  await analyticsConsentChecks({ browser, origin, check });
  await check('optional analytics module failure does not prevent workspace editing', async () => {
    const isolated = await browser.newContext();
    await isolated.route('**/scripts/analytics.js', route => route.abort());
    const standalone = await isolated.newPage();
    await standalone.goto(`${origin}/#history`);
    await standalone.getByRole('button', { name: 'Add trip', exact: true }).first().click();
    assert.equal(await standalone.locator('dialog[open]').count(), 1);
    await standalone.keyboard.press('Escape');
    await isolated.close();
  });
  await check('analytics remains inactive with no beacon, including after navigation and edits', async () => {
    assert.equal(await page.locator('#schengenstay-analytics').count(), 0);
    assert.ok(requests.every(url => !url.includes('cloudflareinsights.com')));
    await page.goto(`${origin}/#settings`);
    await page.locator('#field-language').selectOption('en');
    assert.match(await page.locator('main').innerText(), /Website analytics is off/);
    await page.locator('#field-language').selectOption('ru');
    assert.match(await page.locator('main').innerText(), /Аналитика сайта отключена/);
  });
  if (process.env.SCREENSHOT_DIR) {
    await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto(`${origin}/`);
    await page.waitForSelector('h1');
    await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, 'overview-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, 'overview-mobile.png'), fullPage: true });
  }
  console.log(`${checks} browser checks passed in Chrome ${browser.version()}.`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
