// No simulated initialization delay. An import failure never leaves a false loader.
import('./app.js').catch(() => {
  const section = document.createElement('section');
  section.className = 'boot';
  section.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.textContent = 'The workspace could not open.';
  const text = document.createElement('p');
  text.textContent = 'Serve the web folder over local HTTP, then reload. Calculations are not connected in this preview.';
  const retry = document.createElement('button');
  retry.className = 'button secondary';
  retry.textContent = 'Reload interface';
  retry.addEventListener('click', () => location.reload());
  section.append(title, text, retry);
  document.getElementById('app').replaceChildren(section);
});
