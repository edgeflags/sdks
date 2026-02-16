import { describe, it, expect } from 'vitest';
import { Cache } from '../src/cache.js';

describe('Cache', () => {
  it('returns undefined for missing keys', () => {
    const cache = new Cache();
    expect(cache.getFlag('missing')).toBeUndefined();
    expect(cache.getConfig('missing')).toBeUndefined();
  });

  it('seeds and retrieves flags and configs', () => {
    const cache = new Cache();
    cache.seed(
      { dark: true, variant: 'a' },
      { limit: 100 },
    );

    expect(cache.getFlag('dark')).toBe(true);
    expect(cache.getFlag('variant')).toBe('a');
    expect(cache.getConfig('limit')).toBe(100);
  });

  it('returns all flags and configs', () => {
    const cache = new Cache();
    cache.seed({ a: 1, b: 2 }, { x: 'hello' });

    expect(cache.allFlags()).toEqual({ a: 1, b: 2 });
    expect(cache.allConfigs()).toEqual({ x: 'hello' });
  });

  it('update returns diff on changes', () => {
    const cache = new Cache();
    cache.seed({ a: true }, { x: 10 });

    const changes = cache.update({ a: false, b: 'new' }, { x: 10, y: 20 });

    expect(changes).not.toBeNull();
    expect(changes!.flags).toEqual([
      { key: 'a', previous: true, current: false },
      { key: 'b', previous: undefined, current: 'new' },
    ]);
    expect(changes!.configs).toEqual([
      { key: 'y', previous: undefined, current: 20 },
    ]);
  });

  it('update returns null when no changes', () => {
    const cache = new Cache();
    cache.seed({ a: true }, { x: 10 });

    const changes = cache.update({ a: true }, { x: 10 });
    expect(changes).toBeNull();
  });

  it('detects deep object changes', () => {
    const cache = new Cache();
    cache.seed({}, { cfg: { nested: { a: 1 } } });

    const changes = cache.update({}, { cfg: { nested: { a: 2 } } });
    expect(changes).not.toBeNull();
    expect(changes!.configs).toHaveLength(1);
    expect(changes!.configs[0].key).toBe('cfg');
  });

  it('returns null for identical deep objects', () => {
    const cache = new Cache();
    cache.seed({}, { cfg: { nested: { a: 1 } } });

    const changes = cache.update({}, { cfg: { nested: { a: 1 } } });
    expect(changes).toBeNull();
  });

  it('clears all data', () => {
    const cache = new Cache();
    cache.seed({ a: true }, { x: 10 });
    cache.clear();

    expect(cache.getFlag('a')).toBeUndefined();
    expect(cache.getConfig('x')).toBeUndefined();
    expect(cache.allFlags()).toEqual({});
    expect(cache.allConfigs()).toEqual({});
  });
});
