import type { FlagValue, EvaluationContext, ConnectionStatus } from './types.js';
import type { Logger } from './logger.js';

interface StreamCallbacks {
  onSnapshot: (flags: Record<string, FlagValue>, configs: Record<string, unknown>) => void;
  onDiff: (changes: DiffChange[]) => void;
  onConnectionChange: (status: ConnectionStatus) => void;
  onError: (err: Error) => void;
  logger: Logger;
}

export interface DiffChange {
  type: 'flag' | 'config';
  key: string;
  value: FlagValue | unknown;
  deleted?: boolean;
}

const KEEPALIVE_INTERVAL = 30_000;
const PONG_TIMEOUT = 10_000;
const BACKOFF_BASE = 1000;
const BACKOFF_MAX = 30_000;

export class StreamTransport {
  private baseUrl: string;
  private token: string;
  private callbacks: StreamCallbacks;
  private ws: WebSocket | null = null;
  private intentionallyClosed = false;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private lastEnv?: string;
  private lastContext?: EvaluationContext;

  constructor(baseUrl: string, token: string, callbacks: StreamCallbacks) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.callbacks = callbacks;
  }

  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const wsUrl = this.baseUrl.replace(/^http/, 'ws') + `/stream/flags?token=${encodeURIComponent(this.token)}`;
      this.callbacks.logger.debug('WebSocket connecting', wsUrl);

      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const onOpen = () => {
        cleanup();
        this.reconnectAttempts = 0;
        this.callbacks.onConnectionChange('connected');
        this.startKeepalive();
        this.callbacks.logger.debug('WebSocket connected');
        resolve();
      };

      const onError = (event: Event) => {
        cleanup();
        const err = new Error('WebSocket connection failed');
        this.callbacks.logger.error('WebSocket connection error', err);
        reject(err);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('WebSocket closed before open'));
      };

      const cleanup = () => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        ws.removeEventListener('close', onClose);
        this.attachListeners(ws);
      };

      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
      ws.addEventListener('close', onClose);
    });
  }

  subscribe(env?: string, context?: EvaluationContext): void {
    this.lastEnv = env;
    this.lastContext = context;
    this.send({ type: 'subscribe', env, context });
  }

  updateContext(context: EvaluationContext): void {
    this.lastContext = context;
    this.send({ type: 'update-context', context });
  }

  close(): void {
    this.intentionallyClosed = true;
    this.stopKeepalive();
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.onConnectionChange('disconnected');
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private attachListeners(ws: WebSocket): void {
    ws.addEventListener('message', (event) => {
      this.handleMessage(event);
    });

    ws.addEventListener('close', () => {
      this.stopKeepalive();
      if (!this.intentionallyClosed) {
        this.callbacks.logger.warn('WebSocket closed unexpectedly, reconnecting');
        this.callbacks.onConnectionChange('reconnecting');
        this.scheduleReconnect();
      }
    });

    ws.addEventListener('error', () => {
      if (!this.intentionallyClosed) {
        this.callbacks.onError(new Error('WebSocket error'));
      }
    });
  }

  private handleMessage(event: MessageEvent): void {
    let msg: { type: string; flags?: Record<string, FlagValue>; configs?: Record<string, unknown>; changes?: DiffChange[]; error?: string };
    try {
      msg = JSON.parse(typeof event.data === 'string' ? event.data : '');
    } catch {
      this.callbacks.logger.warn('Failed to parse WebSocket message');
      return;
    }

    switch (msg.type) {
      case 'snapshot':
        this.callbacks.logger.debug('Received snapshot');
        this.callbacks.onSnapshot(msg.flags ?? {}, msg.configs ?? {});
        break;
      case 'diff':
        this.callbacks.logger.debug('Received diff', msg.changes);
        this.callbacks.onDiff(msg.changes ?? []);
        break;
      case 'pong':
        this.resetPongTimeout();
        break;
      case 'error':
        this.callbacks.onError(new Error(msg.error ?? 'Server error'));
        break;
    }
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      this.send({ type: 'ping' });
      this.pongTimer = setTimeout(() => {
        this.callbacks.logger.warn('Pong timeout, reconnecting');
        this.ws?.close();
      }, PONG_TIMEOUT);
    }, KEEPALIVE_INTERVAL);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    this.resetPongTimeout();
  }

  private resetPongTimeout(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(BACKOFF_BASE * Math.pow(2, this.reconnectAttempts), BACKOFF_MAX);
    this.reconnectAttempts++;
    this.callbacks.logger.debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        if (this.lastEnv || this.lastContext) {
          this.subscribe(this.lastEnv, this.lastContext);
        }
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
