import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdgeFlags } from '../src/client.js';

function mockFetchResponse(data: { flags: Record<string, unknown>; configs: Record<string, unknown> }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

type WSListener = (event: any) => void;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  private listeners = new Map<string, Set<WSListener>>();
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, fn: WSListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: WSListener) {
    this.listeners.get(type)?.delete(fn);
  }

  send(data: string) { this.sent.push(data); }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {});
  }

  emit(type: string, event: any) {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open', {});
  }

  simulateMessage(data: Record<string, unknown>) {
    this.emit('message', { data: JSON.stringify(data) });
  }

  simulateError() { this.emit('error', new Event('error')); }

  static instances: MockWebSocket[] = [];
  static reset() { MockWebSocket.instances = []; }
  static latest(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

describe('EdgeFlags client', () => {
  const originalFetch = globalThis.fetch;
  const originalWS = globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    (globalThis as any).WebSocket = originalWS;
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
      transport: 'polling',
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

  describe('WebSocket transport', () => {
    it('uses WebSocket when transport is websocket', async () => {
      (globalThis as any).WebSocket = MockWebSocket as any;

      const ef = new EdgeFlags({
        token: 'tok',
        baseUrl: 'http://localhost',
        transport: 'websocket',
      });

      const readyFn = vi.fn();
      ef.on('ready', readyFn);

      const initPromise = ef.init();

      // WS connects
      MockWebSocket.latest().simulateOpen();
      // Server sends snapshot after subscribe
      MockWebSocket.latest().simulateMessage({
        type: 'snapshot',
        flags: { dark: true },
        configs: { limit: 50 },
      });

      await initPromise;

      expect(readyFn).toHaveBeenCalledOnce();
      expect(ef.flag('dark')).toBe(true);
      expect(ef.config('limit')).toBe(50);
      expect(ef.connectionStatus).toBe('connected');
      ef.destroy();
    });

    it('falls back to polling when WebSocket fails', async () => {
      (globalThis as any).WebSocket = MockWebSocket as any;
      globalThis.fetch = mockFetchResponse({ flags: { a: 1 }, configs: {} });

      const ef = new EdgeFlags({
        token: 'tok',
        baseUrl: 'http://localhost',
        transport: 'websocket',
      });

      const initPromise = ef.init();
      MockWebSocket.latest().simulateError();
      await initPromise;

      expect(ef.isReady).toBe(true);
      expect(ef.flag('a')).toBe(1);
      ef.destroy();
    });

    it('transport: polling skips WebSocket entirely', async () => {
      (globalThis as any).WebSocket = MockWebSocket as any;
      globalThis.fetch = mockFetchResponse({ flags: { b: 2 }, configs: {} });

      const ef = new EdgeFlags({
        token: 'tok',
        baseUrl: 'http://localhost',
        transport: 'polling',
      });

      await ef.init();

      expect(MockWebSocket.instances).toHaveLength(0);
      expect(ef.flag('b')).toBe(2);
      ef.destroy();
    });

    it('identify sends update-context over WS when connected', async () => {
      (globalThis as any).WebSocket = MockWebSocket as any;

      const ef = new EdgeFlags({
        token: 'tok',
        baseUrl: 'http://localhost',
        transport: 'websocket',
      });

      const initPromise = ef.init();
      MockWebSocket.latest().simulateOpen();
      MockWebSocket.latest().simulateMessage({
        type: 'snapshot',
        flags: { x: 1 },
        configs: {},
      });
      await initPromise;

      const ws = MockWebSocket.latest();
      ws.sent = [];

      await ef.identify({ user_id: 'u2', custom: {} });

      expect(ws.sent).toHaveLength(1);
      expect(JSON.parse(ws.sent[0])).toEqual({
        type: 'update-context',
        context: { user_id: 'u2', custom: {} },
      });
      ef.destroy();
    });

    it('emits connection events on status changes', async () => {
      (globalThis as any).WebSocket = MockWebSocket as any;

      const ef = new EdgeFlags({
        token: 'tok',
        baseUrl: 'http://localhost',
        transport: 'websocket',
      });

      const connectionFn = vi.fn();
      ef.on('connection', connectionFn);

      const initPromise = ef.init();
      MockWebSocket.latest().simulateOpen();
      MockWebSocket.latest().simulateMessage({
        type: 'snapshot',
        flags: {},
        configs: {},
      });
      await initPromise;

      expect(connectionFn).toHaveBeenCalledWith({ status: 'connected' });
      ef.destroy();
    });
  });
});
