import { h, icon, button, link, field } from './dom.js';
import { calendar, computationState, emptyState, metrics, tripList } from './components.js';
import { MIN_DATE, MAX_DATE, formatDate, recordsOnDate, parseDate } from './dates.js';

function heading(ctx, key, action) {
  return h('header', { className: 'page-heading' }, h('div', {}, h('h1', { tabindex: '-1' }, ctx.t(`${key}.title`)), h('p', {}, ctx.t(`${key}.subtitle`))), action);
}

function panel(title, content, action) {
  return h('section', { className: 'panel' }, h('div', { className: 'section-heading' }, h('h2', {}, title), action), content);
}

function addTrip(ctx) {
  return button(ctx.t('history.add'), () => ctx.openTrip(), { kind: 'primary', symbol: 'plus', 'data-focus': 'add-trip' });
}

function selection(ctx) {
  const { t, language, store, selectedDay } = ctx;
  const recorded = recordsOnDate(store.trips, selectedDay);
  const tentative = recordsOnDate(store.scenarios.filter(item => item.mode === 'fixed'), selectedDay);
  return h('section', { className: 'day-detail', 'aria-live': 'polite', 'aria-atomic': 'true' },
    h('p', { className: 'eyebrow' }, t('calendar.selected')), h('h3', {}, formatDate(selectedDay, language, { month: 'long' })),
    recorded.length + tentative.length ? h('ul', { className: 'date-records' },
      recorded.map(item => h('li', {}, h('span', { className: 'badge' }, t('calendar.recorded')), ' ', item.label || t('trip.untitled'))),
      tentative.map(item => h('li', {}, h('span', { className: 'badge tentative' }, t('calendar.tentative')), ' ', item.label || t('planner.untitled'))))
      : h('p', { className: 'muted' }, t('calendar.empty')));
}

export function dashboard(ctx) {
  const { t, store } = ctx;
  return [heading(ctx, 'dashboard'),
    h('section', { className: 'journey-hero' },
      h('div', { className: 'hero-copy' }, h('p', { className: 'eyebrow' }, t('hero.eyebrow')), h('h2', {}, t('hero.title')), h('p', {}, t('hero.body')),
        h('div', { className: 'hero-actions' }, button(t('hero.action'), () => ctx.openTrip(), { kind: 'primary', symbol: 'plus', 'data-focus': 'add-trip' }), link(t('hero.secondary'), '#planner'))),
      h('figure', { className: 'hero-art' }, h('img', { src: './assets/journey.svg', alt: '', width: '500', height: '360' }), h('figcaption', {}, t('hero.caption')))),
    metrics(ctx),
    h('div', { className: 'dashboard-columns' },
      panel(t('recent.title'), store.trips.length ? tripList(ctx, store.trips.slice(0, 4), true) : emptyState(t('recent.empty'), t('recent.body'), button(t('history.add'), () => ctx.openTrip(), { symbol: 'plus', 'data-focus': 'empty-add' })), link(t('recent.all'), '#history')),
      panel(t('nav.calendar'), [calendar(ctx, true), selection(ctx)], link(t('calendar.open'), '#calendar', 'icon-link'))),
    h('aside', { className: 'integration-note' }, icon('guide'), h('p', {}, h('strong', {}, t('state.unavailable.title')), ' ', t('state.unavailable.body'))),
  ];
}

export function history(ctx) {
  const { t, store } = ctx;
  return [heading(ctx, 'history', addTrip(ctx)),
    h('div', { className: 'info-note' }, icon('guide'), h('p', {}, t('history.scope'))),
    panel(t('nav.history'), store.trips.length ? tripList(ctx, store.trips) : emptyState(t('history.empty'), t('history.body'), addTrip(ctx)), h('span', { className: 'badge' }, String(store.trips.length))),
  ];
}

export function calculator(ctx) {
  const { t } = ctx;
  const dateField = field('checkDate', t('calculator.date'), { type: 'date', value: ctx.checkDate, min: MIN_DATE, max: MAX_DATE, onChange: event => ctx.setCheckDate(event.target.value), hint: t('trip.datesHint') });
  if (ctx.checkDate && (!parseDate(ctx.checkDate) || ctx.checkDate < MIN_DATE || ctx.checkDate > MAX_DATE)) {
    dateField.querySelector('input').setAttribute('aria-invalid', 'true');
    dateField.querySelector('.field-error').textContent = t('error.date');
  }
  return [heading(ctx, 'calculator'),
    h('div', { className: 'two-columns' },
      panel(t('nav.calculator'), [dateField,
        button(t('calculator.button'), null, { kind: 'primary full-width', symbol: 'lock', disabled: true, 'aria-describedby': 'calculator-availability' }),
        h('p', { id: 'calculator-availability', className: 'hint' }, t('state.unavailable.body'))]),
      panel(t('calculator.summary'), computationState(t, ctx.checkDate ? 'unavailable' : 'empty'))),
    metrics(ctx),
    panel(t('calculator.explanation'), h('p', { className: 'reading-copy' }, t('calculator.explanationBody'))),
  ];
}

