import { h, icon, button, field, showErrors } from './dom.js';
import { MIN_DATE, MAX_DATE, formatDate, monthDays, moveMonth, recordsOnDate } from './dates.js';

// Presentation states are separate from Python's six domain statuses. No success fixture.
export function computationState(t, state = 'unavailable') {
  if (!['unavailable', 'empty', 'loading', 'error'].includes(state)) throw new Error('Unknown presentation state');
  return h('div', { className: `computation-state ${state}`, 'data-computation-state': state, role: state === 'error' ? 'alert' : 'status', 'aria-busy': String(state === 'loading') },
    h('span', { className: 'state-symbol' }, icon(state === 'loading' ? 'globe' : state === 'error' ? 'guide' : 'lock')),
    h('div', {}, h('h3', {}, t(`state.${state}.title`)), h('p', {}, t(`state.${state}.body`))));
}

export function emptyState(title, body, action, symbol = 'history') {
  return h('div', { className: 'empty-state' }, h('span', { className: 'empty-symbol' }, icon(symbol)), h('h3', {}, title), h('p', {}, body), action);
}

export function metrics(ctx) {
  const { t, store } = ctx;
  return h('div', { className: 'metrics' },
    ...[['used', 'calendar'], ['remaining', 'globe'], ['trips', 'history']].map(([key, symbol]) =>
      h('article', { className: `metric ${key}` },
        h('div', { className: 'metric-heading' }, h('h2', {}, t(`metric.${key}`)), icon(symbol)),
        h('div', { className: 'metric-value', 'aria-label': key === 'trips' ? String(store.trips.length) : t('metric.pending') }, key === 'trips' ? String(store.trips.length).padStart(2, '0') : '—'),
        h('p', {}, key === 'trips' ? t('metric.tripsDetail') : t('metric.pendingDetail')))));
}

export function tripList(ctx, trips, compact = false) {
  const { t, language } = ctx;
  return h('ul', { className: 'trip-list' }, trips.map(trip => h('li', { className: 'trip-row' },
    h('span', { className: 'trip-symbol' }, icon('planner')),
    h('div', { className: 'trip-copy' }, h('h3', {}, trip.label || t('trip.untitled')),
      h('p', {}, formatDate(trip.entry, language), ' — ', formatDate(trip.exit, language)),
      !compact && trip.note ? h('p', { className: 'trip-note' }, trip.note) : null),
    compact ? h('span', { className: 'badge subtle' }, t('calendar.recorded')) :
      h('div', { className: 'row-actions' },
        button(t('action.edit'), () => ctx.openTrip(trip), { kind: 'quiet', symbol: 'edit', 'aria-label': `${t('action.edit')}: ${trip.label || t('trip.untitled')}`, 'data-focus': trip.id }),
        button(t('action.remove'), () => ctx.remove('trip', trip), { kind: 'quiet danger', symbol: 'remove', 'aria-label': `${t('action.remove')}: ${trip.label || t('trip.untitled')}` })))));
}

export function calendar(ctx, compact = false) {
  const { t, language, month, selectedDay, store } = ctx;
  const fixed = store.scenarios.filter(item => item.mode === 'fixed');
  const weekdays = Array.from({ length: 7 }, (_, i) => formatDate(`2024-01-0${i + 1}`, language, { weekday: 'short', day: undefined, month: undefined, year: undefined }));
  const monthTitle = formatDate(`${month}-01`, language, { day: undefined, month: 'long', year: 'numeric' });
  const grid = h('div', { className: `calendar-grid ${compact ? 'compact' : ''}`, role: 'group', 'aria-label': monthTitle },
    weekdays.map(name => h('span', { className: 'weekday', 'aria-hidden': 'true' }, name)),
    monthDays(month).map(value => {
      if (!value) return h('span', { className: 'calendar-blank', 'aria-hidden': 'true' });
      const past = recordsOnDate(store.trips, value), plans = recordsOnDate(fixed, value);
      const kind = past.length && plans.length ? 'both' : past.length ? 'recorded' : plans.length ? 'tentative' : 'clear';
      return h('button', {
        type: 'button', className: `calendar-day ${kind} ${value === ctx.today ? 'today' : ''}`,
        'aria-label': `${formatDate(value, language, { weekday: 'long', month: 'long' })}. ${t(`calendar.${kind}`)}${[...past, ...plans].map(item => `: ${item.label || t('trip.untitled')}`).join('')}`,
        'aria-pressed': String(value === selectedDay), 'aria-current': value === ctx.today ? 'date' : null,
        'data-date': value, tabindex: value === selectedDay || (selectedDay.slice(0, 7) !== month && value.endsWith('-01')) ? '0' : '-1',
        onClick: () => ctx.selectDay(value),
      }, h('span', {}, String(Number(value.slice(-2)))), kind !== 'clear' ? h('span', { className: 'day-marker', 'aria-hidden': 'true' }, kind === 'recorded' ? '•' : kind === 'both' ? '•◇' : '◇') : null);
    }));
  grid.addEventListener('keydown', event => {
    if (!event.target.matches('[data-date]')) return;
    const days = [...grid.querySelectorAll('[data-date]')], index = days.indexOf(event.target);
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    let next = offset === undefined ? null : index + offset;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = days.length - 1;
    if (next === null) return;
    event.preventDefault();
    if (days[next]) {
      days.forEach(day => { day.tabIndex = -1; });
      days[next].tabIndex = 0;
      days[next].focus();
    }
  });
  return h('div', { className: 'calendar-widget' },
    h('div', { className: 'calendar-toolbar' }, h('h3', { 'aria-live': 'polite' }, monthTitle),
      h('div', { className: 'row-actions' },
        button('', () => ctx.showMonth(moveMonth(month, -1)), { kind: 'icon-button', symbol: 'left', 'aria-label': t('calendar.previous'), disabled: !moveMonth(month, -1), 'data-focus': 'previous-month' }),
        button('', () => ctx.showMonth(moveMonth(month, 1)), { kind: 'icon-button', symbol: 'right', 'aria-label': t('calendar.next'), disabled: !moveMonth(month, 1), 'data-focus': 'next-month' }))),
    grid,
    h('div', { className: 'legend' }, h('span', {}, h('i', { className: 'legend-dot recorded', 'aria-hidden': 'true' }), t('calendar.recorded')), h('span', {}, h('i', { className: 'legend-dot tentative', 'aria-hidden': 'true' }), t('calendar.tentative'))));
}

