import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Real worker/UI checks; no simulated successful calculations.
export async function contextChecks({ browser, origin, check }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-23T12:00:00Z') });
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(String(error)));
  context.on('request', request => network.push({ url: request.url(), method: request.method(), body: request.postData() }));
  const go = async route => {
    await page.evaluate(route => { location.hash = route; }, route);
    await page.locator(`nav a[href="#${route}"][aria-current="page"]`).waitFor({ state: 'attached' });
  };
  const kind = value => page.locator('#field-legalKind').selectOption(value);
  const confirm = async () => { await page.locator('#field-complete').check(); await page.locator('#field-scope').selectOption('COUNTABLE_SHORT_STAYS'); };
  const run = async status => {
    await page.locator('[data-focus="run-history"]').click();
    await page.locator(`main > .panel [data-result-status="${status}"]`).first().waitFor({ timeout: 90000 });
  };
  const noSuccess = async () => {
    assert.equal(await page.locator('[data-result-status="WITHIN_RULE"]').count(), 0);
    assert.equal(await page.locator('.metric.used .metric-value').innerText(), '—');
    assert.equal(await page.locator('.metric.remaining .metric-value').innerText(), '—');
  };
  try {
    await page.goto(`${origin}#calculator`);
    await page.locator('#field-checkDate').fill('2024-03-31'); await page.locator('#field-checkDate').blur();
    await check('all legal-context choices gate real Python results without reassuring numbers', async () => {
      await confirm(); await run('WITHIN_RULE');
      assert.equal(await page.locator('.metric.used .metric-value').innerText(), '0');
      for (const value of ['UNKNOWN', 'SHORT_STAY_VISA', 'LONG_STAY_VISA', 'RESIDENCE_PERMIT', 'PENDING_APPLICATION', 'NATIONAL_EXTENSION', 'BILATERAL_ARRANGEMENT', 'MIXED_HISTORY', 'OTHER']) {
        await kind(value);
        assert.equal(await page.locator('[data-result-status]').count(), 0);
        await run(value === 'UNKNOWN' ? 'INSUFFICIENT_DATA' : 'OUT_OF_SCOPE');
        await noSuccess();
        assert.ok(await page.locator(`[data-context-review="${value}"]`).count());
      }
    });
    await check('optional visa dates use Python consistency checks and never validate a visa', async () => {
      await kind('SHORT_STAY_VISA'); await page.locator('#field-visaDatesEnabled').check();
      await run('OUT_OF_SCOPE');
      assert.equal(await page.locator('[data-visa-date-check="INSUFFICIENT_DATA"]').count(), 1);
      await page.locator('#field-valid_from').fill('2024-03-01'); await page.locator('#field-valid_until').fill('2024-02-29');
      await run('INVALID_INPUT'); await noSuccess();
      assert.match(await page.locator('.result-issues').innerText(), /legal_context.valid_until/);
      await page.locator('#field-valid_from').fill('2024-02-29');
      await run('OUT_OF_SCOPE'); await noSuccess();
      assert.equal(await page.locator('[data-visa-date-check="ORDER_ONLY"]').count(), 1);
      assert.match(await page.locator('[data-visa-date-check]').innerText(), /Nothing about visa validity/);
      await page.locator('#field-valid_until').fill('31/02/2024'); await page.locator('#field-valid_until').blur();
      assert.equal(await page.locator('#field-valid_until').getAttribute('aria-invalid'), 'true');
      await page.locator('[data-focus="run-history"]').click();
      assert.equal(await page.locator('[data-result-status]').count(), 0);
      await page.locator('#field-valid_until').fill('2024-03-01'); await page.locator('#field-valid_until').blur();
    });
    await check('history edits revoke old confirmations while retaining declared special context', async () => {
      await kind('MIXED_HISTORY'); await go('history');
      await page.locator('[data-focus="add-trip"]').first().click();
      await page.locator('#field-entry').fill('2024-02-28'); await page.locator('#field-exit').fill('2024-03-01');
      await page.locator('dialog button[type="submit"]').click(); await page.locator('dialog').waitFor({ state: 'detached' });
      await go('calculator');
      assert.equal(await page.locator('#field-legalKind').inputValue(), 'MIXED_HISTORY');
      assert.equal(await page.locator('#field-complete').isChecked(), false);
      assert.equal(await page.locator('#field-scope').inputValue(), 'UNKNOWN');
      await run('OUT_OF_SCOPE'); await noSuccess();
      await kind('ARITHMETIC_ONLY'); await run('INSUFFICIENT_DATA'); await noSuccess();
      await confirm(); await run('WITHIN_RULE');
      assert.equal(await page.locator('.metric.used .metric-value').innerText(), '3');
    });
    await check('fixed, maximum, earliest and comparison reject unsupported context without changing history', async () => {
      await go('planner'); await kind('PENDING_APPLICATION');
      for (const mode of ['fixed', 'maximum', 'earliest']) {
        await page.locator('[data-focus="new-scenario"]').first().click();
        await page.locator('#field-label').fill(`Context ${mode}`); await page.locator('#field-mode').selectOption(mode);
        await page.locator('#field-entry').fill('2024-04-01');
        if (mode === 'fixed') await page.locator('#field-exit').fill('2024-04-02');
        else { await page.locator('#field-horizon').fill('20'); if (mode === 'earliest') await page.locator('#field-length').fill('2'); }
        await page.locator('dialog button[type="submit"]').click(); await page.locator('dialog').waitFor({ state: 'detached' });
        const card = page.locator('.scenario-card').filter({ hasText: `Context ${mode}` });
        await card.locator('[data-focus]').filter({ hasText: 'Evaluate scenario' }).click();
        await card.locator('[data-result-status="OUT_OF_SCOPE"]').first().waitFor();
        assert.equal(await card.locator('[data-result-status="WITHIN_RULE"]').count(), 0);
      }
      await page.locator('[data-focus="compare"]').click();
      await page.locator('[data-result-slot="comparison"] [data-result-status="OUT_OF_SCOPE"]').first().waitFor();
      await go('history'); assert.equal(await page.locator('.trip-row').count(), 1);
    });
    await check('visa date editing, locale/theme, narrow layouts and storage consent preserve privacy', async () => {
      for (const language of ['en', 'ru']) {
        await go('settings'); await page.locator('#field-language').selectOption(language);
        for (const theme of ['light', 'dark']) {
          await go('settings'); await page.locator(`[data-focus="theme-${theme}"]`).click();
          await go('calculator'); await kind('SHORT_STAY_VISA');
          await page.setViewportSize({ width: 320, height: 900 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          const input = page.locator('#field-valid_from');
          await input.fill('');
          const text = language === 'ru' ? '30.09.2026' : '30/09/2026';
          for (const character of text) await input.pressSequentially(character);
          assert.equal(await input.inputValue(), text);
          assert.equal(await input.evaluate(node => node.selectionStart), 10);
          await input.press('Alt+ArrowDown'); await page.keyboard.press('Escape');
          assert.equal(await page.locator('#field-valid_from-picker').isVisible(), false);
        }
      }
      if (process.env.SCREENSHOT_DIR) {
        await page.locator('#field-valid_until').fill('2026-10-01'); await page.locator('#field-valid_until').blur();
        await run('OUT_OF_SCOPE');
        await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, 'stage6-context-mobile-ru-dark.png'), fullPage: true });
      }
      await go('settings'); await page.locator('#field-saving').check();
      const stored = await page.evaluate(() => localStorage.getItem('schengenstay.workspace.v1'));
      assert.doesNotMatch(stored, /legalKind|visaDates|valid_from|valid_until|SHORT_STAY_VISA/);
      await page.reload(); await go('calculator');
      assert.equal(await page.locator('#field-legalKind').inputValue(), 'ARITHMETIC_ONLY');
      assert.equal(await page.locator('#field-scope').inputValue(), 'UNKNOWN');
      assert.equal(await page.locator('#field-complete').isChecked(), false);
      await kind('SHORT_STAY_VISA'); assert.equal(await page.locator('#field-visaDatesEnabled').isChecked(), false);
      await page.locator('#field-visaDatesEnabled').check(); assert.equal(await page.locator('#field-valid_from').inputValue(), '');
      await go('settings'); await page.locator('#field-saving').uncheck();
      assert.equal(await page.evaluate(() => localStorage.getItem('schengenstay.workspace.v1')), null);
      assert.deepEqual(errors, []);
      for (const request of network) {
        assert.equal(request.method, 'GET'); assert.equal(request.body, null);
        assert.ok(request.url.startsWith(origin) || request.url.startsWith('https://cdn.jsdelivr.net/pyodide/v314.0.7/full/'));
        assert.equal(new URL(request.url).search, '');
      }
    });
  } finally { await context.close(); }
}