export function planner(ctx) {
  const { t, language, store } = ctx;
  const newScenario = () => button(t('planner.new'), () => ctx.openScenario(), { kind: 'primary', symbol: 'plus', 'data-focus': 'new-scenario' });
  return [heading(ctx, 'planner', newScenario()), computationState(t),
    panel(t('planner.compare'), store.scenarios.length ? h('div', { className: 'scenario-grid' }, store.scenarios.map(item =>
      h('article', { className: 'scenario-card' }, h('div', { className: 'section-heading' }, h('span', { className: 'eyebrow' }, t(`planner.${item.mode}`)), icon('planner')),
        h('h3', {}, item.label || t('planner.untitled')),
        h('dl', { className: 'scenario-details' },
          h('dt', {}, t(item.mode === 'earliest' ? 'planner.searchStart' : 'planner.entry')), h('dd', {}, formatDate(item.entry, language)),
          item.exit ? [h('dt', {}, t('trip.exit')), h('dd', {}, formatDate(item.exit, language))] : null,
          item.length ? [h('dt', {}, t('planner.length')), h('dd', {}, t('planner.days', { count: item.length }))] : null,
          item.horizon ? [h('dt', {}, t('planner.horizon')), h('dd', {}, t('planner.days', { count: item.horizon }))] : null),
        item.note ? h('p', { className: 'trip-note' }, item.note) : null,
        h('div', { className: 'scenario-result' }, h('span', { className: 'badge subtle' }, t('planner.notEvaluated')), h('p', {}, t('planner.noResult'))),
        h('div', { className: 'row-actions' }, button(t('action.edit'), () => ctx.openScenario(item), { kind: 'quiet', symbol: 'edit', 'data-focus': item.id, 'aria-label': `${t('action.edit')}: ${item.label || t('planner.untitled')}` }),
          button(t('action.remove'), () => ctx.remove('scenario', item), { kind: 'quiet danger', symbol: 'remove', 'aria-label': `${t('action.remove')}: ${item.label || t('planner.untitled')}` })))))
      : emptyState(t('planner.empty'), t('planner.body'), newScenario(), 'planner')),
  ];
}

export function calendarPage(ctx) {
  const { t } = ctx;
  return [heading(ctx, 'calendar', button(t('calendar.today'), () => ctx.showMonth(ctx.today.slice(0, 7)), { symbol: 'calendar', 'data-focus': 'this-month' })),
    h('div', { className: 'calendar-layout' }, panel(t('nav.calendar'), calendar(ctx)), h('aside', { className: 'panel' }, selection(ctx), h('p', { className: 'muted calendar-note' }, t('calendar.note')))),
  ];
}

export function settings(ctx) {
  const { t } = ctx;
  return [heading(ctx, 'settings'),
    h('div', { className: 'settings-panels' },
      panel(t('settings.language'), [h('p', { className: 'muted' }, t('settings.languageBody')),
        field('language', t('settings.language'), { value: ctx.language, options: [['en', 'English'], ['ru', 'Русский']], onChange: event => ctx.setLanguage(event.target.value), 'data-focus': 'language' })]),
      panel(t('settings.appearance'), [h('p', { className: 'muted' }, t('settings.appearanceBody')),
        h('div', { className: 'theme-options', role: 'group', 'aria-label': t('settings.appearance') }, ['light', 'dark'].map(theme => button(t(`settings.${theme}`), () => ctx.setTheme(theme), { symbol: theme === 'light' ? 'sun' : 'moon', 'aria-pressed': String(ctx.theme === theme), 'data-focus': `theme-${theme}` })))]),
      panel(t('settings.privacy'), h('div', { className: 'info-note plain' }, icon('shield'), h('p', {}, t('settings.privacyBody'))))),
    h('aside', { className: 'integration-note' }, icon('lock'), h('div', {}, h('h2', {}, t('settings.later')), h('p', {}, t('settings.laterBody')))),
  ];
}

export function guide(ctx) {
  const { t } = ctx;
  return [heading(ctx, 'guide'),
    h('div', { className: 'guide-grid' }, ['window', 'count', 'moves'].map((key, index) => h('article', { className: 'panel guide-card' }, h('span', { className: 'step-number' }, `0${index + 1}`), h('h2', {}, t(`guide.${key}`)), h('p', {}, t(`guide.${key}Body`))))),
    h('section', { className: 'guide-caution' }, icon('shield'), h('div', {}, h('h2', {}, t('guide.caution')), h('p', {}, t('guide.cautionBody')), h('p', {}, t('app.legal')))),
    h('p', {}, h('a', { href: 'https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en', target: '_blank', rel: 'noopener noreferrer', className: 'text-link' }, t('guide.source'), icon('arrow')), h('small', { className: 'source-note' }, t('guide.sourceNote'))),
  ];
}
