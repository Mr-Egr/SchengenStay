import test from 'node:test';
import assert from 'node:assert/strict';
import { createDateDraft, displayDate, parseDateText, localizeDraft } from '../../web/scripts/date-input.js';

test('localized display is predictable and ISO paste is accepted in both languages', () => {
  assert.equal(displayDate('2026-09-30', 'ru'), '30.09.2026');
  assert.equal(displayDate('2026-09-30', 'en'), '30/09/2026');
  for (const language of ['en', 'ru']) assert.equal(parseDateText(' 2026-09-30 ', language), '2026-09-30');
  assert.equal(parseDateText('30.09.2026', 'ru'), '2026-09-30');
  assert.equal(parseDateText('30/09/2026', 'en'), '2026-09-30');
  assert.equal(parseDateText('30.09.2026', 'en'), '');
});

test('partial years never normalize into 0002; validation waits for complete text', () => {
  const full = '30.09.2026';
  for (let i = 1; i < full.length; i++) assert.equal(parseDateText(full.slice(0, i), 'ru'), '');
  assert.equal(parseDateText(full, 'ru'), '2026-09-30');
  assert.equal(parseDateText('30.09.0002', 'ru'), '0002-09-30'); // Explicit four-digit year, no fabricated minimum-year cutoff.
});

test('impossible dates, leap boundaries, malformed values and date limits', () => {
  for (const text of ['', '31.02.2026', '29.02.2025', '31.04.2026', '00.01.2026', '01.13.2026', '30.09.26', '01.01.0000', '2026-02-31']) assert.equal(parseDateText(text, 'ru'), '');
  assert.equal(parseDateText('29.02.2024', 'ru'), '2024-02-29');
  assert.equal(parseDateText('29/06/0001', 'en'), '0001-06-29');
  assert.equal(parseDateText('31.12.9999', 'ru'), '9999-12-31');
  assert.equal(parseDateText(null, 'en'), '');
});

test('language switching reformats complete dates and preserves unfinished drafts', () => {
  const draft = createDateDraft('2026-09-30', 'en');
  localizeDraft(draft, 'ru'); assert.equal(draft.text, '30.09.2026');
  localizeDraft(draft, 'en'); assert.equal(draft.text, '30/09/2026');
  draft.text = '30/09/20';
  localizeDraft(draft, 'ru'); assert.equal(draft.text, '30/09/20');
  draft.text = ''; localizeDraft(draft, 'en'); assert.equal(draft.text, '');
});
