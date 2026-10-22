import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createStore, validateTrip, validateScenario } from '../../web/scripts/store.js';
import { monthDays, moveMonth, recordsOnDate, parseDate, formatDate, todayISO } from '../../web/scripts/dates.js';
import { messages, translator } from '../../web/scripts/i18n.js';

const input = { label: 'Spring', entry: '2024-02-28', exit: '2024-03-01', note: '' };
const setup = () => { let id = 0; return createStore({ today: '2026-10-23', makeId: () => String(++id) }); };

test('empty session starts without seeded trips, scenarios or calculated results', () => {
  const store = setup();
  assert.deepEqual(store.trips, []);
  assert.deepEqual(store.scenarios, []);
  assert.equal(store.usedDays, undefined);
});
test('completed trip CRUD is immutable and sorts by entry', () => {
  const store = setup();
  const original = { ...input };
  const first = store.saveTrip(input).record;
  const snapshot = store.trips;
  store.saveTrip({ ...input, entry: '2025-01-01', exit: '2025-01-02' });
  assert.equal(store.trips[0].entry, '2025-01-01');
  assert.equal(snapshot.length, 1);
  assert.throws(() => snapshot.push(first), TypeError);
  assert.throws(() => { first.label = 'changed'; }, TypeError);
  store.saveTrip({ ...input, label: 'Updated' }, first.id);
  assert.equal(store.trips.length, 2);
  assert.equal(store.trips[1].label, 'Updated');
  store.removeTrip(first.id);
  assert.equal(store.trips.length, 1);
  assert.deepEqual(input, original);
});
test('inclusive overlaps and duplicates are rejected, adjacent dates are allowed', () => {
  const store = setup();
  const first = store.saveTrip(input).record;
  assert.equal(store.saveTrip(input).issues.entry, 'error.overlap');
  assert.equal(store.saveTrip({ ...input, entry: input.exit }).issues.entry, 'error.overlap');
  assert.deepEqual(store.saveTrip(input, first.id).issues, {});
  assert.deepEqual(store.saveTrip({ ...input, entry: '2024-03-02', exit: '2024-03-02' }).issues, {});
});
test('invalid dates and reversed intervals return field-specific feedback', () => {
  for (const value of ['', '2023-02-29', '2024-02-30', '2024-1-01', '0000-01-01', '10000-01-01']) {
    assert.equal(validateTrip({ ...input, entry: value }).entry, 'error.date');
  }
  assert.equal(validateTrip({ ...input, exit: '2024-01-01' }).exit, 'error.order');
});
test('completed stays cannot be future proposals or missing ongoing exits', () => {
  assert.equal(validateTrip({ ...input, exit: '2027-01-01' }, [], null, '2026-10-23').exit, 'error.futureHistory');
  assert.equal(validateTrip({ ...input, exit: '' }).exit, 'error.date');
});
test('UI metadata length limits do not infer legal scope', () => {
  assert.equal(validateTrip({ ...input, label: 'x'.repeat(81) }).label, 'error.label');
  assert.equal(validateTrip({ ...input, note: 'x'.repeat(501) }).note, 'error.note');
  assert.deepEqual(validateTrip({ ...input, note: 'Residence permit, visa D <script>text</script>' }), {});
});
test('scenario modes keep dates and requests independent of actual history', () => {
  const store = setup();
  store.saveTrip(input);
  const before = store.trips;
  const base = { ...input, entry: '2027-01-01', exit: '2027-01-10', horizon: '365', length: '91' };
  for (const mode of ['fixed', 'maximum', 'earliest']) assert.deepEqual(store.saveScenario({ ...base, mode }).issues, {});
  assert.deepEqual(store.trips, before);
  assert.equal(store.scenarios[1].exit, null);
  assert.equal(store.scenarios[2].exit, null);
  assert.equal(store.scenarios[2].length, 91); // No JS eligibility judgement.
  assert.equal(store.scenarios[0].status, undefined);
  const saved = store.scenarios[0];
  store.saveScenario({ ...base, mode: 'fixed', label: 'Changed' }, saved.id);
  assert.equal(store.scenarios.length, 3);
  store.removeScenario(saved.id);
  assert.equal(store.scenarios.length, 2);
});
test('planner validates only input shape, positive bounds, chronology', () => {
  const base = { ...input, mode: 'earliest', entry: '2027-01-01', length: '15', horizon: '365' };
  for (const bad of [0, -1, true, '1.2', '1e2', 10001, '']) assert.equal(validateScenario({ ...base, length: bad }, '2026-10-23').length, 'error.integer');
  assert.equal(validateScenario({ ...base, entry: '2026-10-23' }, '2026-10-23').entry, 'error.futurePlan');
  assert.equal(validateScenario({ ...base, mode: 'other' }).mode, 'error.mode');
});
test('unknown edit IDs cannot insert additional records', () => {
  const store = setup();
  assert.equal(store.saveTrip(input, 'missing').issues.form, 'error.missing');
  assert.equal(store.trips.length, 0);
});
test('scenario collection cap is enforced and editing at the cap works', () => {
  const store = setup();
  const scenario = { ...input, mode: 'fixed', entry: '2027-01-01', exit: '2027-01-02' };
  for (let i = 0; i < 100; i++) store.saveScenario(scenario);
  assert.equal(store.saveScenario(scenario).issues.form, 'error.scenarioLimit');
  assert.deepEqual(store.saveScenario(scenario, store.scenarios[0].id).issues, {});
});
test('trip collection cap is enforced', () => {
  const store = setup();
  for (let i = 0; i < 500; i++) {
    const d = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
    assert.deepEqual(store.saveTrip({ ...input, entry: d, exit: d }).issues, {});
  }
  assert.equal(store.saveTrip(input).issues.form, 'error.tripLimit');
});
test('calendar presentation handles leap years, month and year bounds', () => {
  assert.equal(monthDays('2024-02').filter(Boolean).length, 29);
  assert.equal(monthDays('1900-02').filter(Boolean).length, 28);
  assert.equal(monthDays('2000-02').filter(Boolean).length, 29);
  assert.equal(moveMonth('2024-12', 1), '2025-01');
  assert.equal(moveMonth('0001-01', -1), null);
  assert.equal(moveMonth('9999-12', 1), null);
  assert.equal(monthDays('9999-12').filter(Boolean).length, 31);
  assert.equal(parseDate('0001-06-29').getUTCFullYear(), 1);
});
test('calendar marks inclusive input intervals only, not compliance', () => {
  assert.equal(recordsOnDate([input], input.entry).length, 1);
  assert.equal(recordsOnDate([input], input.exit).length, 1);
  assert.equal(recordsOnDate([input], '2024-03-02').length, 0);
});
test('date formatting preserves calendar date across time zones', () => {
  for (const zone of ['Pacific/Honolulu', 'Europe/Minsk', 'Pacific/Auckland']) {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    assert.match(formatDate('2024-02-29', 'en'), /29 Feb 2024/);
    assert.match(formatDate('2024-02-29', 'ru'), /29 февр/);
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
  assert.equal(todayISO(new Date(2024, 0, 2, 1)), '2024-01-02');
});
test('English and Russian dictionaries have matching keys and placeholders', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.ru).sort());
  for (const key of Object.keys(messages.en)) {
    assert.ok(messages.ru[key]);
    assert.deepEqual(messages.en[key].match(/\{\w+\}/g), messages.ru[key].match(/\{\w+\}/g));
  }
  assert.equal(translator('en')('planner.days', { count: 12 }), '12 days');
  assert.throws(() => translator('en')('missing'));
});
test('browser code has no storage, network, evaluation or duplicate engine calls', () => {
  for (const file of readdirSync('web/scripts').filter(name => name.endsWith('.js'))) {
    const source = readFileSync(`web/scripts/${file}`, 'utf8');
    assert.doesNotMatch(source, /\b(localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|serviceWorker)\b|\b(fetch|eval)\s*\(|\.innerHTML\s*=/, file);
    assert.doesNotMatch(source, /\b(rolling_window|count_occupied_days|remaining_arithmetic_days|WITHIN_RULE|VIOLATION)\b/, file);
  }
});
test('module syntax and local import targets are valid', async () => {
  for (const file of readdirSync('web/scripts').filter(name => name.endsWith('.js'))) {
    const path = resolve('web/scripts', file);
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const match of readFileSync(path, 'utf8').matchAll(/from ['"](\.[^'"]+)['"]/g)) assert.ok(existsSync(resolve(dirname(path), match[1])));
  }
  await import('../../web/scripts/views.js');
});
test('entry document has local assets, CSP and a no-script explanation', () => {
  const html = readFileSync('web/index.html', 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<script type="module"/);
  for (const [, path] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) assert.ok(existsSync(resolve('web', path)));
  assert.doesNotMatch(html, /(?:src|href)="https?:/);
});