export function openEditor(ctx, kind, record = null) {
  const { t } = ctx;
  const scenario = kind === 'scenario';
  const dialog = h('dialog', { className: 'editor-dialog', 'aria-labelledby': 'dialog-title', 'aria-describedby': 'dialog-note' });
  const form = h('form', { noValidate: true, autocomplete: 'off' });
  const title = scenario ? t(record ? 'planner.edit' : 'planner.new') : t(record ? 'history.edit' : 'history.add');
  const titleNode = h('h2', { id: 'dialog-title' }, title);
  let mode = record?.mode ?? 'fixed';
  const modeFields = h('div', { className: 'form-grid' });
  const draft = { entry: record?.entry ?? '', exit: record?.exit ?? '', length: record?.length ?? '', horizon: record?.horizon ?? '365' };
  function updateMode() {
    for (const name of ['entry', 'exit', 'length', 'horizon']) {
      if (form.elements.namedItem(name)) draft[name] = form.elements.namedItem(name).value;
    }
    modeFields.replaceChildren(
      field('entry', t(scenario ? mode === 'earliest' ? 'planner.searchStart' : 'planner.entry' : 'trip.entry'), { type: 'date', value: draft.entry, min: MIN_DATE, max: MAX_DATE, required: true, hint: t('trip.datesHint') }),
      mode === 'fixed' ? field('exit', t('trip.exit'), { type: 'date', value: draft.exit, min: MIN_DATE, max: scenario ? MAX_DATE : ctx.today, required: true }) :
        field('horizon', t('planner.horizon'), { type: 'number', value: draft.horizon, min: 1, max: 10000, step: 1, required: true }),
    );
    if (mode === 'earliest') modeFields.append(field('length', t('planner.length'), { type: 'number', value: draft.length, min: 1, max: 10000, step: 1, required: true }));
  }
  const selector = scenario ? field('mode', t('planner.mode'), { value: mode, options: ['fixed', 'maximum', 'earliest'].map(value => [value, t(`planner.${value}`)]), onChange: event => { mode = event.target.value; updateMode(); showErrors(form, {}, t); } }) : null;
  form.append(h('div', { className: 'form-error', role: 'alert', tabindex: '-1' }),
    field('label', t('trip.label'), { value: record?.label ?? '', maxlength: 80, placeholder: t('trip.labelHint') }));
  if (selector) form.append(selector);
  form.append(modeFields);
  updateMode();
  form.append(field('note', t('trip.note'), { type: 'textarea', rows: 3, maxlength: 500, value: record?.note ?? '', hint: t('trip.noteHint') }));
  if (scenario) form.append(h('p', { className: 'hint' }, t('planner.bounds')));
  form.append(h('div', { className: 'dialog-actions' }, button(t('action.cancel'), () => dialog.close()),
    h('button', { type: 'submit', className: 'button primary' }, t(scenario ? record ? 'planner.update' : 'planner.save' : record ? 'action.update' : 'action.save'))));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const outcome = scenario ? ctx.store.saveScenario(data, record?.id) : ctx.store.saveTrip(data, record?.id);
    if (Object.keys(outcome.issues).length) { showErrors(form, outcome.issues, t); return; }
    ctx.changed(t(scenario ? 'feedback.scenario' : record ? 'feedback.updated' : 'feedback.saved'));
    dialog.close();
  });
  dialog.append(h('div', { className: 'dialog-heading' }, titleNode, button('', () => dialog.close(), { kind: 'icon-button', symbol: 'close', 'aria-label': t('action.close') })),
    h('p', { id: 'dialog-note', className: 'muted' }, t('app.notice')), form);
  mountDialog(dialog);
  form.elements.namedItem('label').focus();
}

export function confirmRemoval(ctx, kind, record) {
  const { t } = ctx;
  const dialog = h('dialog', { className: 'confirm-dialog', 'aria-labelledby': 'dialog-title', 'aria-describedby': 'dialog-note' },
    h('h2', { id: 'dialog-title' }, t('delete.title')), h('p', {}, record.label || t(kind === 'trip' ? 'trip.untitled' : 'planner.untitled')),
    h('p', { id: 'dialog-note', className: 'muted' }, t('delete.body')));
  const cancel = button(t('action.cancel'), () => dialog.close());
  dialog.append(h('div', { className: 'dialog-actions' }, cancel, button(t('delete.confirm'), () => {
    if (kind === 'trip') ctx.store.removeTrip(record.id); else ctx.store.removeScenario(record.id);
    ctx.changed(t('feedback.removed'));
    dialog.close();
  }, { kind: 'destructive' })));
  mountDialog(dialog);
  cancel.focus();
}

function mountDialog(dialog) {
  const previous = document.activeElement;
  document.getElementById('dialogs').append(dialog);
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    const replacement = previous?.dataset.focus ? document.querySelector(`[data-focus="${CSS.escape(previous.dataset.focus)}"]`) : null;
    (previous?.isConnected ? previous : replacement ?? document.querySelector('h1')).focus();
  }, { once: true });
  dialog.showModal();
}
