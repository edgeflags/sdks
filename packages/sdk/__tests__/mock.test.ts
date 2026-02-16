import { describe, it, expect, vi } from 'vitest';
import { createMockClient } from '../src/mock.js';

describe('createMockClient', () => {
  it('creates a ready client with seeded flags', () => {
    const client = createMockClient({
      flags: { dark: true, variant: 'a' },
      configs: { limit: 100 },
    });

    expect(client.isReady).toBe(true);
    expect(client.flag('dark')).toBe(true);
    expect(client.flag('variant')).toBe('a');
    expect(client.config('limit')).toBe(100);
  });

  it('init emits ready without network', async () => {
    const client = createMockClient({ flags: { a: 1 } });

    const readyFn = vi.fn();
    client.on('ready', readyFn);
    await client.init();

    expect(readyFn).toHaveBeenCalledOnce();
  });

  it('returns defaults for missing keys', () => {
    const client = createMockClient({});
    expect(client.flag('missing', false)).toBe(false);
    expect(client.config('missing', 42)).toBe(42);
  });

  it('does not start a poller', async () => {
    vi.useFakeTimers();
    const client = createMockClient({ flags: { a: true } });
    await client.init();

    vi.advanceTimersByTime(120_000);
    // no errors, no fetches
    expect(client.flag('a')).toBe(true);

    client.destroy();
    vi.useRealTimers();
  });
});
