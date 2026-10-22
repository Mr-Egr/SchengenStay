export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'className') element.className = value;
    else if (['value', 'checked', 'disabled', 'hidden', 'selected'].includes(key)) element[key] = value;
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  return element;
}

const paths = {
  dashboard: ['M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
  history: ['M5 4h14v17H5z M9 2v4 M15 2v4 M8 10h8 M8 14h5'],
  calculator: ['M6 3h12v18H6z M9 7h6 M9 12h.01 M15 12h.01 M9 16h.01 M15 16h.01'],
  planner: ['m21 3-6 18-4-8-8-4Z M11 13 21 3'],
  calendar: ['M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h.01 M12 14h.01 M16 14h.01 M8 17h.01 M12 17h.01'],
  settings: ['M4 7h16 M4 17h16 M8 4v6 M16 14v6'],
  guide: ['M12 17v-5 M12 8h.01', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'],
  plus: ['M12 5v14 M5 12h14'], arrow: ['M5 12h14 M13 6l6 6-6 6'],
  left: ['m14 6-6 6 6 6'], right: ['m10 6 6 6-6 6'], close: ['m6 6 12 12 M6 18 18 6'],
  shield: ['m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6Z M8 12l3 3 5-6'],
  globe: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2c6 5 6 15 0 20 M12 2c-6 5-6 15 0 20'],
  lock: ['M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3'],
  menu: ['M4 6h16 M4 12h16 M4 18h16'], sun: ['M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  moon: ['M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z'], edit: ['m15 4 5 5 M4 20l5-1L21 7l-4-4L5 15Z'],
  remove: ['M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 10v7 M14 10v7'],
};

export function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: `icon ${className}` })) svg.setAttribute(key, value);
  for (const d of paths[name] ?? paths.guide) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function button(label, onClick, { kind = 'secondary', symbol, ...attributes } = {}) {
  return h('button', { type: 'button', className: `button ${kind}`, onClick, ...attributes }, symbol ? icon(symbol) : null, label);
}

export function link(label, href, className = 'text-link', symbol = 'arrow') {
  return h('a', { href, className }, label, symbol ? icon(symbol) : null);
}

export function field(name, label, { type = 'text', value = '', hint, options, ...attributes } = {}) {
  const id = `field-${name}`;
  const control = options
    ? h('select', { id, name, value, ...attributes }, options.map(([key, title]) => h('option', { value: key }, title)))
    : h(type === 'textarea' ? 'textarea' : 'input', { id, name, type: type === 'textarea' ? null : type, value, ...attributes });
  control.setAttribute('aria-describedby', `${id}-hint ${id}-error`);
  return h('div', { className: 'field' }, h('label', { for: id }, label), control,
    h('small', { id: `${id}-hint`, className: 'hint' }, hint ?? ''),
    h('small', { id: `${id}-error`, className: 'field-error' }));
}

export function showErrors(form, issues, t) {
  form.querySelectorAll('[aria-invalid]').forEach(control => control.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach(node => { node.textContent = ''; });
  const summary = form.querySelector('.form-error');
  summary.textContent = Object.keys(issues).length ? t(issues.form ?? 'feedback.errors') : '';
  for (const [name, code] of Object.entries(issues)) {
    const control = form.elements.namedItem(name);
    if (control) {
      control.setAttribute('aria-invalid', 'true');
      form.querySelector(`#field-${name}-error`).textContent = t(code);
    }
  }
  if (Object.keys(issues).length) (form.querySelector('[aria-invalid]') ?? summary).focus();
}

export function announce(message) {
  const target = document.getElementById('announcer');
  target.textContent = '';
  requestAnimationFrame(() => { target.textContent = message; });
}
