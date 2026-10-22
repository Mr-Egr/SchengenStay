import { h, icon, button, announce } from './dom.js';
import { createStore } from './store.js';
import { todayISO } from './dates.js';
import { translator } from './i18n.js';
import { confirmRemoval, openEditor } from './components.js';
import * as views from './views.js';

const store = createStore();
const today = todayISO();
const state = { language: 'en', theme: 'light', month: today.slice(0, 7), selectedDay: today, checkDate: today };
const routes = { dashboard: views.dashboard, history: views.history, calculator: views.calculator, planner: views.planner, calendar: views.calendarPage, settings: views.settings, guide: views.guide };
let menuOpen = false;

function route() { return Object.hasOwn(routes, location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard'; }

function render(focus = false) {
  const current = route();
  const t = translator(state.language);
  document.documentElement.lang = state.language;
  document.documentElement.dataset.theme = state.theme;
  document.title = `${t(`nav.${current}`)} · SchengenStay`;
  document.querySelector('.skip-link').textContent = t('app.skip');
  const ctx = {
    ...state, today, t, store,
    openTrip: item => openEditor(ctx, 'trip', item),
    openScenario: item => openEditor(ctx, 'scenario', item),
    remove: (kind, item) => confirmRemoval(ctx, kind, item),
    changed: message => { render(); announce(message); },
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
      state.checkDate = day;
      render();
      const input = document.getElementById('field-checkDate');
      input.focus();
    },
    setLanguage: language => { if (!['en', 'ru'].includes(language)) return; state.language = language; render(); document.getElementById('field-language')?.focus(); },
    setTheme: theme => { state.theme = theme; render(); document.querySelector(`[data-focus="theme-${theme}"]`)?.focus(); },
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
    h('footer', { className: 'page-footer' }, h('p', {}, t('app.footer')), h('p', {}, t('app.legal'))));
  document.getElementById('app').replaceChildren(h('div', { className: `app-shell ${menuOpen ? 'menu-open' : ''}` }, sidebar,
    h('div', { className: 'workspace' },
      h('header', { className: 'topbar' }, h('div', { className: 'breadcrumb' }, menuButton, h('span', {}, t('app.workspace')), h('span', { 'aria-hidden': 'true' }, '/'), h('strong', {}, t(`nav.${current}`))),
        h('div', { className: 'topbar-meta' }, h('span', { className: 'session-label' }, icon('shield'), t('app.session')), h('span', { className: 'badge preview' }, t('app.preview')))),
      h('div', { className: 'session-notice' }, icon('guide'), t('app.notice')), main)));
  if (focus) main.querySelector('h1').focus();
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
render();
