import test from 'node:test';
import assert from 'node:assert/strict';
import { PythonBridge, LatestResults, calculationRequest } from '../../web/scripts/pyodide-bridge.js';
import { createPersistence, decodeSaved, STORAGE_KEY, STORAGE_LIMIT } from '../../web/scripts/storage.js';
import { createStore } from '../../web/scripts/store.js';
import { recordsOnDate } from '../../web/scripts/dates.js';
import { codeText } from '../../web/scripts/results.js';
import { translator } from '../../web/scripts/i18n.js';

const trip = { id: 'a', kind: 'completed', entry: '2024-01-01', exit: '2024-01-02', label: '<script>text</script>', note: 'private test note' };
const saved = { schema_version: 1, consent: true, trips: [trip], language: 'en', theme: 'dark' };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('request whitelists fields and excludes labels/notes from calculations', () => {
  const request = calculationRequest('check_history', [trip], { checkDate: '2024-01-02', complete: false, scope: 'UNKNOWN', ongoing: false, budget: 20 });
  assert.deepEqual(request.stays, [{ kind: 'completed', id: 'a', entry: trip.entry, exit: trip.exit }]);
  assert.equal(request.history_complete, false);
  assert.equal(request.scope, 'UNKNOWN');
  assert.equal(request.max_inspected_days, 20);
});

test('unexpected reason and validation codes have readable bilingual fallback text', () => {
  for (const language of ['en', 'ru']) {
    const ctx = { t: translator(language), language };
    assert.match(codeText(ctx, 'reason', 'FUTURE_CODE'), /FUTURE_CODE/);
    assert.match(codeText(ctx, 'issue', 'FUTURE_ISSUE'), /FUTURE_ISSUE/);
    assert.ok(codeText(ctx, 'reason', 'HISTORY_INCOMPLETE').length > 20);
  }
});

test('legal context uses only explicit fields and never persists visa details', () => {
  const context = { checkDate: '2024-03-31', scope: 'COUNTABLE_SHORT_STAYS', complete: true,
    legalKind: 'SHORT_STAY_VISA', visaDatesEnabled: true,
    visaDates: { valid_from: '2024-01-01', valid_until: '2024-12-31', passport: 'must not travel' } };
  const request = calculationRequest('check_history', [trip], context);
  assert.deepEqual(request.legal_context, { kind: 'SHORT_STAY_VISA', valid_from: '2024-01-01', valid_until: '2024-12-31' });
  assert.deepEqual(calculationRequest('check_history', [], { ...context, legalKind: 'UNKNOWN' }).legal_context, { kind: 'UNKNOWN' });
  assert.deepEqual(calculationRequest('check_history', [], { ...context, visaDatesEnabled: false }).legal_context, { kind: 'SHORT_STAY_VISA' });
  let stored;
  const persistence = createPersistence(() => ({ setItem: (key, value) => { stored = value; } }));
  persistence.enable(); persistence.save([trip], 'en', 'light');
  assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), ['consent', 'language', 'schema_version', 'theme', 'trips']);
  assert.doesNotMatch(stored, /legal_context|valid_from|valid_until|passport/);
});

test('ongoing model is explicit; calendar only marks through confirmed date', () => {
  const store = createStore({ today: '2024-03-31' });
  const ongoing = store.saveTrip({ ...trip, kind: 'ongoing', entry: '2024-03-01', exit: '' }).record;
  assert.equal(ongoing.exit, null);
  assert.equal(recordsOnDate([ongoing], '2024-03-15').length, 0);
  assert.equal(recordsOnDate([ongoing], '2024-03-31', '2024-03-31').length, 1);
  assert.equal(recordsOnDate([ongoing], '2024-04-01', '2024-03-31').length, 0);
  assert.ok(store.saveTrip({ ...trip, entry: '2024-03-10', exit: '2024-03-11' }).issues.entry);
});

