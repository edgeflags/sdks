import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamTransport } from '../src/stream.js';

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

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {});
  }

  emit(type: string, event: any) {
    for (const fn of this.listeners.get(type) ?? []) {
      fn(event);
    }
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.emit('open', {});
  }

  simulateMessage(data: Record<string, unknown>) {
    this.emit('message', { data: JSON.stringify(data) });
  }

  simulateError() {
    this.emit('error', new Event('error'));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', {});
  }

  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }
  static latest(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

function makeCallbacks() {
  return {
    onSnapshot: vi.fn(),
    onDiff: vi.fn(),
    onConnectionChange: vi.fn(),
    onError: vi.fn(),
    logger: {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any,
  };
}

describe('StreamTransport', () => {
  const originalWS = globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
    (globalThis as any).WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).WebSocket = originalWS;
  });

  it('connect resolves on open event', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    MockWebSocket.latest().simulateOpen();
    await p;

    expect(st.connected).toBe(true);
    expect(cbs.onConnectionChange).toHaveBeenCalledWith('connected');
    st.close();
  });

  it('connect rejects on initial error', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    MockWebSocket.latest().simulateError();

    await expect(p).rejects.toThrow('WebSocket connection failed');
    st.close();
  });

  it('connect rejects on initial close', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    MockWebSocket.latest().simulateClose();

    await expect(p).rejects.toThrow('WebSocket closed before open');
    st.close();
  });

  it('builds correct WebSocket URL with token', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('https://api.example.com', 'ff_dev_secret123', cbs);

    const p = st.connect();
    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    await p;

    expect(ws.url).toBe('wss://api.example.com/stream/flags?token=ff_dev_secret123');
    st.close();
  });

  it('subscribe sends correct JSON message', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    MockWebSocket.latest().simulateOpen();
    await p;

    st.subscribe('production', { user_id: 'u1', custom: {} });

    const sent = JSON.parse(MockWebSocket.latest().sent[0]);
    expect(sent).toEqual({
      type: 'subscribe',
      env: 'production',
      context: { user_id: 'u1', custom: {} },
    });
    st.close();
  });

  it('snapshot message triggers onSnapshot', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    await p;

    ws.simulateMessage({
      type: 'snapshot',
      flags: { dark: true },
      configs: { limit: 100 },
    });

    expect(cbs.onSnapshot).toHaveBeenCalledWith({ dark: true }, { limit: 100 });
    st.close();
  });

  it('diff message triggers onDiff', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    await p;

    const changes = [{ type: 'flag', key: 'dark', value: false }];
    ws.simulateMessage({ type: 'diff', changes });

    expect(cbs.onDiff).toHaveBeenCalledWith(changes);
    st.close();
  });

  it('error message triggers onError', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    await p;

    ws.simulateMessage({ type: 'error', error: 'bad request' });

    expect(cbs.onError).toHaveBeenCalledWith(new Error('bad request'));
    st.close();
  });

  it('sends ping on keepalive interval', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    MockWebSocket.latest().simulateOpen();
    await p;

    const ws = MockWebSocket.latest();
    ws.sent = [];

    await vi.advanceTimersByTimeAsync(30_000);

    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'ping' });
    st.close();
  });

  it('pong resets keepalive deadline', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    await p;

    await vi.advanceTimersByTimeAsync(30_000);
    ws.simulateMessage({ type: 'pong' });

    // Pong received — socket should NOT be closed after 10s
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ws.readyState).toBe(MockWebSocket.OPEN);
    st.close();
  });

  it('pong timeout triggers close', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    await p;

    await vi.advanceTimersByTimeAsync(30_000);
    // No pong — 10s timeout should close socket
    await vi.advanceTimersByTimeAsync(10_000);

    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    st.close();
  });

  it('reconnects on unexpected close with backoff', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    MockWebSocket.latest().simulateOpen();
    await p;

    st.subscribe('dev', { custom: {} });

    // Simulate unexpected close
    const initialCount = MockWebSocket.instances.length;
    MockWebSocket.latest().simulateClose();

    expect(cbs.onConnectionChange).toHaveBeenCalledWith('reconnecting');

    // First reconnect after 1s
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWebSocket.instances.length).toBe(initialCount + 1);

    // Fail again to test backoff
    MockWebSocket.latest().simulateError();
    await vi.advanceTimersByTimeAsync(2000);
    expect(MockWebSocket.instances.length).toBe(initialCount + 2);

    // Succeed reconnect
    MockWebSocket.latest().simulateOpen();
    // Flush microtasks so the async reconnect callback can call subscribe()
    await vi.advanceTimersByTimeAsync(0);

    expect(cbs.onConnectionChange).toHaveBeenCalledWith('connected');

    // Should resubscribe after reconnect
    const lastWs = MockWebSocket.latest();
    const subscribeMsgs = lastWs.sent.filter(s => JSON.parse(s).type === 'subscribe');
    expect(subscribeMsgs).toHaveLength(1);

    st.close();
  });

  it('updateContext sends correct message', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    MockWebSocket.latest().simulateOpen();
    await p;

    st.updateContext({ user_id: 'u2', custom: { plan: 'pro' } });

    const sent = JSON.parse(MockWebSocket.latest().sent[0]);
    expect(sent).toEqual({
      type: 'update-context',
      context: { user_id: 'u2', custom: { plan: 'pro' } },
    });
    st.close();
  });

  it('close cleans up all timers and stops reconnection', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    MockWebSocket.latest().simulateOpen();
    await p;

    st.close();

    expect(st.connected).toBe(false);
    expect(cbs.onConnectionChange).toHaveBeenCalledWith('disconnected');

    // No reconnection attempts
    const count = MockWebSocket.instances.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(MockWebSocket.instances.length).toBe(count);
  });

  it('ignores malformed messages', async () => {
    const cbs = makeCallbacks();
    const st = new StreamTransport('http://localhost', 'tok', cbs);

    const p = st.connect();
    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    await p;

    ws.emit('message', { data: 'not json{' });

    expect(cbs.onSnapshot).not.toHaveBeenCalled();
    expect(cbs.onDiff).not.toHaveBeenCalled();
    expect(cbs.logger.warn).toHaveBeenCalledWith('Failed to parse WebSocket message');
    st.close();
  });
});
