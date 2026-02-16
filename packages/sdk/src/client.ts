import type {
  FlagValue,
  EvaluationContext,
  EdgeFlagsOptions,
  EdgeFlagsEvent,
  EventPayloadMap,
  ConnectionStatus,
} from './types.js';
import { EdgeFlagsError } from './errors.js';
import { Logger } from './logger.js';
import { Emitter } from './emitter.js';
import { Cache } from './cache.js';
import { Fetcher } from './fetcher.js';
import { Poller } from './poller.js';
import { StreamTransport, type DiffChange } from './stream.js';

interface MockData {
  flags: Record<string, FlagValue>;
  configs: Record<string, unknown>;
}

const DEFAULT_CONTEXT: EvaluationContext = { custom: {} };
const DEFAULT_POLL_INTERVAL = 60_000;

export class EdgeFlags {
  private cache: Cache;
  private emitter: Emitter;
  private logger: Logger;
  private fetcher: Fetcher | null;
  private poller: Poller | null = null;
  private stream: StreamTransport | null = null;
  private context: EvaluationContext;
  private pollingInterval: number;
  private transportMode: 'websocket' | 'polling';
  private ready = false;
  private mockData: MockData | null;
  private _connectionStatus: ConnectionStatus = 'disconnected';
  private baseUrl: string;
  private token: string;

  constructor(options: EdgeFlagsOptions) {
    const mock = (options as EdgeFlagsOptions & { _mock?: MockData })._mock ?? null;
    this.mockData = mock;
    this.cache = new Cache();
    this.emitter = new Emitter();
    this.logger = new Logger(options.debug ?? false);
    this.context = options.context ?? { ...DEFAULT_CONTEXT };
    this.pollingInterval = options.pollingInterval ?? DEFAULT_POLL_INTERVAL;
    this.transportMode = options.transport ?? 'websocket';
    this.baseUrl = options.baseUrl;
    this.token = options.token;

    if (mock) {
      this.fetcher = null;
      this.cache.seed(mock.flags, mock.configs);
      this.ready = true;
      this.logger.debug('Mock client created');
    } else {
      this.fetcher = new Fetcher(options.baseUrl, options.token);
      if (options.bootstrap) {
        this.cache.seed(
          options.bootstrap.flags ?? {},
          options.bootstrap.configs ?? {},
        );
        this.logger.debug('Bootstrap data loaded');
      }
    }
  }

  async init(): Promise<void> {
    if (this.mockData) {
      this.emitter.emit('ready', undefined);
      return;
    }

    if (this.transportMode !== 'polling') {
      try {
        await this.initStream();
        return;
      } catch {
        this.logger.warn('WebSocket unavailable, falling back to polling');
      }
    }

    await this.initPolling();
  }

  private async initStream(): Promise<void> {
    const snapshotReceived = new Promise<void>((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Snapshot timeout'));
        }
      }, 10_000);

      this.stream = new StreamTransport(this.baseUrl, this.token, {
        onSnapshot: (flags, configs) => {
          const changes = this.cache.update(flags, configs);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.cache.seed(flags, configs);
            resolve();
          } else if (changes) {
            this.logger.debug('Stream snapshot changes', changes);
            this.emitter.emit('change', changes);
          }
        },
        onDiff: (diffChanges) => {
          this.applyDiff(diffChanges);
        },
        onConnectionChange: (status) => {
          this._connectionStatus = status;
          this.emitter.emit('connection', { status });
        },
        onError: (err) => {
          this.logger.error('Stream error', err);
          this.emitter.emit('error', err);
        },
        logger: this.logger,
      });
    });

    await this.stream!.connect();
    this.stream!.subscribe(this.context.environment, this.context);
    await snapshotReceived;

    this.ready = true;
    this.logger.debug('Initialized via WebSocket');
    this.emitter.emit('ready', undefined);
  }

  private async initPolling(): Promise<void> {
    try {
      await this.fetchAndSeed();
      this.ready = true;
      this.logger.debug('Initialized');
      this.emitter.emit('ready', undefined);

      this.poller = new Poller(
        this.pollingInterval,
        () => this.refresh(),
        (err) => {
          this.logger.error('Polling error', err);
          this.emitter.emit('error', err);
        },
      );
      this.poller.start();
      this.logger.debug(`Polling started (${this.pollingInterval}ms)`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Init failed', error);
      this.emitter.emit('error', error);

      if (this.cache.allFlags() && Object.keys(this.cache.allFlags()).length > 0) {
        this.ready = true;
        this.logger.warn('Using bootstrap data after init failure');
        this.emitter.emit('ready', undefined);
      } else {
        throw error;
      }
    }
  }

  private applyDiff(changes: DiffChange[]): void {
    const flags: Record<string, FlagValue> = {};
    const configs: Record<string, unknown> = {};

    for (const change of changes) {
      if (change.type === 'flag') {
        flags[change.key] = change.value as FlagValue;
      } else if (change.type === 'config') {
        configs[change.key] = change.value;
      }
    }

    const existing = { ...this.cache.allFlags(), ...flags };
    const existingConfigs = { ...this.cache.allConfigs(), ...configs };
    const cacheChanges = this.cache.update(existing, existingConfigs);

    if (cacheChanges) {
      this.logger.debug('Diff changes detected', cacheChanges);
      this.emitter.emit('change', cacheChanges);
    }
  }

  flag(key: string): FlagValue | undefined;
  flag<T extends FlagValue>(key: string, defaultValue: T): T;
  flag(key: string, defaultValue?: FlagValue): FlagValue | undefined {
    const value = this.cache.getFlag(key);
    if (value === undefined) return defaultValue;
    return value;
  }

  config(key: string): unknown;
  config<T>(key: string, defaultValue: T): T;
  config(key: string, defaultValue?: unknown): unknown {
    const value = this.cache.getConfig(key);
    if (value === undefined) return defaultValue;
    return value;
  }

  allFlags(): Record<string, FlagValue> {
    return this.cache.allFlags();
  }

  allConfigs(): Record<string, unknown> {
    return this.cache.allConfigs();
  }

  async identify(context: EvaluationContext): Promise<void> {
    this.context = context;
    this.logger.debug('Context updated', context);
    if (this.ready && this.stream?.connected) {
      this.stream.updateContext(context);
    } else if (this.ready && this.fetcher) {
      await this.refresh();
    }
  }

  async refresh(): Promise<void> {
    if (!this.fetcher) return;

    this.logger.debug('Fetching evaluations');
    const data = await this.fetcher.fetchAll(this.context);
    const changes = this.cache.update(data.flags, data.configs);

    if (changes) {
      this.logger.debug('Changes detected', changes);
      this.emitter.emit('change', changes);
    }
  }

  private async fetchAndSeed(): Promise<void> {
    if (!this.fetcher) return;

    this.logger.debug('Fetching initial evaluations');
    const data = await this.fetcher.fetchAll(this.context);
    this.cache.seed(data.flags, data.configs);
  }

  on<E extends EdgeFlagsEvent>(
    event: E,
    fn: (payload: EventPayloadMap[E]) => void,
  ): () => void {
    return this.emitter.on(event, fn);
  }

  get isReady(): boolean {
    return this.ready;
  }

  get connectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  destroy(): void {
    this.stream?.close();
    this.stream = null;
    this.poller?.stop();
    this.poller = null;
    this.cache.clear();
    this.emitter.removeAll();
    this.ready = false;
    this._connectionStatus = 'disconnected';
    this.logger.debug('Destroyed');
  }
}
