import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startAnalytics } from '../../web/scripts/analytics.js';
import { analyticsConfig } from '../../web/scripts/analytics-config.js';
import { messages } from '../../web/scripts/i18n.js';
import { createAnalyticsPreference, decodeAnalyticsPreference, ANALYTICS_KEY,
  ANALYTICS_MAX_AGE, createPersistence, STORAGE_KEY } from '../../web/scripts/storage.js';

function setup() {
  const values = new Map();
  let time = 1000000000000;
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const create = () => createAnalyticsPreference(() => storage, () => time);
  return { values, storage, create, advance: ms => { time += ms; }, now: () => time };
}

test('privacy gate cannot be bypassed by a token, opt-in or configuration flags', () => {
  assert.equal(analyticsConfig.enabled, false);
  assert.equal(analyticsConfig.reviewed, false);
  assert.equal(analyticsConfig.siteToken, '12c97c38d76a4f0c97f7893c2c0cf0c4');
  const env = new Proxy({}, { get() { throw new Error('Must not touch browser or network'); } });
  for (const config of [null, {}, analyticsConfig, { ...analyticsConfig, enabled: true, reviewed: true, consent: true }]) {
    assert.equal(startAnalytics(config, env), false);
  }
  assert.doesNotMatch(readFileSync('web/index.html', 'utf8'), /cloudflareinsights/);
  assert.doesNotMatch(readFileSync('web/scripts/analytics.js', 'utf8'), /createElement|append|fetch|sendBeacon/);
});

test('analytics starts off, writes nothing until a choice, and persists only a versioned preference', () => {
  const s = setup(), p = s.create(); p.load();
  assert.equal(p.allowed, false); assert.equal(s.values.size, 0);
  p.set(true);
  const data = JSON.parse(s.values.get(ANALYTICS_KEY));
  assert.deepEqual(data, { schema_version: 1, notice_version: 1, allowed: true, expires_at: s.now() + ANALYTICS_MAX_AGE });
  const next = s.create(); next.load(); assert.equal(next.allowed, true);
  assert.equal(startAnalytics(), false);
});

test('history saving and analytics choice never grant, erase or modify each other', () => {
  const s = setup(), p = s.create(), history = createPersistence(() => s.storage);
  p.set(true); const preference = s.values.get(ANALYTICS_KEY);
  history.enable(); history.save([], 'en', 'light');
  assert.equal(s.values.get(ANALYTICS_KEY), preference);
  const historyText = s.values.get(STORAGE_KEY);
  p.set(false); assert.equal(s.values.get(STORAGE_KEY), historyText);
  p.set(true); history.disable();
  assert.equal(s.values.get(ANALYTICS_KEY), preference);
  assert.equal(s.values.has(STORAGE_KEY), false);
});

test('malformed, unknown, duplicate, old-notice and expired records fail closed', () => {
  const s = setup(); const p = s.create(); p.set(true);
  const text = s.values.get(ANALYTICS_KEY), data = JSON.parse(text);
  for (const bad of ['{broken', 'null', '[]', 'x'.repeat(201), text.replace('"allowed":true', '"allowed":false,"allowed":true'),
    ...[{ schema_version: 2 }, { notice_version: 2 }, { allowed: 'true' }, { trips: [] },
      { expires_at: s.now() }, { expires_at: s.now() + ANALYTICS_MAX_AGE + 1 },
      { expires_at: null }].map(change => JSON.stringify({ ...data, ...change }))]) {
    assert.throws(() => decodeAnalyticsPreference(bad, s.now()));
    s.values.set(ANALYTICS_KEY, bad); p.load(); assert.equal(p.allowed, false); assert.equal(p.error, 'analytics.invalid');
  }
  s.values.set(ANALYTICS_KEY, text); p.load(); s.advance(ANALYTICS_MAX_AGE); p.sync();
  assert.equal(p.allowed, false);
});

test('withdrawal propagates across tabs; another tab cannot silently grant consent', () => {
  const s = setup(), a = s.create(), b = s.create(); a.load(); b.load();
  a.set(true); b.sync(); assert.equal(b.allowed, false);
  b.load(); assert.equal(b.allowed, true);
  a.set(false); b.sync(); assert.equal(b.allowed, false);
  a.set(true); s.values.delete(ANALYTICS_KEY); a.sync(); assert.equal(a.allowed, false);
});

test('storage errors are visible and withdrawal falls back to deleting only its own key', () => {
  const s = setup(), p = s.create(); p.set(true);
  s.values.set(STORAGE_KEY, 'untouched');
  s.storage.setItem = () => { throw new Error('denied'); };
  p.set(false); assert.equal(p.allowed, false); assert.equal(p.error, null);
  assert.equal(s.values.has(ANALYTICS_KEY), false); assert.equal(s.values.get(STORAGE_KEY), 'untouched');
  p.set(true); assert.equal(p.error, 'analytics.saveError');
  s.storage.removeItem = () => { throw new Error('denied'); };
  p.set(false); assert.equal(p.allowed, false); assert.equal(p.error, 'analytics.withdrawError');
  const denied = createAnalyticsPreference(() => { throw new Error('denied'); });
  denied.load(); assert.equal(denied.allowed, false); assert.equal(denied.error, 'analytics.invalid');
});

test('all EN/RU interface vocabulary uses user-oriented calculation labels', () => {
  assert.equal(messages.en['app.preview'], '90/180 Calculator');
  assert.equal(messages.ru['app.preview'], 'Расчёт 90/180');
  assert.match(messages.en['settings.laterBody'], /Calculations run on your device/);
  assert.match(messages.ru['settings.laterBody'], /Расчёты выполняются на вашем устройстве/);
  assert.match(messages.en['settings.privacyBody'], /Website analytics is off/);
  assert.match(messages.ru['settings.privacyBody'], /Аналитика сайта отключена/);
  for (const language of ['en', 'ru']) for (const [key, value] of Object.entries(messages[language])) {
    assert.doesNotMatch(value, /Python|Pyodide|WebAssembly|Web Worker/i, `${language}/${key}`);
  }
});
