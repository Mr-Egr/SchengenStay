import { h, field, button } from './dom.js';
import { formatDate, MIN_DATE, MAX_DATE, parseDate } from './dates.js';
import { messages } from './i18n.js';
import { computationState } from './components.js';

export function codeText(ctx, family, code) {
  const key = `${family}.${code}`;
  return Object.hasOwn(messages.en, key) ? ctx.t(key)
    : ctx.t(family === 'issue' ? 'result.issueFallback' : 'result.reasonFallback', { code });
}

export function checkbox(name, label, checked, change) {
  return h('label', { className: 'check-control', for: `field-${name}` },
    h('input', { type: 'checkbox', id: `field-${name}`, name, checked, onChange: event => change(event.target.checked) }), h('span', {}, label));
}

export function contextPanel(ctx) {
  const { t } = ctx;
  const checkDate = field('checkDate', t('calculator.date'), { type: 'date', min: MIN_DATE, max: MAX_DATE, value: ctx.checkDate, onChange: event => ctx.setCheckDate(event.target.value) });
  if (ctx.checkDate && (!parseDate(ctx.checkDate) || ctx.checkDate < MIN_DATE || ctx.checkDate > MAX_DATE)) {
    checkDate.querySelector('input').setAttribute('aria-invalid', 'true');
    checkDate.querySelector('.field-error').textContent = t('error.date');
  }
  return h('section', { className: 'panel context-panel' }, h('h2', {}, t('context.title')),
    h('div', { className: 'form-grid' },
      checkDate,
      field('budget', t('context.budget'), { type: 'number', min: 1, max: 10000, step: 1, value: ctx.budget, onChange: event => ctx.setContext('budget', Number(event.target.value)) })),
    checkbox('complete', t('context.complete'), ctx.complete, value => ctx.setContext('complete', value)),
    field('scope', t('context.scope'), { value: ctx.scope, options: ['UNKNOWN', 'COUNTABLE_SHORT_STAYS', 'SPECIAL_LEGAL_CONTEXT', 'VISA_VALIDITY', 'HISTORICAL_GEOGRAPHY'].map(value => [value, t(`context.${value}`)]), onChange: event => ctx.setContext('scope', event.target.value) }),
    ctx.store.trips.some(item => item.kind === 'ongoing') ? checkbox('ongoing', t('context.ongoing'), ctx.ongoing, value => ctx.setContext('ongoing', value)) : null,
    h('p', { className: 'hint' }, t('context.note')),
    h('div', { className: 'row-actions' }, button(t('calculator.button'), ctx.runHistory, { kind: 'primary', 'data-focus': 'run-history' }),
      ctx.busy ? button(t('run.cancel'), ctx.cancelCalculation) : null));
}

export function runtimePanel(ctx) {
  return h('div', { className: `runtime-panel ${ctx.runtime}`, role: 'status', 'data-runtime': ctx.runtime },
    h('span', {}, ctx.t(`runtime.${ctx.runtime}`)),
    ctx.runtime === 'error' ? button(ctx.t('run.retry'), ctx.retryRuntime, { 'data-focus': 'retry-runtime' }) : null,
    ctx.runtimeError ? h('p', {}, codeText(ctx, 'runtimeError', ctx.runtimeError)) : null);
}

function status(ctx, value, title = 'result.status') {
  return h('div', { className: 'result-status', 'data-status': value }, h('span', {}, ctx.t(title)),
    h('strong', {}, Object.hasOwn(messages.en, `status.${value}`) ? ctx.t(`status.${value}`) : ctx.t('result.unknown')));
}

function details(ctx, result, names) {
  const dates = new Set(['check_date', 'first_violation_date', 'inspected_through', 'search_horizon_end', 'latest_compliant_exit', 'entry', 'exit']);
  return h('dl', { className: 'result-details' }, names.filter(name => result[name] !== null && result[name] !== undefined).map(name => [
    h('dt', {}, ctx.t(`result.${name}`)), h('dd', { 'data-value': name }, dates.has(name) ? formatDate(result[name], ctx.language) : String(result[name])),
  ]));
}

function snapshot(ctx, value, title) {
  if (!value) return null;
  return h('section', { className: 'snapshot', 'data-evidence': title }, h('h4', {}, ctx.t(title)),
    details(ctx, value, ['check_date', 'used_days', 'remaining_arithmetic_days']),
    h('p', {}, ctx.t('result.window'), ': ', formatDate(value.window_start, ctx.language), ' — ', formatDate(value.window_end, ctx.language)),
    value.assumed_ongoing_ids?.length ? h('p', {}, ctx.t('result.assumed')) : null);
}

export function resultCard(ctx, result, title = 'result.status') {
  if (!result || typeof result.status !== 'string') return h('p', {}, ctx.t('result.unknown'));
  const search = Object.hasOwn(result, 'planning_status');
  return h('article', { className: `python-result status-${result.status}`, 'data-result-status': result.status },
    status(ctx, result.status, title), search ? status(ctx, result.planning_status, 'result.planning') : null,
    h('ul', { className: 'result-reasons' }, [...(result.reason_codes ?? []), ...(result.warnings ?? [])].map(code => h('li', { 'data-reason': code }, codeText(ctx, 'reason', code)))),
    result.issues?.length ? h('ul', { className: 'result-issues' }, result.issues.map(issue => h('li', {}, codeText(ctx, 'issue', issue.code), ' ', h('code', {}, issue.field)))) : null,
    snapshot(ctx, result.snapshot, 'result.snapshot'), snapshot(ctx, result.first_violation, 'result.violation'),
    details(ctx, result, ['first_violation_date', 'inspected_dates', 'inspected_through', 'search_horizon_end', 'consecutive_days', 'latest_compliant_exit', 'entry', 'exit', 'candidates_checked', 'inspected_plan_days']),
    Object.hasOwn(result, 'maximum_proven') && result.consecutive_days !== null ? h('p', { className: 'result-proof' }, ctx.t(result.maximum_proven ? 'result.proven' : 'result.partial')) : null,
    result.arithmetic_impossible ? h('p', {}, ctx.t('result.impossible')) : null,
    result.history_result ? h('details', { className: 'nested-result', open: result.history_result.status !== 'WITHIN_RULE' }, h('summary', {}, ctx.t('result.history')), resultCard(ctx, result.history_result, 'result.history')) : null,
    result.itinerary_result ? resultCard(ctx, result.itinerary_result, 'result.itinerary') : null,
    result.evaluation ? h('details', { className: 'nested-result' }, h('summary', {}, ctx.t(Object.hasOwn(result, 'maximum_proven') ? 'result.probe' : 'result.candidate')), resultCard(ctx, result.evaluation)) : null,
    result.scenarios?.map(item => h('section', {}, h('h3', {}, `${ctx.t('planner.fixed')} ${item.index + 1}: ${formatDate(item.plan?.entry, ctx.language)} — ${formatDate(item.plan?.exit, ctx.language)}`), resultCard(ctx, item.result))),
  );
}

export function resultSlot(ctx, key) {
  const item = ctx.results.get(key);
  if (!item) return computationState(ctx.t, 'empty');
  if (item.state === 'ready') return resultCard(ctx, item.result);
  return h('div', {}, computationState(ctx.t, item.state), item.code ? h('p', { role: 'alert' }, codeText(ctx, 'runtimeError', item.code)) : null);
}
