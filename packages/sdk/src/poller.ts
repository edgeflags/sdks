export class Poller {
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private task: () => Promise<void>;
  private onError: (err: Error) => void;

  constructor(
    intervalMs: number,
    task: () => Promise<void>,
    onError: (err: Error) => void,
  ) {
    this.intervalMs = intervalMs;
    this.task = task;
    this.onError = onError;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        await this.task();
      } catch (err) {
        this.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get running(): boolean {
    return this.timer !== null;
  }
}
