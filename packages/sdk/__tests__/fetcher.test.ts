import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Fetcher } from '../src/fetcher.js';
import { EdgeFlagsError } from '../src/errors.js';

describe('Fetcher', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST with auth header and context', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ flags: { dark: true }, configs: {} }),
    });
    globalThis.fetch = mockFetch;

    const fetcher = new Fetcher('https://api.example.com', 'ff_prod_abc');
    const context = { user_id: '42', custom: {} };
    const result = await fetcher.fetchAll(context);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/evaluate');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer ff_prod_abc');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({ context });
    expect(result).toEqual({ flags: { dark: true }, configs: {} });
  });

  it('strips trailing slash from baseUrl', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ flags: {}, configs: {} }),
    });
    globalThis.fetch = mockFetch;

    const fetcher = new Fetcher('https://api.example.com/', 'tok');
    await fetcher.fetchAll({ custom: {} });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/evaluate');
  });

  it('throws EdgeFlagsError on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    const fetcher = new Fetcher('https://api.example.com', 'bad_token');

    await expect(fetcher.fetchAll({ custom: {} })).rejects.toThrow(EdgeFlagsError);
    await expect(fetcher.fetchAll({ custom: {} })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
