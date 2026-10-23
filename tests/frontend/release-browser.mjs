import assert from 'node:assert/strict';

// Critical release journeys run with the real package on every selected engine.
export async function releaseChecks({ browser, origin, check }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const go = async route => {
    await page.evaluate(route => { location.hash = route; }, route);
    await page.locator(`nav a[href="#${route}"][aria-current="page"]`).waitFor({ state: 'attached' });
  };
  const save = async () => {
    await page.locator('dialog button[type="submit"]').click();
    await page.locator('dialog').waitFor({ state: 'detached' });
  };
  const confirm = async () => {
    await page.locator('#field-complete').check();
    await page.locator('#field-scope').selectOption('COUNTABLE_SHORT_STAYS');
  };
  const run = async () => {
    await page.locator('[data-focus="run-history"]').click();
    await page.locator('[data-result-status="WITHIN_RULE"]').first().waitFor({ timeout: 90000 });
  };
  try {
    await page.goto(`${origin}#history`);
    await check('complete add-confirm-calculate-plan-edit-recalculate-remove journey', async () => {
      await page.locator('[data-focus="add-trip"]').first().click();
      await page.locator('#field-label').fill('Release journey');
      await page.locator('#field-entry').fill('2024-02-28');
      await page.locator('#field-exit').fill('2024-03-01'); await save();
      await go('calculator'); await page.locator('#field-checkDate').fill('2024-03-31');
      await confirm(); await run();
      assert.equal(await page.locator('.metric.used .metric-value').innerText(), '3');
      assert.equal(await page.locator('.metric.remaining .metric-value').innerText(), '87');
      await go('planner'); await page.locator('[data-focus="new-scenario"]').first().click();
      await page.locator('#field-entry').fill('2024-04-01'); await page.locator('#field-exit').fill('2024-04-02'); await save();
      await page.getByRole('button', { name: 'Evaluate scenario' }).click();
      await page.locator('.scenario-card [data-result-status="WITHIN_RULE"]').first().waitFor();
      await go('history'); await page.getByRole('button', { name: 'Edit: Release journey', exact: true }).click();
      await page.locator('#field-exit').fill('2024-03-02'); await save();
      await go('planner'); assert.equal(await page.locator('[data-result-status]').count(), 0);
      assert.equal(await page.locator('#field-complete').isChecked(), false);
      await confirm(); await go('calculator'); await run();
      assert.equal(await page.locator('.metric.used .metric-value').innerText(), '4');
      await go('history'); await page.getByRole('button', { name: 'Remove: Release journey', exact: true }).click();
      await page.getByRole('button', { name: 'Remove entry', exact: true }).click();
      await page.locator('dialog').waitFor({ state: 'detached' });
      await go('dashboard'); assert.equal(await page.locator('[data-result-status]').count(), 0);
      assert.equal(await page.locator('.metric.used .metric-value').innerText(), '—');
      await confirm(); await run();
      assert.equal(await page.locator('.metric.used .metric-value').innerText(), '0');
    });
    await check('cross-engine date typing, year replacement, keyboard picker and responsive screens', async () => {
      for (const language of ['en', 'ru']) {
        await go('settings'); await page.locator('#field-language').selectOption(language);
        for (const theme of ['light', 'dark']) {
          await go('settings'); await page.locator(`[data-focus="theme-${theme}"]`).click();
          for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            for (const screen of ['dashboard', 'history', 'calculator', 'planner', 'calendar', 'settings', 'guide']) {
              await go(screen);
              assert.equal(await page.locator('h1').count(), 1);
              assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${screen}/${language}/${theme}/${width}`);
            }
            await go('calculator');
            const input = page.locator('#field-checkDate'), text = language === 'ru' ? '30.09.2026' : '30/09/2026';
            await input.fill(''); await input.evaluate(node => { window.releaseDateNode = node; });
            for (let i = 0; i < text.length; i++) {
              await input.pressSequentially(text[i]);
              assert.equal(await input.inputValue(), text.slice(0, i + 1));
              assert.equal(await input.evaluate(node => node === window.releaseDateNode && node.selectionStart === node.value.length), true);
            }
            await input.evaluate(node => node.setSelectionRange(6, 10)); await input.pressSequentially('2024');
            assert.equal(await page.locator('input[name="checkDate"]').inputValue(), '2024-09-30');
            await input.press('Alt+ArrowDown'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
            assert.equal(await page.locator('input[name="checkDate"]').inputValue(), '2024-10-01');
            await input.press('Alt+ArrowDown'); await page.keyboard.press('Escape');
            assert.equal(await page.locator('.date-toggle').evaluate(node => node === document.activeElement), true);
            await input.fill(language === 'ru' ? '31.02.2026' : '31/02/2026');
            assert.equal(await input.getAttribute('aria-invalid'), null);
            await input.blur(); assert.equal(await input.getAttribute('aria-invalid'), 'true');
            assert.ok(await page.locator('#field-checkDate-error').innerText());
          }
        }
      }
      assert.deepEqual(errors, []);
    });
    await check('real worker cancellation and missing worker asset recover without stale success', async () => {
      const actual = await page.evaluate(async () => {
        const { PythonBridge } = await import('./scripts/pyodide-bridge.js');
        const bridge = new PythonBridge();
        const request = { schema_version: 1, method: 'check_history', stays: [], as_of: '2024-03-31', scope: 'COUNTABLE_SHORT_STAYS', history_complete: true };
        const cancelled = bridge.request(request).catch(error => error.message);
        bridge.cancel();
        const code = await cancelled;
        try { return { code, result: await bridge.request(request), pending: bridge.pending.size }; }
        finally { bridge.cancel(); }
      });
      assert.equal(actual.code, 'CANCELLED'); assert.equal(actual.result.status, 'WITHIN_RULE'); assert.equal(actual.pending, 0);
      const missing = await page.evaluate(async () => {
        const { PythonBridge } = await import('./scripts/pyodide-bridge.js');
        const bridge = new PythonBridge({ workerFactory: () => new Worker('./missing-worker.js', { type: 'module' }) });
        try { await bridge.start(); return 'unexpected success'; }
        catch (error) { return error.message; }
        finally { bridge.cancel(); }
      });
      assert.equal(missing, 'LOAD_FAILED');
    });
    await check('already initialized calculations work when the browser goes offline', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await go('settings'); await page.locator('#field-language').selectOption('en');
      await go('calculator'); await page.locator('#field-checkDate').fill('2024-03-31'); await confirm(); await run();
      await context.setOffline(true);
      await page.locator('#field-checkDate').fill('2024-04-01'); await run();
      assert.match(await page.locator('[data-value="check_date"]').first().innerText(), /1 Apr 2024/);
      assert.equal(await page.locator('.metric.used .metric-value').innerText(), '0');
      await context.setOffline(false);
    });
  } finally { await context.close(); }
}
