import { createDateDraft, validateDateFields } from './date-input.js';
import { PythonBridge, LatestResults, calculationRequest } from './pyodide-bridge.js';
import { createPersistence, createAnalyticsPreference, ANALYTICS_KEY } from './storage.js';
import { h, icon, button, announce } from './dom.js';
import { createStore } from './store.js';
import { todayISO } from './dates.js';
import { translator } from './i18n.js';
import { confirmRemoval, openEditor, metrics, computationState, calendar } from './components.js';
import * as views from './views.js';

const today = todayISO();
const persistence = createPersistence();
const restored = persistence.load(today);
const analyticsPreference = createAnalyticsPreference();
analyticsPreference.load();
const state = { language: restored.data?.language ?? 'en', theme: restored.data?.theme ?? 'light', month: today.slice(0, 7), selectedDay: today, checkDate: today, complete: false, scope: 'UNKNOWN', ongoing: false, budget: 10000, runtime: 'idle', runtimeError: null, storageError: restored.error ?? null };
state.checkDateDraft = createDateDraft(today, state.language);
state.legalKind = 'ARITHMETIC_ONLY';
state.visaDatesEnabled = false;
state.visaDates = { valid_from: '', valid_until: '' };
state.visaDrafts = { valid_from: createDateDraft('', state.language), valid_until: createDateDraft('', state.language) };
const savedTrips = [...(restored.data?.trips ?? [])];
let restoringId;
const store = createStore({ planningDate: () => state.checkDate, makeId: () => restoringId ?? crypto.randomUUID() });
for (const trip of savedTrips) { restoringId = trip.id; store.saveTrip(trip); }
restoringId = null;
const results = new LatestResults();
const bridge = new PythonBridge({ onState: (status, code) => { state.runtime = status; state.runtimeError = code ?? null; render(); } });
function persist() { if (persistence.enabled) state.storageError = persistence.save(store.trips, state.language, state.theme); }
function request(method, extra = {}) { return bridge.request(calculationRequest(method, store.trips, state, extra)); }
function publish(key) {
  render();
  const value = results.values.get(key);
  const t = translator(state.language);
  if (value?.state === 'ready') {
    const status = value.result.status;
    announce(['WITHIN_RULE', 'VIOLATION', 'INVALID_INPUT', 'INSUFFICIENT_DATA', 'OUT_OF_SCOPE', 'HORIZON_LIMIT'].includes(status) ? t(`status.${status}`) : t('result.unknown'));
  } else if (value?.state === 'error') announce(t('state.error.title'));
}
function validDate() { return validateDateFields(document.querySelector('main')); }
function invalidateEvidence() {
  results.invalidate();
  const t = translator(state.language);
  document.querySelectorAll('[data-result-slot]').forEach(node => node.replaceChildren(computationState(t, 'empty')));
  document.querySelectorAll('.metrics').forEach(node => node.replaceWith(metrics({ t, store, results: results.values, language: state.language })));
}
function runHistory() {
  if (!validDate()) return;
  results.run('usage', () => request('usage_on'), render);
  results.run('history', () => request('check_history'), () => publish('history'));
}
function runScenario(item) {
  if (!validDate()) return;
  const method = { fixed: 'check_plan', maximum: 'max_continuous_stay', earliest: 'find_earliest_entry' }[item.mode];
  const extra = item.mode === 'fixed' ? { plan: { entry: item.entry, exit: item.exit } } : item.mode === 'maximum'
    ? { arrival: item.entry, horizon_days: item.horizon } : { search_start: item.entry, length_days: item.length, horizon_days: item.horizon };
  results.run(item.id, () => request(method, extra), () => publish(item.id));
}
function compareScenarios() {
  if (!validDate()) return;
  const scenarios = store.scenarios.filter(item => item.mode === 'fixed').map(({ entry, exit }) => ({ entry, exit }));
  results.run('comparison', () => request('compare_scenarios', { scenarios }), () => publish('comparison'));
}

