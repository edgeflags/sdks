import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdgeFlags } from '../src/client.js';

function mockFetchResponse(data: { flags: Record<string, unknown>; configs: Record<string, unknown> }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

describe('EdgeFlags client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('init fetches data and emits ready', async () => {
    globalThis.fetch = mockFetchResponse({
      flags: { dark: true },
      configs: { limit: 100 },
    });

    const ef = new EdgeFlags({
      token: 'tok',
      baseUrl: 'http://localhost',
    });

    const readyFn = vi.fn();
    ef.on('ready', readyFn);
    await ef.init();

    expect(readyFn).toHaveBeenCalledOnce();
    expect(ef.isReady).toBe(true);
    expect(ef.flag('dark')).toBe(true);
    expect(ef.config('limit')).toBe(100);
    ef.destroy();
  });

  it('flag returns default when key missing', async () => {
    globalThis.fetch = mockFetchResponse({ flags: {}, configs: {} });

    const ef = new EdgeFlags({ token: 'tok', baseUrl: 'http://localhost' });
    await ef.init();

    expect(ef.flag('missing')).toBeUndefined();
    expect(ef.flag('missing', false)).toBe(false);
    ef.destroy();
  });

  it('config returns default when key missing', async () => {
    globalThis.fetch = mockFetchResponse({ flags: {}, configs: {} });

    const ef = new EdgeFlags({ token: 'tok', baseUrl: 'http://localhost' });
    await ef.init();

    expect(ef.config('missing')).toBeUndefined();
    expect(ef.config('missing', 42)).toBe(42);
    ef.destroy();
  });

  it('emits change on poll when data changes', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const flags = callCount === 1
        ? { dark: true }
        : { dark: false };
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ flags, configs: {} }),
      });
    });

    const ef = new EdgeFlags({
      token: 'tok',
      baseUrl: 'http://localhost',
      pollingInterval: 1000,
    });

    const changeFn = vi.fn();
    ef.on('change', changeFn);
    await ef.init();

    // init triggers ready, but not change (first load)
    expect(changeFn).not.toHaveBeenCalled();

    // advance past first poll
    await vi.advanceTimersByTimeAsync(1000);

    expect(changeFn).toHaveBeenCalledOnce();
    expect(changeFn.mock.calls[0][0].flags).toEqual([
      { key: 'dark', previous: true, current: false },
    ]);
    expect(ef.flag('dark')).toBe(false);
    ef.destroy();
  });

  it('uses bootstrap data when init fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    const ef = new EdgeFlags({
      token: 'tok',
      baseUrl: 'http://localhost',
      bootstrap: { flags: { fallback: true }, configs: {} },
    });

    const readyFn = vi.fn();
    const errorFn = vi.fn();
    ef.on('ready', readyFn);
    ef.on('error', errorFn);

    await ef.init();

    expect(readyFn).toHaveBeenCalledOnce();
    expect(errorFn).toHaveBeenCalledOnce();
    expect(ef.flag('fallback')).toBe(true);
    ef.destroy();
  });

  it('throws on init failure without bootstrap', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    const ef = new EdgeFlags({ token: 'tok', baseUrl: 'http://localhost' });

    await expect(ef.init()).rejects.toThrow('network error');
    ef.destroy();
  });

  it('identify updates context and re-fetches', async () => {
    globalThis.fetch = mockFetchResponse({ flags: { a: 1 }, configs: {} });

    const ef = new EdgeFlags({
      token: 'tok',
      baseUrl: 'http://localhost',
    });
    await ef.init();

    globalThis.fetch = mockFetchResponse({ flags: { a: 2 }, configs: {} });
    await ef.identify({ user_id: 'new', custom: {} });

    expect(ef.flag('a')).toBe(2);
    ef.destroy();
  });

  it('allFlags and allConfigs return cache snapshots', async () => {
    globalThis.fetch = mockFetchResponse({
      flags: { a: true, b: 'x' },
      configs: { c: 1 },
    });

    const ef = new EdgeFlags({ token: 'tok', baseUrl: 'http://localhost' });
    await ef.init();

    expect(ef.allFlags()).toEqual({ a: true, b: 'x' });
    expect(ef.allConfigs()).toEqual({ c: 1 });
    ef.destroy();
  });

  it('destroy stops polling and clears state', async () => {
    globalThis.fetch = mockFetchResponse({ flags: { a: true }, configs: {} });

    const ef = new EdgeFlags({
      token: 'tok',
      baseUrl: 'http://localhost',
      pollingInterval: 1000,
    });
    await ef.init();

    ef.destroy();
    expect(ef.isReady).toBe(false);
    expect(ef.flag('a')).toBeUndefined();

    // polling should be stopped
    globalThis.fetch = vi.fn();
    await vi.advanceTimersByTimeAsync(2000);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