test('storage requires opt-in and disabling removes only this app key', () => {
  const values = new Map([['unrelated', 'preserve']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const persistence = createPersistence(() => storage);
  assert.deepEqual(persistence.load('2026-10-23'), { data: null });
  persistence.save([trip], 'en', 'dark');
  assert.equal(values.has(STORAGE_KEY), false);
  persistence.enable();
  assert.equal(persistence.save([trip], 'en', 'dark'), null);
  const other = createPersistence(() => storage);
  assert.equal(other.load('2026-10-23').data.trips[0].note, trip.note);
  assert.equal(other.enabled, true);
  assert.equal(other.disable(), null);
  assert.equal(values.has(STORAGE_KEY), false);
  assert.equal(values.get('unrelated'), 'preserve');
});

test('stored schema is versioned, bounded, validated atomically', () => {
  assert.equal(decodeSaved(JSON.stringify(saved), '2026-10-23').trips[0].label, trip.label);
  for (const data of [{ ...saved, consent: false }, { ...saved, schema_version: 2 }, { ...saved, theme: 'bad' },
    { ...saved, trips: [trip, trip] }, { ...saved, trips: [{ ...trip, exit: '2024-02-30' }] },
    { ...saved, passport: 'not permitted' }, { ...saved, trips: [{ ...trip, token: 'not permitted' }] },
    { ...saved, trips: [{ ...trip, kind: 'ongoing', exit: trip.exit }] }]) {
    assert.throws(() => decodeSaved(JSON.stringify(data), '2026-10-23'));
  }
  assert.throws(() => decodeSaved('x'.repeat(STORAGE_LIMIT + 1)));
  assert.throws(() => decodeSaved('{'));
});

test('storage denial, quota and deletion errors are not silently treated as success', () => {
  const persistence = createPersistence(() => { throw new Error('denied'); });
  assert.equal(persistence.load().error, 'STORAGE_INVALID');
  assert.equal(persistence.enabled, false);
  persistence.enable();
  assert.equal(persistence.save([], 'en', 'light'), 'STORAGE_FAILED');
  assert.equal(persistence.disable(), 'STORAGE_DELETE_FAILED');
});

test('out-of-order results and errors never replace a newer result', async () => {
  const results = new LatestResults(), first = deferred(), second = deferred();
  const old = results.run('history', () => first.promise);
  const fresh = results.run('history', () => second.promise);
  second.resolve({ marker: 'new' }); await fresh;
  first.reject(new Error('old failure')); await old;
  assert.equal(results.values.get('history').result.marker, 'new');
  const third = deferred();
  const invalidated = results.run('history', () => third.promise);
  results.invalidate(); third.resolve({ marker: 'outdated' }); await invalidated;
  assert.equal(results.values.size, 0);
});

function fakeWorker() {
  return { messages: [], terminated: false, postMessage(value) { this.messages.push(value); }, terminate() { this.terminated = true; }, send(data) { this.onmessage({ data }); } };
}

test('worker transport maps IDs correctly, ignores unknown replies and rejects incompatible protocol', async () => {
  const worker = fakeWorker(), bridge = new PythonBridge({ workerFactory: () => worker });
  const start = bridge.start(); worker.send({ type: 'ready' }); await start;
  const first = bridge.request({ test: 1 }), second = bridge.request({ test: 2 }); await tick();
  const [a, b] = worker.messages;
  worker.send({ type: 'result', id: 999, response: {} });
  worker.send({ type: 'result', id: b.id, response: { schema_version: 1, result: { value: 2 } } });
  worker.send({ type: 'result', id: a.id, response: { schema_version: 1, result: { value: 1 } } });
  assert.deepEqual(await first, { value: 1 }); assert.deepEqual(await second, { value: 2 });
  const bad = bridge.request({}); await tick();
  worker.send({ type: 'result', id: worker.messages.at(-1).id, response: { schema_version: 2 } });
  await assert.rejects(bad, /PROTOCOL_ERROR/); bridge.cancel();
});

test('loading timeout, request timeout, cancellation, and retry terminate obsolete workers', async () => {
  const workers = [];
  const bridge = new PythonBridge({ workerFactory: () => { const worker = fakeWorker(); workers.push(worker); return worker; }, startupTimeout: 15, requestTimeout: 15 });
  await assert.rejects(bridge.start(), /LOAD_TIMEOUT/);
  assert.equal(workers[0].terminated, true);
  const retry = bridge.start(); workers[1].send({ type: 'ready' }); await retry;
  await assert.rejects(bridge.request({}), /REQUEST_TIMEOUT/);
  assert.equal(workers[1].terminated, true);
  const again = bridge.start(); bridge.cancel(); await assert.rejects(again, /CANCELLED/);
  workers[2].send({ type: 'ready' }); assert.equal(bridge.state, 'idle');
});

test('worker queue is bounded without turning overload into a domain result', async () => {
  const worker = fakeWorker(), bridge = new PythonBridge({ workerFactory: () => worker });
  const start = bridge.start(); worker.send({ type: 'ready' }); await start;
  const pending = Array.from({ length: 8 }, () => bridge.request({}).catch(error => error.message));
  await assert.rejects(bridge.request({}), /QUEUE_LIMIT/);
  bridge.cancel();
  assert.deepEqual(await Promise.all(pending), Array(8).fill('CANCELLED'));
});

test('obsolete worker errors cannot terminate a replacement worker', async () => {
  const workers = [];
  const bridge = new PythonBridge({ workerFactory: () => { const worker = fakeWorker(); workers.push(worker); return worker; } });
  try {
    const first = bridge.start(); workers[0].send({ type: 'ready' }); await first;
    bridge.cancel();
    const second = bridge.start(); workers[1].send({ type: 'ready' }); await second;
    workers[0].onerror({ preventDefault() {} });
    assert.equal(bridge.state, 'ready');
    assert.equal(workers[1].terminated, false);
  } finally { bridge.cancel(); }
});

test('cancellation between readiness and dispatch cannot send an old request to a new worker', async () => {
  const workers = [];
  const bridge = new PythonBridge({ workerFactory: () => { const worker = fakeWorker(); workers.push(worker); return worker; } });
  try {
    const ready = bridge.start(); workers[0].send({ type: 'ready' }); await ready;
    const old = bridge.request({ marker: 'obsolete' });
    const rejected = assert.rejects(old, /CANCELLED/);
    bridge.cancel();
    const retry = bridge.start(); workers[1].send({ type: 'ready' }); await retry;
    // Settle an erroneously forwarded request so a regression fails immediately.
    for (const message of workers[1].messages) workers[1].send({ type: 'result', id: message.id, response: { schema_version: 1, result: {} } });
    await rejected;
    assert.equal(workers[1].messages.length, 0);
    assert.equal(bridge.pending.size, 0);
  } finally { bridge.cancel(); }
});

test('a failed worker post clears the queue and permits recovery', async () => {
  const worker = fakeWorker();
  worker.postMessage = () => { throw new Error('DataCloneError'); };
  const bridge = new PythonBridge({ workerFactory: () => worker });
  try {
    const ready = bridge.start(); worker.send({ type: 'ready' }); await ready;
    await assert.rejects(bridge.request({}), /CALCULATION_FAILED/);
    assert.equal(bridge.pending.size, 0);
    assert.equal(bridge.state, 'error');
  } finally { bridge.cancel(); }
});
