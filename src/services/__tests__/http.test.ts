import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonClient, RateLimiter, TtlCache } from '@/services/http/client';

const makeClient = () =>
  new JsonClient({ limiter: new RateLimiter(20, 50), cache: new TtlCache(50), defaultTtlMs: 60_000, retries: 1 });

afterEach(() => vi.unstubAllGlobals());

describe('JsonClient', () => {
  it('caches responses instead of refetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ n: 1 }) });
    vi.stubGlobal('fetch', fetchMock);
    const client = makeClient();

    await client.get('https://example.test/a');
    await client.get('https://example.test/a');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates concurrent identical requests', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({ n: 2 }) }), 20)),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = makeClient();

    await Promise.all([
      client.get('https://example.test/b'),
      client.get('https://example.test/b'),
      client.get('https://example.test/b'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once then surfaces the failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', fetchMock);
    const client = makeClient();

    await expect(client.get('https://example.test/c')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('RateLimiter', () => {
  it('hands out at most its capacity without waiting', async () => {
    const limiter = new RateLimiter(3, 1);
    await limiter.take();
    await limiter.take();
    await limiter.take();
    expect(limiter.available).toBe(0);
  });
});

describe('TtlCache', () => {
  it('expires entries', () => {
    const cache = new TtlCache(10);
    cache.set('k', 'v', -1);
    expect(cache.get('k')).toBeUndefined();
  });
});
