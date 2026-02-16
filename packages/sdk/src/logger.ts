export class Logger {
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.debug(`[EdgeFlags] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.warn(`[EdgeFlags] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.error(`[EdgeFlags] ${message}`, ...args);
    }
  }
}
