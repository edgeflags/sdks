import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { EdgeFlags } from '../src/client.js';

describe('Integration: init -> poll -> change cycle', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('full lifecycle: init, poll, detect change, destroy', async () => {
    const responses = [
      { flags: { feature: true, beta: 'a' }, configs: { rate: 10 } },
      { flags: { feature: true, beta: 'a' }, configs: { rate: 10 } }, // no change
      { flags: { feature: false, beta: 'b' }, configs: { rate: 20 } }, // change
    ];

    let callIdx = 0;
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responses[Math.min(callIdx++, responses.length - 1)]),
      }),
    );

    const ef = new EdgeFlags({
      token: 'ff_test_123',
      baseUrl: 'https://edgeflags.net',
      pollingInterval: 5000,
      transport: 'polling',
      context: { user_id: 'u1', custom: {} },
    });

    const events: string[] = [];
    ef.on('ready', () => events.push('ready'));
    ef.on('change', () => events.push('change'));
    ef.on('error', () => events.push('error'));

    // Init
    await ef.init();
    expect(events).toEqual(['ready']);
    expect(ef.flag('feature')).toBe(true);
    expect(ef.flag('beta')).toBe('a');
    expect(ef.config('rate')).toBe(10);

    // First poll - no change
    await vi.advanceTimersByTimeAsync(5000);
    expect(events).toEqual(['ready']);

    // Second poll - change detected
    await vi.advanceTimersByTimeAsync(5000);
    expect(events).toEqual(['ready', 'change']);
    expect(ef.flag('feature')).toBe(false);
    expect(ef.flag('beta')).toBe('b');
    expect(ef.config('rate')).toBe(20);

    // Destroy
    ef.destroy();
    expect(ef.isReady).toBe(false);
    expect(ef.flag('feature')).toBeUndefined();
  });
});
