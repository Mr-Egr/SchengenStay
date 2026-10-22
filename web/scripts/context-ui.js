import { h, field } from './dom.js';
import { dateInput } from './date-input.js';
import { messages } from './i18n.js';

export const CONTEXT_KINDS = Object.freeze(['ARITHMETIC_ONLY', 'UNKNOWN', 'SHORT_STAY_VISA', 'LONG_STAY_VISA', 'RESIDENCE_PERMIT', 'PENDING_APPLICATION', 'NATIONAL_EXTENSION', 'BILATERAL_ARRANGEMENT', 'MIXED_HISTORY', 'OTHER']);

// These choices describe the request. All scope decisions are made in Python.
export function legalContextInput(ctx) {
  const { t } = ctx;
  const visa = ctx.legalKind === 'SHORT_STAY_VISA';
  return h('section', { className: 'legal-context', 'aria-labelledby': 'legal-context-heading' },
    h('h3', { id: 'legal-context-heading' }, t('legal.title')),
    field('legalKind', t('legal.question'), { value: ctx.legalKind, options: CONTEXT_KINDS.map(kind => [kind, t(`legal.${kind}`)]), onChange: event => ctx.setContext('legalKind', event.target.value) }),
    h('p', { className: 'hint' }, t('legal.hint')),
    ctx.legalKind !== 'ARITHMETIC_ONLY' ? h('p', { className: 'legal-notice', role: 'status' }, t(`legal.note.${ctx.legalKind}`)) : null,
    visa ? h('label', { className: 'check-control', for: 'field-visaDatesEnabled' },
      h('input', { type: 'checkbox', id: 'field-visaDatesEnabled', checked: ctx.visaDatesEnabled, onChange: event => ctx.setContext('visaDatesEnabled', event.target.checked) }), h('span', {}, t('legal.datesEnabled'))) : null,
    visa && ctx.visaDatesEnabled ? h('div', {}, h('p', { className: 'hint' }, t('legal.datesHint')),
      h('div', { className: 'form-grid' }, ...['valid_from', 'valid_until'].map(name => dateInput(name, t(`legal.${name}`), {
        draft: ctx.visaDrafts[name], language: ctx.language, t, min: '0001-01-01', required: false,
        onValue: value => ctx.setVisaDate(name, value),
      })))) : null);
}

export function contextReview(ctx, review) {
  if (!review) return null;
  const text = code => Object.hasOwn(messages.en, `reason.${code}`) ? ctx.t(`reason.${code}`) : ctx.t('result.reasonFallback', { code });
  return h('aside', { className: 'context-review', 'data-context-review': review.kind ?? 'UNKNOWN' },
    h('h4', {}, ctx.t('legal.resultTitle')),
    h('ul', {}, (review.reason_codes ?? []).map(code => h('li', { 'data-reason': code }, text(code)))),
    review.visa_dates ? h('div', { 'data-visa-date-check': review.visa_dates.status ?? 'ORDER_ONLY' },
      h('strong', {}, ctx.t('legal.dateCheckTitle')),
      h('ul', {}, (review.visa_dates.reason_codes ?? []).map(code => h('li', { 'data-reason': code }, text(code))))) : null);
}
