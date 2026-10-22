import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Real DOM/keyboard/clipboard checks, also called by the existing interface suite.
export async function dateInputChecks({ browser, origin, check }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, locale: 'ru-RU', timezoneId: 'Europe/Minsk' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-23T12:00:00Z') });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const go = async route => {
    await page.evaluate(route => { location.hash = route; }, route);
    await page.locator(`nav a[href="#${route}"][aria-current="page"]`).waitFor({ state: 'attached' });
  };
  async function language(value) {
    await go('settings'); await page.locator('#field-language').selectOption(value);
  }
  async function paste(selector, value) {
    await page.evaluate(value => navigator.clipboard.writeText(value), value);
    await page.locator(selector).focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('ControlOrMeta+V');
  }
  const save = () => page.locator('dialog button[type="submit"]').click();
  const value = name => page.locator(`input[type="hidden"][name="${name}"]`).inputValue();
  try {
    await page.goto(origin); await page.locator('h1').waitFor();
    await language('ru');
    await check('RU character-by-character entry on all three check-date screens keeps node, caret and year', async () => {
      for (const screen of ['dashboard', 'calculator', 'planner']) {
        await go(screen);
        const input = page.locator('#field-checkDate');
        assert.equal(await input.getAttribute('type'), 'text');
        await input.fill('');
        await input.evaluate(node => { window.typingNode = node; });
        const text = '30.09.2026';
        for (let index = 0; index < text.length; index++) {
          await input.pressSequentially(text[index]);
          assert.equal(await input.inputValue(), text.slice(0, index + 1));
          assert.equal(await input.evaluate(node => node.selectionStart), index + 1);
          assert.equal(await page.evaluate(() => document.activeElement === window.typingNode), true);
          assert.equal(await value('checkDate'), index === text.length - 1 ? '2026-09-30' : '');
          assert.equal(await input.getAttribute('aria-invalid'), null);
        }
        await input.blur(); assert.equal(await input.inputValue(), text);
      }
    });
    await check('year replacement, actual clipboard paste, clearing, invalid dates and no interrupted typing', async () => {
      const input = page.locator('#field-checkDate');
      await input.focus(); await input.evaluate(node => node.setSelectionRange(6, 10));
      await input.pressSequentially('2024');
      assert.equal(await input.inputValue(), '30.09.2024'); assert.equal(await value('checkDate'), '2024-09-30');
      await paste('#field-checkDate', '29.02.2024'); await input.blur();
      assert.equal(await value('checkDate'), '2024-02-29');
      await paste('#field-checkDate', '31.02.2026');
      assert.equal(await input.getAttribute('aria-invalid'), null);
      await input.blur(); assert.equal(await input.getAttribute('aria-invalid'), 'true');
      assert.match(await page.locator('#field-checkDate-error').innerText(), /существующую дату/);
      await page.locator('[data-focus="run-history"]').click();
      assert.equal(await page.locator('[data-result-status]').count(), 0);
      await input.fill(''); await input.blur(); assert.equal(await value('checkDate'), '');
      await paste('#field-checkDate', '2026-09-30'); await input.blur();
      assert.equal(await input.inputValue(), '30.09.2026');
    });
    await check('calendar selection, keyboard navigation, month/year jumps, Escape and clear work', async () => {
      const picker = page.locator('#field-checkDate-picker');
      await page.locator('#date-field-checkDate .date-toggle').click();
      assert.equal(await picker.isVisible(), true);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.pickerDate), '2026-09-30');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.pickerDate), '2026-10-01');
      await page.keyboard.press('Enter'); assert.equal(await picker.isVisible(), false);
      assert.equal(await value('checkDate'), '2026-10-01');
      await page.locator('#field-checkDate').press('Alt+ArrowDown');
      await page.keyboard.press('PageUp'); assert.equal(await page.evaluate(() => document.activeElement.dataset.pickerDate), '2026-09-01');
      await page.keyboard.press('Escape'); assert.equal(await picker.isVisible(), false);
      assert.equal(await value('checkDate'), '2026-10-01'); // Browsing did not change selection.
      assert.equal(await page.locator('.date-toggle').evaluate(node => node === document.activeElement), true);
      await page.locator('.date-toggle').click();
      await picker.getByLabel('Год', { exact: true }).fill('2024'); await picker.getByLabel('Год', { exact: true }).press('Enter');
      await picker.getByLabel('Месяц', { exact: true }).selectOption('02');
      await picker.locator('[data-picker-date="2024-02-29"]').click();
      assert.equal(await value('checkDate'), '2024-02-29');
      await page.locator('.date-toggle').click();
      await picker.getByLabel('Год', { exact: true }).fill('2025');
      await picker.getByRole('button', { name: 'Сегодня', exact: true }).click();
      assert.equal(await value('checkDate'), '2026-10-23');
      await page.locator('.date-toggle').click(); await picker.getByRole('button', { name: 'Очистить дату' }).click();
      assert.equal(await value('checkDate'), ''); assert.equal(await page.locator('#field-checkDate').inputValue(), '');
    });
    await check('history dialog date drafts survive type changes, picker Escape, save/edit/cancel and reopen', async () => {
      await go('history'); await page.locator('[data-focus="add-trip"]').first().click();
      await page.locator('#field-label').fill('Date UX regression');
      await page.locator('#field-entry').pressSequentially('30.09.2026');
      await page.locator('#field-exit').pressSequentially('02.10.2026');
      await page.locator('#field-kind').selectOption('ongoing');
      await page.locator('#field-kind').selectOption('completed');
      assert.equal(await page.locator('#field-entry').inputValue(), '30.09.2026');
      assert.equal(await page.locator('#field-exit').inputValue(), '02.10.2026');
      await page.locator('#date-field-entry .date-toggle').click(); await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog.editor-dialog').isVisible(), true);
      assert.equal(await page.locator('#field-entry-picker').isVisible(), false);
      await save(); await page.locator('dialog.editor-dialog').waitFor({ state: 'detached' });
      await page.locator('.trip-row .row-actions button').first().click();
      assert.equal(await value('entry'), '2026-09-30'); assert.equal(await value('exit'), '2026-10-02');
      await page.locator('#field-entry').fill('01.10.2026'); await page.keyboard.press('Escape');
      await page.locator('dialog.editor-dialog').waitFor({ state: 'detached' });
      await page.locator('.trip-row .row-actions button').first().click();
      assert.equal(await value('entry'), '2026-09-30');
      await page.keyboard.press('Escape'); await page.locator('dialog.editor-dialog').waitFor({ state: 'detached' });
    });
    await check('English dates and fixed/max/earliest scenario modes preserve ISO and unfinished text', async () => {
      await language('en'); await go('planner');
      await page.locator('#field-checkDate').fill('30/09/2026'); await page.locator('#field-checkDate').blur();
      await page.locator('[data-focus="new-scenario"]').first().click();
      await page.locator('#field-entry').pressSequentially('01/11/2026');
      await page.locator('#field-exit').pressSequentially('10/11/2026');
      await page.locator('#field-mode').selectOption('maximum'); assert.equal(await value('entry'), '2026-11-01');
      await page.locator('#field-entry').fill('01/11/20');
      await page.locator('#field-mode').selectOption('earliest');
      assert.equal(await page.locator('#field-entry').inputValue(), '01/11/20');
      await page.locator('#field-entry').fill('01/11/2026');
      await page.locator('#field-mode').selectOption('fixed');
      assert.equal(await page.locator('#field-exit').inputValue(), '10/11/2026');
      await save(); await page.locator('dialog.editor-dialog').waitFor({ state: 'detached' });
      await language('ru'); await go('planner');
      assert.equal(await page.locator('#field-checkDate').inputValue(), '30.09.2026');
      await page.locator('.scenario-card .row-actions button').first().click();
      assert.equal(await page.locator('#field-entry').inputValue(), '01.11.2026');
      await page.keyboard.press('Escape'); await page.locator('dialog.editor-dialog').waitFor({ state: 'detached' });
    });
    await check('unrelated rerenders preserve the active date node and caret; locale changes preserve partial draft', async () => {
      const input = page.locator('#field-checkDate');
      await input.fill('30.09.20'); await input.evaluate(node => { node.setSelectionRange(6, 8); window.retainedDate = node; });
      // A real app hash render, analogous to asynchronous runtime-state rendering.
      await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
      assert.equal(await input.evaluate(node => node === window.retainedDate), true);
      assert.equal(await input.inputValue(), '30.09.20');
      await input.focus(); await input.evaluate(node => node.setSelectionRange(6, 8));
      await page.locator('#field-budget').fill('500'); await page.locator('#field-budget').blur();
      assert.equal(await input.inputValue(), '30.09.20');
      await language('en'); await go('planner');
      assert.equal(await input.inputValue(), '30.09.20');
      await input.fill('30/09/2026'); await input.blur();
    });
    await check('date fields and pickers fit desktop/mobile, both languages and themes with scoped focus styles', async () => {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const lang of ['en', 'ru']) {
          await language(lang);
          for (const theme of ['light', 'dark']) {
            await go('settings'); await page.locator(`[data-focus="theme-${theme}"]`).click(); await go('calculator');
            await page.locator('.date-toggle').click();
            const picker = page.locator('#field-checkDate-picker');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}/${lang}/${theme}`);
            assert.equal(await picker.evaluate(node => node.scrollWidth <= node.clientWidth), true, `picker ${width}/${lang}/${theme}`);
            assert.ok(await page.locator('.date-toggle').evaluate(node => node.getBoundingClientRect().width >= 44 && node.getBoundingClientRect().height >= 44));
            assert.ok(await picker.locator('[tabindex="0"]').evaluate(node => node.getBoundingClientRect().height >= 44));
            await page.keyboard.press('Escape');
            await page.locator('#field-checkDate').focus();
            const styles = await page.locator('#field-checkDate').evaluate(node => ({ outline: getComputedStyle(node).outlineColor, selection: getComputedStyle(node, '::selection').backgroundColor }));
            assert.equal(styles.outline, theme === 'light' ? 'rgb(40, 88, 68)' : 'rgb(191, 219, 172)');
            assert.equal(styles.selection, theme === 'light' ? 'rgb(220, 235, 207)' : 'rgb(71, 104, 66)');
          }
        }
      }
      await page.emulateMedia({ forcedColors: 'active' });
      await page.locator('#field-checkDate').focus();
      assert.notEqual(await page.locator('#field-checkDate').evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      await page.emulateMedia({ forcedColors: 'none' });
      assert.equal(await page.locator('input[type="date"]').count(), 0);
      assert.deepEqual(errors, []);
    });
    await check('calendar bounds and mobile dialog keyboard navigation preserve valid dates', async () => {
      const input = page.locator('#field-checkDate');
      await input.fill('29.06.0001'); await input.blur();
      await page.locator('.date-toggle').click();
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.pickerDate), '0001-06-29');
      await page.keyboard.press('Home');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.pickerDate), '0001-06-29');
      await page.keyboard.press('Escape');
      await input.fill('31.12.9999'); await input.blur();
      await page.locator('.date-toggle').click(); await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.pickerDate), '9999-12-31');
      await page.keyboard.press('PageDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.pickerDate), '9999-12-31');
      await page.keyboard.press('Escape');
      await input.fill('30.09.2026'); await input.blur();
      await go('history'); await page.locator('.trip-row .row-actions button').first().click();
      await page.locator('#date-field-entry .date-toggle').click();
      const picker = page.locator('#field-entry-picker');
      assert.equal(await picker.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      assert.equal(await page.locator('dialog').evaluate(node => node.scrollWidth <= node.clientWidth), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('dialog').evaluate(node => node.contains(document.activeElement)), true);
      await page.keyboard.press('Escape');
      assert.equal(await picker.isVisible(), false);
      assert.equal(await page.locator('dialog').isVisible(), true);
      await page.keyboard.press('Escape'); await page.locator('dialog').waitFor({ state: 'detached' });
      await go('calculator');
      assert.deepEqual(errors, []);
    });
    await check('date editing immediately clears calendar evidence from revoked ongoing confirmation', async () => {
      await go('history'); await page.locator('.trip-row .row-actions button').first().click();
      await page.locator('#field-kind').selectOption('ongoing');
      await save(); await page.locator('dialog').waitFor({ state: 'detached' });
      await go('dashboard');
      await page.locator('#field-checkDate').fill('02.10.2026'); await page.locator('#field-checkDate').blur();
      await page.locator('#field-ongoing').check();
      await page.locator('[data-date="2026-10-01"]').click();
      assert.match(await page.locator('[data-date="2026-10-01"]').getAttribute('class'), /recorded/);
      assert.match(await page.locator('.day-detail').innerText(), /Date UX regression/);
      await page.locator('#field-checkDate').fill('03.10.2026');
      assert.equal(await page.locator('#field-ongoing').isChecked(), false);
      assert.doesNotMatch(await page.locator('[data-date="2026-10-01"]').getAttribute('class'), /recorded/);
      assert.doesNotMatch(await page.locator('.day-detail').innerText(), /Date UX regression/);
      await page.locator('#field-checkDate').fill('30.09.2026'); await page.locator('#field-checkDate').blur();
      await go('calculator');
    });
    if (process.env.SCREENSHOT_DIR) {
      await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.locator('.date-toggle').click();
      await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, 'date-picker-mobile-ru-dark.png'), fullPage: true });
    }
  } finally { await context.close(); }
}
