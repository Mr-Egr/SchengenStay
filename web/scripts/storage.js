import { createStore, LIMITS } from './store.js';

export const STORAGE_KEY = 'schengenstay.workspace.v1';
export const STORAGE_LIMIT = 512000;

// Separate preference storage, never part of the travel-history schema.
export const ANALYTICS_KEY = 'schengenstay.analytics-consent.v1';
export const ANALYTICS_NOTICE = 1; // Preparation only; activation needs fresh consent.
export const ANALYTICS_MAX_AGE = 180 * 24 * 60 * 60 * 1000;

export function decodeAnalyticsPreference(text, now = Date.now()) {
  if (typeof text !== 'string' || text.length > 200) throw new Error('ANALYTICS_PREFERENCE_INVALID');
  const data = JSON.parse(text);
  if (!data || data.schema_version !== 1 || data.notice_version !== ANALYTICS_NOTICE ||
      typeof data.allowed !== 'boolean' || !Number.isSafeInteger(data.expires_at) ||
      data.expires_at <= now || data.expires_at > now + ANALYTICS_MAX_AGE ||
      Object.keys(data).sort().join() !== 'allowed,expires_at,notice_version,schema_version' ||
      // Reject noncanonical records, including duplicate object names.
      JSON.stringify(data) !== text) throw new Error('ANALYTICS_PREFERENCE_INVALID');
  return data;
}

export function createAnalyticsPreference(getStorage = () => window.localStorage, now = Date.now) {
  let allowed = false;
  let error = null;
  function read() {
    error = null;
    try {
      const text = getStorage().getItem(ANALYTICS_KEY);
      return text === null ? false : decodeAnalyticsPreference(text, now()).allowed;
    } catch { error = 'analytics.invalid'; return false; }
  }
  return {
    get allowed() { return allowed; },
    get error() { return error; },
    load() { allowed = read(); },
    // Other tabs can revoke consent, but cannot silently opt this open tab in.
    sync() { const saved = read(); allowed = allowed && saved; },
    set(value) {
      if (typeof value !== 'boolean') return;
      allowed = value;
      error = null;
      try {
        getStorage().setItem(ANALYTICS_KEY, JSON.stringify({
          schema_version: 1, notice_version: ANALYTICS_NOTICE, allowed, expires_at: now() + ANALYTICS_MAX_AGE,
        }));
      } catch {
        error = 'analytics.saveError';
        if (!allowed) {
          try { getStorage().removeItem(ANALYTICS_KEY); error = null; }
          catch { error = 'analytics.withdrawError'; }
        }
      }
    },
  };
}

export function decodeSaved(text, today) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > STORAGE_LIMIT) throw new Error('STORAGE_INVALID');
  const data = JSON.parse(text);
  if (!data || data.schema_version !== 1 || data.consent !== true || !Array.isArray(data.trips) || data.trips.length > LIMITS.trips
      || !['en', 'ru'].includes(data.language) || !['light', 'dark'].includes(data.theme)
      || Object.keys(data).some(key => !['schema_version', 'consent', 'trips', 'language', 'theme'].includes(key))) throw new Error('STORAGE_INVALID');
  const ids = new Set();
  let nextId;
  const scratch = createStore({ today, makeId: () => nextId });
  for (const trip of data.trips) {
    if (!trip || typeof trip.id !== 'string' || !trip.id.trim() || trip.id.length > 100 || ids.has(trip.id)
      || !['completed', 'ongoing'].includes(trip.kind)
      || (trip.kind === 'ongoing' && trip.exit !== null)
      || Object.keys(trip).some(key => !['id', 'kind', 'entry', 'exit', 'label', 'note'].includes(key))) throw new Error('STORAGE_INVALID');
    ids.add(trip.id);
    nextId = trip.id;
    if (Object.keys(scratch.saveTrip(trip).issues).length) throw new Error('STORAGE_INVALID');
  }
  return { ...data, trips: scratch.trips };
}

export function createPersistence(getStorage = () => window.localStorage) {
  let consent = false;
  return {
    get enabled() { return consent; },
    load(today) {
      try {
        const text = getStorage().getItem(STORAGE_KEY);
        if (text === null) return { data: null };
        const data = decodeSaved(text, today);
        consent = true;
        return { data };
      } catch { return { data: null, error: 'STORAGE_INVALID' }; }
    },
    enable() { consent = true; },
    save(trips, language, theme) {
      if (!consent) return null;
      try {
        const text = JSON.stringify({ schema_version: 1, consent: true, trips, language, theme });
        if (new TextEncoder().encode(text).length > STORAGE_LIMIT) throw new Error('STORAGE_LIMIT');
        getStorage().setItem(STORAGE_KEY, text);
        return null;
      } catch { return 'STORAGE_FAILED'; }
    },
    disable() {
      consent = false;
      try { getStorage().removeItem(STORAGE_KEY); return null; }
      catch { return 'STORAGE_DELETE_FAILED'; }
    },
  };
}
