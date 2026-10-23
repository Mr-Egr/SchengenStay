// No simulated initialization delay. An import failure never leaves a false loader.
import('./app.js').catch(() => {
  const section = document.createElement('section');
  section.className = 'boot';
  section.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.textContent = 'The workspace could not open.';
  const text = document.createElement('p');
  text.textContent = 'Check your connection and reload. Your travel records have not been sent anywhere.';
  const retry = document.createElement('button');
  retry.className = 'button secondary';
  retry.textContent = 'Reload interface';
  retry.addEventListener('click', () => location.reload());
  section.append(title, text, retry);
  document.getElementById('app').replaceChildren(section);
});

// Independent and disabled by default; never await analytics to open the workspace.
import('./analytics.js').then(({ startAnalytics }) => startAnalytics()).catch(() => {});
