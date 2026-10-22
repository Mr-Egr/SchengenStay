import { MIN_DATE, MAX_DATE, parseDate, todayISO } from './dates.js';

export const LIMITS = Object.freeze({ trips: 500, scenarios: 100, label: 80, note: 500, horizon: 10000 });

export function validateDates(input) {
  const issues = {};
  for (const field of ['entry', 'exit']) {
    if (!parseDate(input[field]) || input[field] < MIN_DATE || input[field] > MAX_DATE) issues[field] = 'error.date';
  }
  if (!Object.keys(issues).length && input.exit < input.entry) issues.exit = 'error.order';
  return issues;
}

function metadataIssues(input) {
  const issues = {};
  for (const field of ['label', 'note']) {
    if (typeof input[field] !== 'string' || input[field].length > LIMITS[field]) issues[field] = `error.${field}`;
  }
  return issues;
}

export function validateTrip(input, history = [], id = null, today = todayISO()) {
  const issues = { ...validateDates(input), ...metadataIssues(input) };
  if (!issues.exit && input.exit > today) issues.exit = 'error.futureHistory';
  if (!issues.entry && !issues.exit && history.some(item => item.id !== id && input.entry <= item.exit && input.exit >= item.entry)) issues.entry = 'error.overlap';
  return issues;
}

export function validateScenario(input, today = todayISO()) {
  const issues = metadataIssues(input);
  if (!['fixed', 'maximum', 'earliest'].includes(input.mode)) issues.mode = 'error.mode';
  if (!parseDate(input.entry) || input.entry < MIN_DATE || input.entry > MAX_DATE) issues.entry = 'error.date';
  else if (input.entry <= today) issues.entry = 'error.futurePlan';
  if (input.mode === 'fixed') Object.assign(issues, validateDates(input));
  for (const key of input.mode === 'earliest' ? ['length', 'horizon'] : input.mode === 'maximum' ? ['horizon'] : []) {
    if (!/^\d+$/.test(String(input[key])) || !Number.isSafeInteger(Number(input[key])) || Number(input[key]) < 1 || Number(input[key]) > LIMITS.horizon) issues[key] = 'error.integer';
  }
  return issues;
}

export function createStore({ today = todayISO(), makeId = () => crypto.randomUUID() } = {}) {
  let trips = [];
  let scenarios = [];
  return Object.freeze({
    get trips() { return Object.freeze([...trips]); },
    get scenarios() { return Object.freeze([...scenarios]); },
    saveTrip(input, id = null) {
      const issues = validateTrip(input, trips, id, today);
      if (id !== null && !trips.some(item => item.id === id)) issues.form = 'error.missing';
      if (id === null && trips.length >= LIMITS.trips) issues.form = 'error.tripLimit';
      if (Object.keys(issues).length) return { issues };
      const trip = Object.freeze({ id: id ?? makeId(), entry: input.entry, exit: input.exit, label: input.label.trim(), note: input.note.trim() });
      trips = [...trips.filter(item => item.id !== id), trip].sort((a, b) => b.entry.localeCompare(a.entry));
      return { record: trip, issues: {} };
    },
    removeTrip(id) { trips = trips.filter(item => item.id !== id); },
    saveScenario(input, id = null) {
      const issues = validateScenario(input, today);
      if (id !== null && !scenarios.some(item => item.id === id)) issues.form = 'error.missing';
      if (id === null && scenarios.length >= LIMITS.scenarios) issues.form = 'error.scenarioLimit';
      if (Object.keys(issues).length) return { issues };
      const record = Object.freeze({
        id: id ?? makeId(), mode: input.mode, entry: input.entry,
        exit: input.mode === 'fixed' ? input.exit : null,
        length: input.mode === 'earliest' ? Number(input.length) : null,
        horizon: input.mode !== 'fixed' ? Number(input.horizon) : null,
        label: input.label.trim(), note: input.note.trim(),
      });
      scenarios = [...scenarios.filter(item => item.id !== id), record];
      return { record, issues: {} };
    },
    removeScenario(id) { scenarios = scenarios.filter(item => item.id !== id); },
  });
}
