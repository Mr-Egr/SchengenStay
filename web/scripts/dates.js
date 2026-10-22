// Calendar presentation only. No rolling windows, usage counts, or compliance rules.
export const MIN_DATE = '0001-06-29';
export const MAX_DATE = '9999-12-31';

export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(12, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function isoDate(date) {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function todayISO(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDate(value, language, options = {}) {
  const parsed = parseDate(value);
  return parsed ? new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...options,
  }).format(parsed) : '—';
}

export function moveMonth(month, offset) {
  const date = parseDate(`${month}-01`);
  if (!date) return null;
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999 ? null : isoDate(date).slice(0, 7);
}

export function monthDays(month) {
  const first = parseDate(`${month}-01`);
  if (!first) return [];
  const result = Array((first.getUTCDay() + 6) % 7).fill(null);
  const current = new Date(first);
  while (current.getUTCMonth() === first.getUTCMonth() && current.getUTCFullYear() === first.getUTCFullYear()) {
    result.push(isoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  while (result.length % 7) result.push(null);
  return result;
}

export function recordsOnDate(records, value, ongoingThrough = null) {
  return records.filter(item => item.entry <= value && (item.kind === 'ongoing' ? ongoingThrough && value <= ongoingThrough : item.exit >= value));
}
