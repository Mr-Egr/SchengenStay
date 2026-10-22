import { h, button } from './dom.js';
import { parseDate, isoDate, todayISO, formatDate, monthDays, moveMonth, MIN_DATE, MAX_DATE } from './dates.js';

// Input/picker presentation only. The Python validators remain authoritative.
export function displayDate(iso, language) {
  if (!parseDate(iso)) return '';
  const [year, month, day] = iso.split('-');
  return [day, month, year].join(language === 'ru' ? '.' : '/');
}

export function parseDateText(text, language) {
  if (typeof text !== 'string') return '';
  const value = text.trim();
  if (parseDate(value)) return value; // Complete ISO paste is supported in either locale.
  const match = value.match(language === 'ru' ? /^(\d{2})\.(\d{2})\.(\d{4})$/ : /^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  return parseDate(iso) ? iso : '';
}

export function createDateDraft(value = '', language = 'en') {
  return { text: displayDate(value, language), language, touched: false };
}

export function localizeDraft(draft, language) {
  if (draft.language !== language) {
    const iso = parseDateText(draft.text, draft.language);
    if (iso) draft.text = displayDate(iso, language);
    draft.language = language; // Keep an unfinished draft verbatim, never silently discard it.
  }
  return draft;
}

export function dateInput(name, label, { draft = createDateDraft(), language = 'en', t, min = MIN_DATE, max = MAX_DATE, required = true, onValue = () => {} } = {}) {
  localizeDraft(draft, language);
  const id = `field-${name}`;
  const wrapper = h('div', { id: `date-field-${name}`, className: 'field date-field', 'data-date-field': name, 'data-language': language });
  const error = h('small', { id: `${id}-error`, className: 'field-error', 'aria-live': 'polite' });
  const hidden = h('input', { type: 'hidden', name, value: parseDateText(draft.text, language) });
  const input = h('input', { id, type: 'text', name: `${name}Display`, value: draft.text, autocomplete: 'off', spellcheck: 'false',
    inputmode: 'text', placeholder: t('date.format'), 'aria-required': String(required),
    'aria-describedby': `${id}-hint ${id}-error`, 'data-date-text': name });
  let activeDay, month;
  const clamp = value => value < min ? min : value > max ? max : value;
  const popup = h('div', { id: `${id}-picker`, className: 'date-picker', role: 'dialog', 'aria-modal': 'false', 'aria-label': `${t('date.choose')}: ${label}`, hidden: true });
  const toggle = button('', () => popup.hidden ? open() : close(), { kind: 'date-toggle', symbol: 'calendar', 'aria-label': `${t('date.open')}: ${label}`, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': popup.id });

  function validate() {
    draft.touched = true;
    const iso = parseDateText(input.value, language);
    const key = !input.value.trim() ? required ? 'date.required' : null : !iso ? 'date.invalid' : iso < min || iso > max ? 'date.range' : null;
    error.textContent = key ? t(key, { min: displayDate(min, language), max: displayDate(max, language) }) : '';
    if (key) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    return !key;
  }
  wrapper.validateDate = validate;
  function update(text, commit = false) {
    draft.text = text;
    hidden.value = parseDateText(text, language);
    if (commit && hidden.value) { draft.text = displayDate(hidden.value, language); input.value = draft.text; }
    onValue(hidden.value);
  }
  input.addEventListener('input', () => {
    draft.touched = false;
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    update(input.value); // No rewriting, masking, cursor movement, or parent rendering.
  });
  input.addEventListener('blur', () => { if (validate()) { draft.text = displayDate(hidden.value, language); input.value = draft.text; } });
  input.addEventListener('keydown', event => {
    if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); open(); }
    if (event.key === 'Enter' && !validate()) event.preventDefault();
  });
  function close(restore = true) {
    popup.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restore) toggle.focus();
  }
  function select(value) {
    input.value = displayDate(value, language);
    update(input.value, true);
    validate();
    close(false);
    input.focus();
  }
  function open() {
    activeDay = clamp(parseDateText(input.value, language) || todayISO());
    month = activeDay.slice(0, 7);
    popup.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    draw(true);
  }
  wrapper.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !popup.hidden) {
      event.preventDefault(); event.stopPropagation(); close();
    }
  }, true);
  wrapper.addEventListener('focusout', event => {
    if (event.relatedTarget && !wrapper.contains(event.relatedTarget)) close(false);
  });

  function jumpMonth(target, focusDay = true) {
    if (!target) return;
    const days = monthDays(target).filter(Boolean);
    if (!days.length) return;
    activeDay = clamp(`${target}-${activeDay.slice(-2)}` > days.at(-1) ? days.at(-1) : `${target}-${activeDay.slice(-2)}`);
    month = activeDay.slice(0, 7);
    draw(focusDay);
  }
  function draw(focusDay) {
    const heading = formatDate(`${month}-01`, language, { day: undefined, month: 'long', year: 'numeric' });
    const previous = moveMonth(month, -1), next = moveMonth(month, 1);
    const monthSelect = h('select', { 'aria-label': t('date.month'), value: month.slice(5), onChange: event => jumpMonth(`${month.slice(0, 4)}-${event.target.value}`, false) },
      Array.from({ length: 12 }, (_, i) => { const value = String(i + 1).padStart(2, '0'); return h('option', { value }, formatDate(`2024-${value}-01`, language, { day: undefined, year: undefined, month: 'long' })); }));
    const year = h('input', { type: 'text', inputmode: 'numeric', value: month.slice(0, 4), maxlength: 4, 'aria-label': t('date.year'),
      onChange: event => {
        const value = event.target.value;
        if (/^\d{4}$/.test(value) && Number(value) >= 1 && Number(value) <= 9999) {
          event.target.removeAttribute('aria-invalid'); yearError.textContent = '';
          if (value !== month.slice(0, 4)) jumpMonth(`${value}-${month.slice(5)}`, false);
        } else { event.target.setAttribute('aria-invalid', 'true'); yearError.textContent = t('date.yearError'); }
      } });
    const yearError = h('small', { className: 'field-error', role: 'status', id: `${id}-year-error` });
    year.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); year.dispatchEvent(new Event('change')); }
    });
    year.setAttribute('aria-describedby', yearError.id);
    const weekDays = Array.from({ length: 7 }, (_, i) => formatDate(`2024-01-0${i + 1}`, language, { day: undefined, month: undefined, year: undefined, weekday: 'short' }));
    const dates = monthDays(month);
    const rows = [];
    for (let i = 0; i < dates.length; i += 7) {
      rows.push(h('tr', {}, dates.slice(i, i + 7).map(day => h('td', { role: 'gridcell', 'aria-selected': day === hidden.value ? 'true' : 'false' }, day ? h('button', {
        type: 'button', className: 'date-day', 'data-picker-date': day, tabindex: day === activeDay ? '0' : '-1', disabled: day < min || day > max,
        'aria-label': formatDate(day, language, { weekday: 'long', month: 'long' }), 'aria-current': day === todayISO() ? 'date' : null,
        onClick: () => select(day),
      }, String(Number(day.slice(-2)))) : null))));
    }
    const table = h('table', { role: 'grid', 'aria-label': heading, className: 'date-grid' },
      h('thead', {}, h('tr', {}, weekDays.map(day => h('th', { scope: 'col' }, day)))), h('tbody', {}, rows));
    table.addEventListener('keydown', event => {
      const value = event.target.dataset.pickerDate;
      if (!value) return;
      activeDay = value;
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault(); jumpMonth(moveMonth(month, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1))); return;
      }
      const date = parseDate(value), weekday = (date.getUTCDay() + 6) % 7;
      const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday }[event.key];
      if (offset === undefined) return;
      event.preventDefault(); date.setUTCDate(date.getUTCDate() + offset);
      if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return;
      activeDay = clamp(isoDate(date)); month = activeDay.slice(0, 7); draw(true);
    });
    if (popup.firstChild) {
      // Keep controls mounted: committing the year on blur must not swallow the
      // pointer click or Tab destination that caused that blur.
      popup.querySelector('.date-picker-heading strong').textContent = heading;
      const controls = popup.querySelector('.date-picker-controls');
      controls.querySelector('select').value = month.slice(5);
      const existingYear = controls.querySelector('input');
      existingYear.value = month.slice(0, 4);
      existingYear.removeAttribute('aria-invalid');
      popup.querySelector('.field-error').textContent = '';
      const [back, forward] = controls.querySelectorAll('button');
      back.disabled = !previous || previous < min.slice(0, 7);
      forward.disabled = !next || next > max.slice(0, 7);
      popup.querySelector('.date-grid').replaceWith(table);
    } else popup.append(h('div', { className: 'date-picker-heading' }, h('strong', { 'aria-live': 'polite' }, heading),
      button('', () => close(), { kind: 'date-close', symbol: 'close', 'aria-label': t('date.close') })),
    h('div', { className: 'date-picker-controls' },
      button('', () => jumpMonth(moveMonth(month, -1)), { kind: 'date-nav', symbol: 'left', 'aria-label': t('calendar.previous'), disabled: !previous || previous < min.slice(0, 7) }),
      monthSelect, year,
      button('', () => jumpMonth(moveMonth(month, 1)), { kind: 'date-nav', symbol: 'right', 'aria-label': t('calendar.next'), disabled: !next || next > max.slice(0, 7) })),
    yearError, table,
    h('p', { className: 'hint' }, t('date.keyboard')),
    h('div', { className: 'date-picker-actions' },
      button(t('date.today'), () => select(todayISO()), { disabled: todayISO() < min || todayISO() > max }),
      button(t('date.clear'), () => { input.value = ''; update(''); draft.touched = false; error.textContent = ''; input.removeAttribute('aria-invalid'); close(false); input.focus(); })));
    if (focusDay) popup.querySelector(`[data-picker-date="${activeDay}"]`)?.focus({ preventScroll: true });
  }
  wrapper.append(h('label', { for: id }, label), h('div', { className: 'date-entry' }, input, toggle), hidden,
    h('small', { id: `${id}-hint`, className: 'hint' }, t('date.hint')), error, popup);
  if (draft.touched) validate();
  return wrapper;
}

export function validateDateFields(root) {
  let first;
  for (const field of root.querySelectorAll('[data-date-field]')) {
    if (!field.validateDate() && !first) first = field.querySelector('[data-date-text]');
  }
  first?.focus();
  return !first;
}
