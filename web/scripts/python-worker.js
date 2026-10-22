// Pin all runtime assets to one release. No user text is Python source.
const runtimeURL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
let handle;
const ready = (async () => {
  const { loadPyodide } = await import(`${runtimeURL}pyodide.mjs`);
  const python = await loadPyodide({ indexURL: runtimeURL, stdout: () => {}, stderr: () => {} });
  const response = await fetch(new URL('../python/schengenstay.zip', import.meta.url));
  if (!response.ok) throw new Error('Package unavailable');
  python.unpackArchive(await response.arrayBuffer(), 'zip');
  python.runPython('from schengenstay.browser import handle_json');
  handle = python.globals.get('handle_json');
  self.postMessage({ type: 'ready', version: python.version });
})();
ready.catch(() => self.postMessage({ type: 'failed', code: 'LOAD_FAILED' }));
self.onmessage = async ({ data }) => {
  if (data?.type !== 'calculate') return;
  try {
    await ready;
    const response = JSON.parse(handle(JSON.stringify(data.request)));
    self.postMessage({ type: 'result', id: data.id, response });
  } catch {
    // Never expose Python traces or travel records in logs or error messages.
    self.postMessage({ type: 'failed', id: data.id, code: 'CALCULATION_FAILED' });
  }
};
