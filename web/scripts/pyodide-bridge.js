// Transport lifecycle, distinct from the six Python arithmetic statuses.
export class PythonBridge {
  constructor({ workerFactory = () => new Worker(new URL('./python-worker.js', import.meta.url), { type: 'module' }), onState = () => {}, startupTimeout = 60000, requestTimeout = 30000 } = {}) {
    Object.assign(this, { workerFactory, onState, startupTimeout, requestTimeout });
    this.pending = new Map();
    this.sequence = 0;
    this.state = 'idle';
  }
  start() {
    if (this.state === 'ready') return Promise.resolve();
    if (this.state === 'loading') return this.initializing;
    this.state = 'loading';
    this.onState(this.state);
    this.initializing = new Promise((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
      try {
        const worker = this.workerFactory();
        this.worker = worker;
        worker.onmessage = ({ data }) => {
          if (worker !== this.worker) return;
          if (data.type === 'ready') {
            clearTimeout(this.startTimer);
            this.state = 'ready';
            this.onState(this.state);
            resolve();
          } else if (data.type === 'result') {
            const pending = this.pending.get(data.id);
            if (!pending) return;
            clearTimeout(pending.timer);
            this.pending.delete(data.id);
            if (data.response?.schema_version !== 1 || !data.response.result) pending.reject(new Error('PROTOCOL_ERROR'));
            else pending.resolve(data.response.result);
          } else if (data.type === 'failed') this.fail(data.code);
        };
        worker.onerror = event => { event.preventDefault?.(); this.fail('LOAD_FAILED'); };
        this.startTimer = setTimeout(() => this.fail('LOAD_TIMEOUT'), this.startupTimeout);
      } catch { this.fail('LOAD_FAILED'); }
    });
    return this.initializing;
  }
  async request(request) {
    await this.start();
    if (this.pending.size >= 8) throw new Error('QUEUE_LIMIT');
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => this.fail('REQUEST_TIMEOUT'), this.requestTimeout);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ type: 'calculate', id, request });
    });
  }
  fail(code) {
    clearTimeout(this.startTimer);
    this.worker?.terminate();
    this.worker = null;
    this.rejectStart?.(new Error(code));
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(code)); }
    this.pending.clear();
    this.state = code === 'CANCELLED' ? 'idle' : 'error';
    this.onState(this.state, code);
  }
  cancel() { this.fail('CANCELLED'); }
}

export function calculationRequest(method, trips, context, extra = {}) {
  return { schema_version: 1, method,
    stays: trips.map(trip => trip.kind === 'ongoing'
      ? { kind: 'ongoing', id: trip.id, entry: trip.entry }
      : { kind: 'completed', id: trip.id, entry: trip.entry, exit: trip.exit }),
    as_of: context.checkDate || null, scope: context.scope,
    history_complete: context.complete, ongoing_confirmed: context.ongoing,
    max_inspected_days: context.budget,
    ...(context.legalKind ? { legal_context: { kind: context.legalKind,
      ...(context.legalKind === 'SHORT_STAY_VISA' && context.visaDatesEnabled
        ? { valid_from: context.visaDates.valid_from, valid_until: context.visaDates.valid_until } : {}) } } : {}), ...extra };
}

// Each input change advances the revision immediately, even while startup awaits.
export class LatestResults {
  constructor() { this.revision = 0; this.values = new Map(); this.tokens = new Map(); }
  invalidate() { this.revision++; this.values.clear(); this.tokens.clear(); }
  async run(key, work, publish = () => {}) {
    const revision = this.revision, token = Symbol(key);
    this.tokens.set(key, token);
    this.values.set(key, { state: 'loading' });
    publish();
    try {
      const result = await work();
      if (revision !== this.revision || this.tokens.get(key) !== token) return;
      this.values.set(key, { state: 'ready', result });
    } catch (error) {
      if (revision !== this.revision || this.tokens.get(key) !== token) return;
      this.values.set(key, { state: 'error', code: error.message });
    }
    publish();
  }
}
