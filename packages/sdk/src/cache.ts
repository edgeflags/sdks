import type { FlagValue, ChangeEvent } from './types.js';

export class Cache {
  private flags = new Map<string, FlagValue>();
  private configs = new Map<string, unknown>();

  getFlag(key: string): FlagValue | undefined {
    return this.flags.get(key);
  }

  getConfig(key: string): unknown {
    return this.configs.get(key);
  }

  allFlags(): Record<string, FlagValue> {
    return Object.fromEntries(this.flags);
  }

  allConfigs(): Record<string, unknown> {
    return Object.fromEntries(this.configs);
  }

  update(
    flags: Record<string, FlagValue>,
    configs: Record<string, unknown>,
  ): ChangeEvent | null {
    const changes: ChangeEvent = { flags: [], configs: [] };

    for (const [key, current] of Object.entries(flags)) {
      const previous = this.flags.get(key);
      if (!deepEqual(previous, current)) {
        changes.flags.push({ key, previous, current });
      }
      this.flags.set(key, current);
    }

    for (const [key, current] of Object.entries(configs)) {
      const previous = this.configs.get(key);
      if (!deepEqual(previous, current)) {
        changes.configs.push({ key, previous, current });
      }
      this.configs.set(key, current);
    }

    if (changes.flags.length === 0 && changes.configs.length === 0) {
      return null;
    }
    return changes;
  }

  seed(flags: Record<string, FlagValue>, configs: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(flags)) {
      this.flags.set(key, value);
    }
    for (const [key, value] of Object.entries(configs)) {
      this.configs.set(key, value);
    }
  }

  clear(): void {
    this.flags.clear();
    this.configs.clear();
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}
