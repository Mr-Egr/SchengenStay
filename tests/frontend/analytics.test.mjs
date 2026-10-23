import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { startAnalytics } from '../../web/scripts/analytics.js';
import { analyticsConfig } from '../../web/scripts/analytics-config.js';
import { messages } from '../../web/scripts/i18n.js';

// Synthetic shape-only fixture, never registered, deployed or sent over a network.
const config = { enabled: true, reviewed: true, siteToken: randomBytes(16).toString('hex') };
function environment() {
  const scripts = [];
  const env = {
    location: { href: 'https://mr-egr.github.io/SchengenStay/#history' }, navigator: {},
    document: {
      referrer: '', getElementById: id => scripts.find(item => item.id === id),
      createElement: tag => ({ tag, attributes: {}, listeners: {},
        setAttribute(key, value) { this.attributes[key] = value; },
        addEventListener(key, callback) { this.listeners[key] = callback; },
        remove() { scripts.splice(scripts.indexOf(this), 1); },
      }),
      head: { append: script => scripts.push(script) },
      get forms() { throw new Error('Must never read application inputs'); },
    },
  };
  return { env, scripts };
}

test('shipped analytics is off with no invented token, no document or network access', () => {
  assert.deepEqual(analyticsConfig, { enabled: false, siteToken: null, reviewed: false });
  assert.equal(startAnalytics(), false);
  assert.doesNotMatch(readFileSync('web/index.html', 'utf8'), /cloudflareinsights/);
});

test('missing, malformed and unreviewed configuration fails closed', () => {
  for (const value of [null, {}, { ...config, enabled: false }, { ...config, reviewed: false },
    ...[null, '', 'replace-me', '<script>', 123, 'abc?x=private'].map(siteToken => ({ ...config, siteToken }))]) {
    const { env, scripts } = environment();
    assert.equal(startAnalytics(value, env), false);
    assert.equal(scripts.length, 0);
  }
});

test('only fixed canonical pages without private URLs or referrers are eligible', () => {
  for (const href of ['http://mr-egr.github.io/SchengenStay/', 'https://example.com/',
    'https://mr-egr.github.io/Other/', 'https://mr-egr.github.io/SchengenStay/?date=2026-09-30',
    'https://mr-egr.github.io/SchengenStay/#private-note', 'not a URL']) {
    const { env, scripts } = environment(); env.location.href = href;
    assert.equal(startAnalytics(config, env), false); assert.equal(scripts.length, 0);
  }
  for (const setting of ['referrer', 'globalPrivacyControl', 'doNotTrack']) {
    const { env } = environment();
    if (setting === 'referrer') env.document.referrer = 'https://example.com/?private';
    else env.navigator[setting] = setting === 'doNotTrack' ? '1' : true;
    assert.equal(startAnalytics(config, env), false);
  }
});

test('isolated loader uses only the official async beacon and token with SPA tracking off', () => {
  const { env, scripts } = environment();
  assert.equal(startAnalytics(config, env), true);
  const [script] = scripts;
  assert.equal(script.src, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.equal(script.type, 'module'); assert.equal(script.async, true);
  assert.equal(script.referrerPolicy, 'no-referrer');
  assert.deepEqual(JSON.parse(script.attributes['data-cf-beacon']), { token: config.siteToken, spa: false });
  assert.deepEqual(Object.keys(script.listeners), ['error']);
  assert.equal(startAnalytics(config, env), false);
  assert.equal(scripts.length, 1);
  script.listeners.error(); assert.equal(scripts.length, 0);
});

test('DOM or loading failures never throw into application initialization', () => {
  assert.equal(startAnalytics(config, {}), false);
  const { env } = environment(); env.document.head.append = () => { throw new Error('blocked'); };
  assert.equal(startAnalytics(config, env), false);
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
