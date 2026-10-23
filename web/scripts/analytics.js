import { analyticsConfig } from './analytics-config.js';

const SCRIPT_URL = 'https://static.cloudflareinsights.com/beacon.min.js';
const SITE = 'https://mr-egr.github.io/SchengenStay/';
const HASHES = new Set(['', '#dashboard', '#history', '#calculator', '#planner', '#calendar', '#settings', '#guide']);

// No app-state dependency, form access, custom events, persistence or payload API.
// Shape validation is not proof of a registered token: verify it with Cloudflare
// before the owner enables a reviewed configuration. Current CSP also blocks it.
export function startAnalytics(config = analyticsConfig, env = globalThis) {
  try {
    if (config?.enabled !== true || config.reviewed !== true ||
        typeof config.siteToken !== 'string' || !/^[a-f0-9]{32}$/i.test(config.siteToken)) return false;
    const url = new URL(env.location.href);
    if (url.origin + url.pathname !== SITE || url.search || !HASHES.has(url.hash)) return false;
    // Do not pass potentially private incoming referrer URLs to a third party.
    if (env.document.referrer || env.navigator.globalPrivacyControl === true ||
        ['1', 'yes'].includes(env.navigator.doNotTrack)) return false;
    if (env.document.getElementById('schengenstay-analytics')) return false;
    const script = env.document.createElement('script');
    script.id = 'schengenstay-analytics';
    script.type = 'module';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = SCRIPT_URL;
    script.setAttribute('data-cf-beacon', JSON.stringify({ token: config.siteToken, spa: false }));
    script.addEventListener('error', () => script.remove(), { once: true });
    env.document.head.append(script);
    return true; // Insertion only; never asserts delivery or successful collection.
  } catch {
    return false; // Optional analytics can never prevent application startup.
  }
}