const routes = { dashboard: views.dashboard, history: views.history, calculator: views.calculator, planner: views.planner, calendar: views.calendarPage, settings: views.settings, guide: views.guide };
let menuOpen = false;

function route() { return Object.hasOwn(routes, location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard'; }

function render(focus = false) {
  const active = document.activeElement;
  const activeId = active?.id;
  const editingDate = active?.closest('[data-date-field]');
  const selection = active?.matches('[data-date-text]') ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
  const activeFocus = active?.dataset.focus;
  const current = route();
  const t = translator(state.language);
  document.documentElement.lang = state.language;
  document.documentElement.dataset.theme = state.theme;
  document.title = `${t(`nav.${current}`)} · SchengenStay`;
  document.querySelector('.skip-link').textContent = t('app.skip');
  const ctx = {
    ...state, today, t, store, results: results.values, saving: persistence.enabled,
    analyticsAllowed: analyticsPreference.allowed, analyticsError: analyticsPreference.error,
    setAnalytics: allowed => { analyticsPreference.set(allowed); render(); document.getElementById('field-analytics')?.focus(); },
    busy: [...results.values.values()].some(item => item.state === 'loading'),
    runHistory, runScenario, compareScenarios,
    cancelCalculation: () => { results.invalidate(); bridge.cancel(); render(); },
    retryRuntime: () => { bridge.start().catch(() => {}); },
    setContext: (key, value) => { state[key] = value; results.invalidate(); render(); document.getElementById(`field-${key}`)?.focus(); },
    setSaving: enabled => { if (enabled) { persistence.enable(); persist(); } else state.storageError = persistence.disable(); render(); document.getElementById('field-saving')?.focus(); },
    openTrip: item => openEditor(ctx, 'trip', item),
    openScenario: item => openEditor(ctx, 'scenario', item),
    remove: (kind, item) => confirmRemoval(ctx, kind, item),
    changed: (message, historyChanged = false) => {
      if (historyChanged) { state.ongoing = false; state.complete = false; state.scope = 'UNKNOWN'; }
      results.invalidate(); persist(); render(); announce(historyChanged ? `${message} ${t('legal.reconfirm')}` : message);
    },
    setVisaDate: (name, value) => { state.visaDates[name] = value; invalidateEvidence(); },
    setBudget: value => { state.budget = value; invalidateEvidence(); },
    showMonth: month => {
      if (!month) return;
      const previous = document.activeElement?.dataset.focus;
      state.month = month;
      render();
      document.querySelector(`[data-focus="${previous}"]`)?.focus();
    },
    selectDay: day => {
      state.selectedDay = day;
      render();
      document.querySelector(`[data-date="${day}"]`)?.focus();
    },
    setCheckDate: day => {
      const wasOngoing = state.ongoing;
      state.checkDate = day;
      state.ongoing = false;
      // Invalidate evidence immediately without replacing the active date editor.
      invalidateEvidence();
      const ongoing = document.getElementById('field-ongoing');
      if (ongoing) ongoing.checked = false;
      if (wasOngoing) {
        const updated = { ...ctx, ...state };
        document.querySelectorAll('.calendar-widget').forEach(node => node.replaceWith(calendar(updated, Boolean(node.querySelector('.compact')))));
        document.querySelectorAll('.day-detail').forEach(node => node.replaceWith(views.selection(updated)));
      }
    },
    setLanguage: language => { if (!['en', 'ru'].includes(language)) return; state.language = language; persist(); render(); document.getElementById('field-language')?.focus(); },
    setTheme: theme => { state.theme = theme; persist(); render(); document.querySelector(`[data-focus="theme-${theme}"]`)?.focus(); },
  };
  const nav = h('nav', { id: 'main-navigation', 'aria-label': t('app.navigation') },
    Object.keys(routes).map(key => h('a', { href: `#${key}`, className: `nav-link ${key === current ? 'active' : ''} ${key === 'settings' ? 'nav-separator' : ''}`, 'aria-current': key === current ? 'page' : null }, icon(key), t(`nav.${key}`), key === current ? h('span', { className: 'active-dot', 'aria-hidden': 'true' }) : null)));
  nav.addEventListener('click', event => {
    if (menuOpen && event.target.closest('a')?.getAttribute('href') === `#${current}`) {
      menuOpen = false;
      render(true);
    }
  });
  const sidebar = h('aside', { className: 'sidebar' },
    h('a', { href: '#dashboard', className: 'brand', 'aria-label': 'SchengenStay' }, h('img', { src: './assets/mark.svg', alt: '', width: 38, height: 38 }), h('span', {}, 'Schengen', h('strong', {}, 'Stay'))),
    h('p', { className: 'sidebar-label' }, t('app.workspace')), nav,
    h('div', { className: 'sidebar-bottom' }, icon('globe'), h('p', {}, t('app.tagline')), h('span', { className: 'sidebar-preview' }, t('app.preview'))));
  const menuButton = button('', () => {
    menuOpen = !menuOpen;
    document.querySelector('.app-shell').classList.toggle('menu-open', menuOpen);
    menuButton.setAttribute('aria-expanded', String(menuOpen));
    if (menuOpen) nav.querySelector('a').focus();
  }, { kind: 'icon-button mobile-menu', symbol: 'menu', 'aria-controls': 'main-navigation', 'aria-expanded': String(menuOpen), 'aria-label': t('app.menu') });
  const main = h('main', { id: 'main', tabindex: '-1' }, routes[current](ctx),
    h('footer', { className: 'page-footer' }, h('p', {}, t('app.footer')), h('p', {}, t('app.legal')),
      h('a', { href: './THIRD_PARTY_NOTICES.txt', target: '_blank', rel: 'noopener noreferrer' }, t('app.licenses'))));
  const replacement = editingDate && main.querySelector(`#${CSS.escape(editingDate.id)}`);
  if (replacement && editingDate.dataset.language === state.language) replacement.replaceWith(editingDate);
  document.getElementById('app').replaceChildren(h('div', { className: `app-shell ${menuOpen ? 'menu-open' : ''}` }, sidebar,
    h('div', { className: 'workspace' },
      h('header', { className: 'topbar' }, h('div', { className: 'breadcrumb' }, menuButton, h('span', {}, t('app.workspace')), h('span', { 'aria-hidden': 'true' }, '/'), h('strong', {}, t(`nav.${current}`))),
        h('div', { className: 'topbar-meta' }, h('span', { className: 'session-label' }, icon('shield'), t('app.session')), h('span', { className: 'badge preview' }, t('app.preview')))),
      h('div', { className: 'session-notice' }, icon('guide'), t('app.notice'), ' ', t(persistence.enabled ? 'storage.enabled' : 'storage.disabled')), main)));
  if (focus) main.querySelector('h1').focus();
  else if (editingDate?.isConnected && active?.isConnected) {
    active.focus({ preventScroll: true });
    if (selection) active.setSelectionRange(...selection);
  }
  else if (active && !active.isConnected) {
    if (activeId) document.getElementById(activeId)?.focus();
    else if (activeFocus) document.querySelector(`[data-focus="${CSS.escape(activeFocus)}"]`)?.focus();
  }
}

window.addEventListener('hashchange', () => {
  if (location.hash === '#main') { document.getElementById('main').focus(); return; }
  menuOpen = false;
  render(true);
  window.scrollTo(0, 0);
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  document.getElementById('main').focus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuOpen) {
    menuOpen = false;
    document.querySelector('.app-shell').classList.remove('menu-open');
    const button = document.querySelector('.mobile-menu');
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  }
});
window.addEventListener('storage', event => {
  if (event.key !== ANALYTICS_KEY && event.key !== null) return;
  analyticsPreference.sync();
  if (route() === 'settings') render();
});
render();
