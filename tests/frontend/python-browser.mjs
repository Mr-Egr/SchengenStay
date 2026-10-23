// Optional browser checks: Playwright is test tooling, never a web dependency.
import assert from 'node:assert/strict';
import { contextChecks } from './context-browser.mjs';
import { releaseChecks } from './release-browser.mjs';
import { analyticsCalculationCheck } from './analytics-consent-browser.mjs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const require = createRequire(import.meta.url);
const browserName = process.env.BROWSER_ENGINE || 'chromium';
const browserType = require('playwright')[browserName];
assert.ok(['chromium', 'firefox', 'webkit'].includes(browserName), 'Unsupported BROWSER_ENGINE');
const root = resolve(process.env.WEB_ROOT || 'web');
const server = createServer(async (request, response) => {
  const rawPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const pathname = rawPath.replace(/^\/SchengenStay/, '') || '/';
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = process.env.SITE_URL || `http://127.0.0.1:${server.address().port}/SchengenStay/`;
assert.ok(origin.endsWith('/'), 'SITE_URL must end with / for repository-relative imports');
let browser;
let checks = 0;
async function check(name, body) {
  await body();
  checks++;
  console.log(`PASS ${name}`);
}

const python = process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? '.venv/Scripts/python.exe' : 'python');
const native = spawnSync(python, ['tests/browser_cases.py'], { encoding: 'utf8' });
assert.equal(native.status, 0, native.stderr);
const cases = JSON.parse(native.stdout);
const expected = name => cases.find(item => item.name === name).expected;
try {
  browser = await browserType.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, timezoneId: 'Europe/Minsk' });
  const page = await context.newPage();
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(String(error)));
  context.on('request', request => network.push({ url: request.url(), method: request.method(), body: request.postData() }));
  const go = async route => { await page.evaluate(route => { location.hash = route; }, route); await page.locator(`nav a[href="#${route}"][aria-current="page"]`).waitFor(); };
  const setDate = async value => { await page.locator('#field-checkDate').fill(value); await page.locator('#field-checkDate').blur(); };
  const confirm = async () => { await page.locator('#field-complete').check(); await page.locator('#field-scope').selectOption('COUNTABLE_SHORT_STAYS'); };
  const run = async status => { await page.locator('[data-focus="run-history"]').click(); await page.locator(`main > .panel [data-result-status="${status}"]`).first().waitFor({ timeout: 90000 }); };
  async function addTrip(entry, exit, label = 'Synthetic test trip', kind = 'completed') {
    await go('history');
    await page.getByRole('button', { name: 'Add trip', exact: true }).first().click();
    await page.locator('#field-label').fill(label);
    await page.locator('#field-kind').selectOption(kind);
    await page.locator('#field-entry').fill(entry);
    if (kind === 'completed') await page.locator('#field-exit').fill(exit);
    await page.locator('dialog button[type="submit"]').click();
    await page.locator('dialog').waitFor({ state: 'detached' });
  }
  async function scenario(mode, entry, value, horizon = '365', label = mode) {
    await go('planner');
    await page.getByRole('button', { name: 'New scenario', exact: true }).first().click();
    await page.locator('#field-label').fill(label);
    await page.locator('#field-mode').selectOption(mode);
    await page.locator('#field-entry').fill(entry);
    if (mode === 'fixed') await page.locator('#field-exit').fill(value);
    else { await page.locator('#field-horizon').fill(horizon); if (mode === 'earliest') await page.locator('#field-length').fill(value); }
    await page.locator('dialog button[type="submit"]').click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    return page.locator('.scenario-card').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
  }

  await check('real desktop initialization and incomplete history produce no numerical success', async () => {
    await page.goto(`${origin}#calculator`);
    const start = Date.now();
    await run('INSUFFICIENT_DATA');
    console.log(`MEASURE desktop first calculation ${Date.now() - start} ms`);
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), '—');
    assert.ok(await page.locator('[data-reason="HISTORY_INCOMPLETE"]').count());
  });
  await check('90-day history UI agrees with CPython; edits invalidate results', async () => {
    await addTrip('2024-01-01', '2024-03-30');
    await go('calculator'); await setDate('2024-03-31'); await confirm(); await run('WITHIN_RULE');
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), String(expected('ninety').snapshot.used_days));
    assert.equal(await page.locator('.metric.remaining .metric-value').innerText(), '0');
    await go('history'); await page.getByRole('button', { name: /^Edit:/ }).click();
    await page.locator('#field-exit').fill('2024-03-31'); await page.locator('dialog button[type="submit"]').click();
    await go('calculator'); assert.equal(await page.locator('[data-result-status]').count(), 0);
    assert.equal(await page.locator('#field-complete').isChecked(), false);
    assert.equal(await page.locator('#field-scope').inputValue(), 'UNKNOWN');
    await run('INSUFFICIENT_DATA'); await confirm();
    await run('VIOLATION');
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), String(expected('ninety_one').snapshot.used_days));
    assert.match(await page.locator('[data-value="first_violation_date"]').first().innerText(), /31 Mar 2024/);
    assert.match(await page.locator('[data-evidence="result.violation"]').innerText(), /4 Oct 2023.*31 Mar 2024/s);
  });
  await check('invalid date, unsupported scope and limited history stay distinct', async () => {
    await page.locator('#field-budget').fill('20');
    assert.equal(await page.locator('[data-result-status]').count(), 0, 'typing a bound must immediately clear old results');
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), '—');
    await page.locator('#field-budget').fill('10000'); await page.locator('#field-budget').blur();
    await setDate('0001-01-01'); await page.locator('[data-focus="run-history"]').click();
    assert.equal(await page.locator('#field-checkDate').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('[data-result-status]').count(), 0);
    await setDate('2024-03-31'); await page.locator('#field-budget').fill('0'); await page.locator('#field-budget').blur(); await run('INVALID_INPUT');
    await page.locator('#field-budget').fill('10000'); await page.locator('#field-budget').blur();
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), '—');
    await setDate('2024-03-31'); await page.locator('#field-scope').selectOption('VISA_VALIDITY'); await run('OUT_OF_SCOPE');
    await confirm(); await page.locator('#field-budget').fill('1'); await page.locator('#field-budget').blur(); await run('HORIZON_LIMIT');
    assert.ok(await page.locator('[data-reason="INSPECTION_LIMIT_REACHED"]').count());
    await page.locator('#field-budget').fill('10000'); await page.locator('#field-budget').blur();
  });
  await check('fixed plan retains historical violation separately; comparison is independent', async () => {
    const first = await scenario('fixed', '2025-01-01', '2025-01-02', '365', 'Later trip');
    await first.getByRole('button', { name: 'Evaluate scenario' }).click();
    await first.locator('[data-result-status="VIOLATION"]').first().waitFor();
    assert.ok(await first.locator('[data-status="WITHIN_RULE"]').count());
    await scenario('fixed', '2024-04-01', '2024-04-02', '365', 'Immediate trip');
    await page.getByRole('button', { name: 'Compare fixed-date scenarios' }).click();
    await page.locator('[data-reason="ITINERARY_VIOLATION"]').first().waitFor();
    await go('history'); assert.equal(await page.locator('.trip-row').count(), 1);
  });
  await check('maximum, bounded prefix and earliest-entry results are real Python searches', async () => {
    // Return to 90 recorded days for the published-boundary-derived example.
    await page.getByRole('button', { name: /^Edit:/ }).click(); await page.locator('#field-exit').fill('2024-03-30'); await page.locator('dialog button[type="submit"]').click();
    const maximum = await scenario('maximum', '2024-06-29', '', '91', 'Proven maximum');
    await confirm();
    await maximum.getByRole('button', { name: 'Evaluate scenario' }).click();
    await maximum.locator('[data-value="consecutive_days"]').waitFor();
    assert.equal(await maximum.locator('[data-value="consecutive_days"]').innerText(), String(expected('maximum_91').consecutive_days));
    assert.match(await maximum.innerText(), /Maximum proven/);
    const partial = await scenario('maximum', '2024-06-29', '', '20', 'Limited prefix');
    await partial.getByRole('button', { name: 'Evaluate scenario' }).click();
    await partial.locator('[data-result-status="HORIZON_LIMIT"]').waitFor();
    assert.match(await partial.innerText(), /maximum has not been proven/);
    const earliest = await scenario('earliest', '2024-06-28', '90', '2', 'Earliest match');
    await earliest.getByRole('button', { name: 'Evaluate scenario' }).click(); await earliest.locator('[data-value="entry"]').waitFor();
    assert.match(await earliest.locator('[data-value="entry"]').innerText(), /29 Jun 2024/);
    const none = await scenario('earliest', '2024-06-28', '90', '1', 'Short horizon');
    await none.getByRole('button', { name: 'Evaluate scenario' }).click(); await none.locator('[data-reason="NOT_FOUND_WITHIN_HORIZON"]').waitFor();
    assert.equal(await none.locator('[data-value="entry"]').count(), 0);
  });
  await check('consent persists only validated history/preferences; disabling deletes saved data', async () => {
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    await go('settings'); await page.locator('#field-saving').check();
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('schengenstay.workspace.v1')));
    assert.equal(data.schema_version, 1); assert.equal(data.trips.length, 1); assert.equal(data.scenarios, undefined);
    await page.locator('#field-language').selectOption('ru'); await page.reload();
    await page.locator('#field-language').waitFor(); assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    await go('history'); assert.equal(await page.locator('.trip-row').count(), 1);
    await go('calculator'); assert.equal(await page.locator('#field-complete').isChecked(), false);
    await confirm(); await setDate('2024-03-31'); await page.locator('[data-focus="run-history"]').click();
    await page.locator('[data-result-status="WITHIN_RULE"]').first().waitFor({ timeout: 90000 });
    assert.match(await page.locator('[data-reason="NO_VIOLATION_FOUND"]').innerText(), /нарушение не найдено/);
    await go('settings'); await page.locator('#field-language').selectOption('en'); await page.locator('#field-saving').uncheck();
    assert.equal(await page.evaluate(() => localStorage.length), 0); await page.reload();
    await go('history'); assert.equal(await page.locator('.trip-row').count(), 0);
  });
  await check('multiple trips across leap/year boundaries match the Python UI snapshot', async () => {
    await addTrip('2023-12-30', '2024-01-02', 'Year boundary'); await addTrip('2024-02-28', '2024-03-01', 'Leap boundary');
    await go('calculator'); await setDate('2024-03-31'); await confirm(); await run('WITHIN_RULE');
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), String(expected('multiple').snapshot.used_days));
    await go('settings'); await page.locator('#field-language').selectOption('ru'); await go('calculator');
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), '7');
    assert.match(await page.locator('[data-reason="NO_VIOLATION_FOUND"]').innerText(), /нарушение не найдено/);
    await go('settings'); await page.locator('#field-language').selectOption('en');
  });
  await check('ongoing input requires explicit assumptions and blocks future planning', async () => {
    await addTrip('2024-03-15', null, 'Ongoing record', 'ongoing');
    await go('calculator'); await run('INSUFFICIENT_DATA');
    await confirm(); await page.locator('#field-ongoing').check(); await run('WITHIN_RULE');
    assert.match(await page.locator('main').innerText(), /Ongoing presence/);
    const future = await scenario('fixed', '2025-01-01', '2025-01-02', '365', 'Ongoing blocks plan');
    await future.getByRole('button', { name: 'Evaluate scenario' }).click(); await future.locator('[data-reason="ONGOING_EXIT_REQUIRED"]').waitFor();
  });
  await check('full browser worker responses match direct CPython for every API and status', async () => {
    const start = Date.now();
    const actual = await page.evaluate(async requests => {
      const { PythonBridge } = await import('./scripts/pyodide-bridge.js');
      const bridge = new PythonBridge();
      const results = [], timings = [];
      const initialization = performance.now();
      await bridge.start();
      const startupMs = performance.now() - initialization;
      try { for (const request of requests) {
        const started = performance.now();
        results.push(await bridge.request(request)); timings.push(performance.now() - started);
      } }
      finally { bridge.cancel(); }
      return { results, timings, startupMs };
    }, cases.map(item => item.request));
    cases.forEach((item, index) => assert.deepEqual(actual.results[index], item.expected, item.name));
    const sorted = [...actual.timings].sort((a, b) => a - b);
    console.log(`MEASURE worker initialization ${Math.round(actual.startupMs)} ms; warm request median ${sorted[Math.floor(sorted.length / 2)].toFixed(1)} ms, p95 ${sorted[Math.floor(sorted.length * .95)].toFixed(1)} ms`);
    for (const name of ['500_records', '10000_occupied_days', '10000_day_search', '100_scenarios']) console.log(`MEASURE ${name} ${actual.timings[cases.findIndex(item => item.name === name)].toFixed(1)} ms`);
    console.log(`MEASURE ${cases.length} parity cases including 500 records ${Date.now() - start} ms (new worker included)`);
  });
  await check('rapid edits during real loading discard stale responses; fresh results use new date', async () => {
    const rapid = await context.newPage();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await rapid.route('**/python/schengenstay.zip', async route => { await gate; await route.continue(); });
    await rapid.goto(`${origin}#calculator`);
    await rapid.locator('#field-complete').check(); await rapid.locator('#field-scope').selectOption('COUNTABLE_SHORT_STAYS');
    await rapid.locator('[data-focus="run-history"]').click();
    await rapid.locator('[data-runtime="loading"]').waitFor();
    await rapid.locator('#field-checkDate').fill('2024-01-01'); await rapid.locator('#field-checkDate').blur();
    await rapid.locator('#field-checkDate').fill('01/02/20');
    await rapid.locator('#field-checkDate').evaluate(node => { window.pendingDateNode = node; });
    release(); await rapid.locator('[data-runtime="ready"]').waitFor({ timeout: 90000 });
    assert.equal(await rapid.locator('[data-result-status]').count(), 0);
    assert.equal(await rapid.locator('#field-checkDate').inputValue(), '01/02/20');
    assert.equal(await rapid.evaluate(() => document.activeElement === window.pendingDateNode), true);
    assert.equal(await rapid.locator('#field-checkDate').evaluate(node => node.selectionStart), 8);
    await rapid.locator('#field-checkDate').pressSequentially('24');
    await rapid.locator('#field-checkDate').blur();
    await rapid.locator('[data-focus="run-history"]').click(); await rapid.locator('[data-value="check_date"]').first().waitFor();
    assert.match(await rapid.locator('[data-value="check_date"]').first().innerText(), /1 Feb 2024/);
    await rapid.close();
  });
  await check('offline loading failure is recoverable and has no success result', async () => {
    const offline = await browser.newContext({ offline: false });
    await offline.route('https://cdn.jsdelivr.net/**', route => route.abort());
    const failure = await offline.newPage(); await failure.goto(`${origin}#calculator`);
    await failure.locator('[data-focus="run-history"]').click(); await failure.locator('[data-runtime="error"]').waitFor({ timeout: 90000 });
    assert.equal(await failure.locator('[data-result-status]').count(), 0);
    await offline.unroute('https://cdn.jsdelivr.net/**');
    await failure.getByRole('button', { name: 'Retry loading' }).click(); await failure.locator('[data-runtime="ready"]').waitFor({ timeout: 90000 });
    await failure.locator('[data-focus="run-history"]').click(); await failure.locator('[data-result-status="INSUFFICIENT_DATA"]').first().waitFor();
    await offline.close();
  });
  await check('corrupted storage is not restored and can be deleted explicitly', async () => {
    await page.evaluate(() => localStorage.setItem('schengenstay.workspace.v1', '{broken'));
    await page.reload(); await go('settings');
    assert.match(await page.locator('[role="alert"]').innerText(), /Nothing was restored/);
    await page.getByRole('button', { name: 'Disable saving & delete saved data' }).click();
    assert.equal(await page.evaluate(() => localStorage.length), 0);
  });
  await check('real initialization on a mobile viewport; all six result layouts fit narrow screens', async () => {
    // Firefox supports viewport testing but not Playwright's mobile emulation flag.
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(browserName === 'firefox' ? {} : { isMobile: true }), deviceScaleFactor: 2 });
    const mobile = await mobileContext.newPage();
    await mobile.goto(`${origin}#calculator`); await mobile.locator('#field-complete').check(); await mobile.locator('#field-scope').selectOption('COUNTABLE_SHORT_STAYS');
    const start = Date.now(); await mobile.locator('[data-focus="run-history"]').click(); await mobile.locator('[data-result-status="WITHIN_RULE"]').first().waitFor({ timeout: 90000 });
    console.log(`MEASURE mobile viewport first calculation ${Date.now() - start} ms`);
    // Render real responses already cross-checked against CPython, never invented results.
    for (const language of ['en', 'ru']) {
      for (const width of [390, 320]) {
        await mobile.setViewportSize({ width, height: 844 });
        const overflow = await mobile.evaluate(async ({ cases, language }) => {
          const { resultCard } = await import('./scripts/results.js');
          const { translator } = await import('./scripts/i18n.js');
          const ctx = { language, t: translator(language) };
          document.querySelector('main').replaceChildren(...cases.map(item => resultCard(ctx, item.expected)));
          return document.documentElement.scrollWidth > innerWidth;
        }, { cases, language });
        assert.equal(overflow, false, `${language}/${width}`);
      }
    }
    await mobileContext.close();
  });
  await check('calculation network uses static GET assets only; no history leaves the browser', async () => {
    assert.deepEqual(errors, []);
    for (const item of network) {
      assert.equal(item.method, 'GET'); assert.equal(item.body, null);
      assert.ok(item.url.startsWith(origin) || item.url.startsWith('https://cdn.jsdelivr.net/pyodide/v314.0.7/full/'), item.url);
      assert.equal(new URL(item.url).search, '');
    }
  });
  await contextChecks({ browser, origin, check });
  await releaseChecks({ browser, origin, check });
  await analyticsCalculationCheck({ browser, origin, check });
  console.log(`${checks} Python/browser integration checks and ${cases.length} full-result parity cases passed in ${browserName} ${browser.version()}.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
