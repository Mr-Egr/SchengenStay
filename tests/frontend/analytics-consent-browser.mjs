import assert from 'node:assert/strict';

const key = 'schengenstay.analytics-consent.v1';
const historyKey = 'schengenstay.workspace.v1';
const read = (page, name = key) => page.evaluate(name => localStorage.getItem(name), name);
const visit = async (page, origin, route = 'settings') => {
  await page.goto(`${origin.replace(/\/$/, '')}/#${route}`);
  await page.locator(`nav a[href="#${route}"][aria-current="page"]`).waitFor();
};
const withdraw = page => page.getByRole('button', { name: 'Withdraw analytics consent', exact: true }).click();

export async function analyticsConsentChecks({ browser, origin, check }) {
  await check('analytics defaults off; keyboard opt-in persists only a separate versioned choice', async () => {
    const context = await browser.newContext();
    const requests = [];
    context.on('request', request => requests.push(request.url()));
    const page = await context.newPage();
    await visit(page, origin);
    assert.equal(await page.locator('#field-analytics').isChecked(), false);
    assert.equal(await read(page), null);
    assert.equal(await read(page, historyKey), null);
    await page.locator('#field-analytics').focus(); await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'field-analytics');
    const saved = JSON.parse(await read(page));
    assert.deepEqual(Object.keys(saved).sort(), ['allowed', 'expires_at', 'notice_version', 'schema_version']);
    assert.equal(saved.allowed, true); assert.equal(saved.schema_version, 1); assert.equal(saved.notice_version, 1);
    assert.equal(await read(page, historyKey), null);
    assert.match(await page.locator('main').innerText(), /Analytics is still inactive/);
    await page.reload(); await page.locator('#field-analytics').waitFor();
    assert.equal(await page.locator('#field-analytics').isChecked(), true);
    await withdraw(page);
    assert.equal(JSON.parse(await read(page)).allowed, false);
    await page.reload(); await page.locator('#field-analytics').waitFor();
    assert.equal(await page.locator('#field-analytics').isChecked(), false);
    assert.ok(requests.every(url => !url.includes('cloudflareinsights.com')));
    assert.equal(await page.locator('script[src*="cloudflare"], iframe').count(), 0);
    await context.close();
  });
  await check('analytics and history choices are independent; withdrawal preserves saved trips', async () => {
    const context = await browser.newContext(); const page = await context.newPage();
    const requests = []; context.on('request', r => requests.push({ url: r.url(), body: r.postData() }));
    await visit(page, origin, 'history');
    await page.getByRole('button', { name: 'Add trip', exact: true }).first().click();
    await page.locator('#field-entry').fill('2024-01-01'); await page.locator('#field-exit').fill('2024-01-03');
    await page.locator('#field-label').fill('ANALYTICS_PRIVATE_LABEL');
    await page.locator('#field-note').fill('ANALYTICS_PRIVATE_NOTE');
    await page.locator('dialog button[type="submit"]').click(); await page.locator('dialog').waitFor({ state: 'detached' });
    await page.locator('nav a[href="#settings"]').click();
    await page.locator('#field-saving').check();
    const before = await read(page, historyKey);
    await page.locator('#field-analytics').check(); const choice = await read(page);
    await page.locator('#field-saving').uncheck();
    assert.equal(await read(page, historyKey), null); assert.equal(await read(page), choice);
    await page.locator('#field-saving').check(); await withdraw(page);
    assert.equal(await read(page, historyKey), before);
    await page.locator('nav a[href="#history"]').click();
    assert.match(await page.locator('.trip-row').innerText(), /ANALYTICS_PRIVATE_LABEL/);
    assert.ok(requests.every(r => r.body === null && !/cloudflareinsights|ANALYTICS_PRIVATE|2024-01/.test(r.url)));
    await context.close();
  });
  await check('cross-tab withdrawal is immediate; another open tab cannot grant analytics consent', async () => {
    const context = await browser.newContext(); const a = await context.newPage(); const b = await context.newPage();
    await visit(a, origin); await visit(b, origin);
    await a.locator('#field-analytics').check();
    // Wait for storage event delivery, not a timing-dependent negative assertion.
    await b.waitForFunction(key => JSON.parse(localStorage.getItem(key)).allowed, key);
    assert.equal(await b.locator('#field-analytics').isChecked(), false);
    await b.reload(); await b.locator('#field-analytics:checked').waitFor();
    await withdraw(a); await b.locator('#field-analytics:not(:checked)').waitFor();
    assert.equal(await b.locator('#field-analytics').isChecked(), false);
    await context.close();
  });
  await check('corrupt, expired and old-notice consent fail closed; blocked storage remains usable', async () => {
    const context = await browser.newContext(); const page = await context.newPage(); await visit(page, origin);
    for (const text of ['{"allowed":true}', JSON.stringify({ schema_version: 1, notice_version: 1, allowed: true, expires_at: 1 }),
      JSON.stringify({ schema_version: 1, notice_version: 0, allowed: true, expires_at: Date.now() + 60000 })]) {
      await page.evaluate(({ key, text }) => localStorage.setItem(key, text), { key, text });
      await page.reload(); await page.locator('#field-analytics').waitFor();
      assert.equal(await page.locator('#field-analytics').isChecked(), false);
      assert.match(await page.locator('[role="alert"]').innerText(), /expired or unreadable/);
    }
    await page.evaluate(key => {
      const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
      Storage.prototype.setItem = function(name, value) { if (name === key) throw Error('blocked'); return set.call(this, name, value); };
      Storage.prototype.removeItem = function(name) { if (name === key) throw Error('blocked'); return remove.call(this, name); };
    }, key);
    await page.locator('#field-analytics').check(); assert.match(await page.locator('[role="alert"]').innerText(), /could not be saved/);
    await withdraw(page); assert.match(await page.locator('[role="alert"]').innerText(), /blocked saving/);
    assert.equal(await page.locator('#field-analytics').isChecked(), false);
    await page.locator('nav a[href="#history"]').click();
    await page.getByRole('button', { name: 'Add trip', exact: true }).first().click();
    await page.locator('dialog[open]').waitFor(); await page.keyboard.press('Escape');
    await context.close();
  });
  await check('EN/RU consent notices fit mobile and desktop in both themes without analytics connections', async () => {
    const context = await browser.newContext(); const page = await context.newPage(); const requests = [];
    context.on('request', r => requests.push(r.url())); await visit(page, origin);
    for (const language of ['en', 'ru']) {
      await page.locator('#field-language').selectOption(language);
      for (const theme of ['light', 'dark']) {
        await page.locator(`[data-focus="theme-${theme}"]`).click();
        for (const width of [320, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${language}/${theme}/${width}`);
          assert.match(await page.locator('main').innerText(), /Cloudflare/);
          assert.match(await page.locator('main').innerText(), language === 'en' ? /not a guarantee of anonymity/ : /Анонимность не гарантируется/);
          await page.locator('#field-analytics').check(); await page.locator('#field-analytics').uncheck();
        }
      }
    }
    await page.goto(`${origin.replace(/\/$/, '')}/?private_canary=NEVER_SEND#PRIVATE_NOTE`);
    await page.locator('h1').waitFor();
    assert.ok(requests.every(url => !url.includes('cloudflareinsights.com')));
    // A manually supplied document query reaches the host, not analytics. The app
    // never creates such URLs from form inputs and no beacon is loaded here.
    await context.close();
  });
}

export async function analyticsCalculationCheck({ browser, origin, check }) {
  await check('real Python results and travel history survive consent selection and withdrawal', async () => {
    const context = await browser.newContext(); const page = await context.newPage(); const requests = [];
    context.on('request', r => requests.push({ url: r.url(), body: r.postData() }));
    await visit(page, origin, 'history');
    await page.getByRole('button', { name: 'Add trip', exact: true }).first().click();
    await page.locator('#field-entry').fill('2024-01-01'); await page.locator('#field-exit').fill('2024-03-30');
    await page.locator('#field-label').fill('PRIVATE_90_DAY_HISTORY');
    await page.locator('dialog button[type="submit"]').click(); await page.locator('dialog').waitFor({ state: 'detached' });
    await page.locator('nav a[href="#calculator"]').click();
    await page.locator('#field-checkDate').fill('2024-03-30'); await page.locator('#field-checkDate').blur();
    await page.locator('#field-complete').check(); await page.locator('#field-scope').selectOption('COUNTABLE_SHORT_STAYS');
    await page.locator('[data-focus="run-history"]').click();
    await page.locator('[data-result-status="WITHIN_RULE"]').first().waitFor({ timeout: 90000 });
    const result = await page.locator('main > .panel [data-result-status]').first().innerText();
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), '90');
    for (const allowed of [true, false]) {
      await page.locator('nav a[href="#settings"]').click();
      if (allowed) await page.locator('#field-analytics').check(); else await withdraw(page);
      await page.locator('nav a[href="#calculator"]').click();
      assert.equal(await page.locator('main > .panel [data-result-status]').first().innerText(), result);
      assert.equal(await page.locator('.metric.used .metric-value').innerText(), '90');
    }
    await page.locator('[data-focus="run-history"]').click();
    await page.locator('[data-result-status="WITHIN_RULE"]').first().waitFor({ timeout: 90000 });
    assert.ok(requests.every(r => r.body === null && !/cloudflareinsights|PRIVATE_90_DAY|2024-03/.test(r.url)));
    await context.close();
  });
}
