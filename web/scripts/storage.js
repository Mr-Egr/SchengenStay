import { createStore, LIMITS } from './store.js';

export const STORAGE_KEY = 'schengenstay.workspace.v1';
export const STORAGE_LIMIT = 512000;

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
