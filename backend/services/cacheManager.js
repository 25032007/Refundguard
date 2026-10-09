const EventEmitter = require('events');

class AsyncWorkerQueue extends EventEmitter {
  constructor(concurrency = 2) {
    super();
    this.concurrency = concurrency;
    this.queue = [];
    this.activeWorkers = 0;
  }

  enqueue(jobFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ jobFn, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) return;

    this.activeWorkers++;
    const { jobFn, resolve, reject } = this.queue.shift();

    try {
      const result = await jobFn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  size() {
    return this.queue.length;
  }
}

class CacheManager {
  constructor() {
    this.memoryStore = new Map();
    this.ttlStore = new Map();
    this.workerQueue = new AsyncWorkerQueue(4);
    this.stats = { hits: 0, misses: 0, setOperations: 0 };
  }

  async get(key) {
    const expiresAt = this.ttlStore.get(key);
    if (expiresAt && Date.now() > expiresAt) {
      this.del(key);
      this.stats.misses++;
      return null;
    }
    if (this.memoryStore.has(key)) {
      this.stats.hits++;
      return this.memoryStore.get(key);
    }
    this.stats.misses++;
    return null;
  }

  async set(key, value, ttlMs = 0) {
    this.stats.setOperations++;
    this.memoryStore.set(key, value);
    if (ttlMs > 0) {
      this.ttlStore.set(key, Date.now() + ttlMs);
    }
    return true;
  }

  async del(key) {
    this.memoryStore.delete(key);
    this.ttlStore.delete(key);
    return true;
  }

  async clear() {
    this.memoryStore.clear();
    this.ttlStore.clear();
    return true;
  }

  async queueJob(jobFn) {
    return this.workerQueue.enqueue(jobFn);
  }

  getStats() {
    return {
      ...this.stats,
      size: this.memoryStore.size,
      pendingJobs: this.workerQueue.size(),
      activeWorkers: this.workerQueue.activeWorkers,
    };
  }
}

module.exports = new CacheManager();
