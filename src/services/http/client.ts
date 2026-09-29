import { bump } from './telemetry';

/* ---------------------------- token bucket ------------------------------ */

export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity;
  }

  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSecond);
    this.last = now;
  }

  /** Resolves as soon as a token is available. Never rejects. */
  async take(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = ((1 - this.tokens) / this.refillPerSecond) * 1000;
    await new Promise((r) => setTimeout(r, Math.ceil(waitMs)));
    return this.take();
  }

  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/* -------------------------------- cache --------------------------------- */

interface CacheEntry {
  value: unknown;
  expires: number;
}

export class TtlCache {
  private map = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxEntries = 400,
    private readonly persistKey?: string,
  ) {
    if (persistKey) this.restore();
  }

  private restore() {
    try {
      const raw = localStorage.getItem(this.persistKey!);
      if (!raw) return;
      const rows = JSON.parse(raw) as Array<[string, CacheEntry]>;
      const now = Date.now();
      for (const [k, v] of rows) if (v.expires > now) this.map.set(k, v);
    } catch {
      /* ignore corrupt cache */
    }
  }

  private persist() {
    if (!this.persistKey) return;
    try {
      localStorage.setItem(this.persistKey, JSON.stringify([...this.map.entries()].slice(-this.maxEntries)));
    } catch {
      /* quota — drop persistence, keep memory cache */
    }
  }

  get<T>(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) {
      this.misses++;
      return undefined;
    }
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    bump('cacheHits');
    return hit.value as T;
  }

  set(key: string, value: unknown, ttlMs: number) {
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + ttlMs });
    this.persist();
  }

  delete(key: string) {
    this.map.delete(key);
    this.persist();
  }

  clear() {
    this.map.clear();
    if (this.persistKey) localStorage.removeItem(this.persistKey);
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  get size(): number {
    return this.map.size;
  }
}

/* ----------------------------- json fetcher ----------------------------- */

export interface JsonClientOptions {
  limiter: RateLimiter;
  cache: TtlCache;
  defaultTtlMs?: number;
  retries?: number;
}

export class JsonClient {
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly opts: JsonClientOptions) {}

  get cacheRef(): TtlCache {
    return this.opts.cache;
  }

  /**
   * Rate limited + cached + de-duplicated GET with exponential backoff.
   * Identical concurrent URLs share a single network round trip.
   */
  async get<T>(url: string, init?: { ttlMs?: number; signal?: AbortSignal }): Promise<T> {
    const cached = this.opts.cache.get<T>(url);
    if (cached !== undefined) return cached;

    const running = this.inflight.get(url);
    if (running) {
      bump('dedupedHits');
      return running as Promise<T>;
    }

    const task = this.run<T>(url, init?.signal)
      .then((value) => {
        this.opts.cache.set(url, value, init?.ttlMs ?? this.opts.defaultTtlMs ?? 5 * 60_000);
        return value;
      })
      .finally(() => this.inflight.delete(url));

    this.inflight.set(url, task);
    return task;
  }

  private async run<T>(url: string, signal?: AbortSignal): Promise<T> {
    const retries = this.opts.retries ?? 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      await this.opts.limiter.take();
      try {
        bump('requests');
        const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
        if (res.status === 429) {
          bump('rateLimited');
          throw new Error('rate_limit');
        }
        if (!res.ok) throw new Error(`http_${res.status}`);
        return (await res.json()) as T;
      } catch (err) {
        if (signal?.aborted) throw err;
        lastError = err;
        bump('errors');
        if (attempt < retries) {
          const backoff = 400 * 2 ** attempt + Math.random() * 200;
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('network');
  }
}
