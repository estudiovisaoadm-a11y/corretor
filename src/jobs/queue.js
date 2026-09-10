// Fila persistente de tarefas. O handler é mantido em memória; o estado da
// tarefa permanece no store, permitindo recuperar tarefas após reinício.
const crypto = require('crypto');

const STATES = ['queued', 'running', 'completed', 'failed'];

function id() { return `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`; }

class PersistentQueue {
  constructor(store, options = {}) {
    this.store = store;
    this.handlers = options.handlers || {};
    this.maxAttempts = options.maxAttempts || 3;
    this.leaseMs = options.leaseMs || 5 * 60 * 1000;
    this.running = new Map();
  }

  register(type, handler) { this.handlers[type] = handler; return this; }

  async enqueue(type, payload = {}, options = {}) {
    if (!this.handlers[type] && !options.allowUnregistered) throw new Error(`handler não registrado: ${type}`);
    return this.store.jobEnqueue({ id: id(), type, payload, maxAttempts: options.maxAttempts || this.maxAttempts, runAt: options.runAt || new Date().toISOString() });
  }

  async recover() {
    const cutoff = new Date(Date.now() - this.leaseMs).toISOString();
    return this.store.jobRecover(cutoff);
  }

  async processOne() {
    const job = await this.store.jobClaim(new Date().toISOString(), this.leaseMs);
    if (!job) return null;
    const handler = this.handlers[job.type];
    if (!handler) {
      await this.store.jobFail(job.id, `handler não registrado: ${job.type}`, true);
      return { ...job, state: 'failed', error: 'handler não registrado' };
    }
    this.running.set(job.id, true);
    try {
      const result = await handler(job.payload, job);
      await this.store.jobComplete(job.id, result);
      return { ...job, state: 'completed', result };
    } catch (error) {
      const retry = job.attempts < job.maxAttempts;
      await this.store.jobFail(job.id, error?.message || String(error), !retry);
      return { ...job, state: retry ? 'queued' : 'failed', error: error?.message || String(error) };
    } finally { this.running.delete(job.id); }
  }

  async start(options = {}) {
    await this.recover();
    if (this.timer) return this;
    const intervalMs = options.intervalMs || 1000;
    this.timer = setInterval(() => this.processOne().catch((e) => console.error('fila:', e.message)), intervalMs);
    if (this.timer.unref) this.timer.unref();
    return this;
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async list(filters) { return this.store.jobList(filters || {}); }
  async retry(jobId) { return this.store.jobRetry(jobId); }
}

module.exports = { PersistentQueue, STATES };
