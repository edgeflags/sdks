import { describe, it, expect, vi } from 'vitest';
import { Emitter } from '../src/emitter.js';

describe('Emitter', () => {
  it('calls listener on emit', () => {
    const emitter = new Emitter();
    const fn = vi.fn();
    emitter.on('ready', fn);
    emitter.emit('ready', undefined);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('passes payload to listener', () => {
    const emitter = new Emitter();
    const fn = vi.fn();
    emitter.on('error', fn);
    const err = new Error('test');
    emitter.emit('error', err);
    expect(fn).toHaveBeenCalledWith(err);
  });

  it('unsubscribes via returned function', () => {
    const emitter = new Emitter();
    const fn = vi.fn();
    const unsub = emitter.on('ready', fn);
    unsub();
    emitter.emit('ready', undefined);
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports multiple listeners', () => {
    const emitter = new Emitter();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on('ready', fn1);
    emitter.on('ready', fn2);
    emitter.emit('ready', undefined);
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('removeAll clears all listeners', () => {
    const emitter = new Emitter();
    const fn = vi.fn();
    emitter.on('ready', fn);
    emitter.on('error', fn);
    emitter.removeAll();
    emitter.emit('ready', undefined);
    emitter.emit('error', new Error('test'));
    expect(fn).not.toHaveBeenCalled();
  });

  it('emitting unknown event does not throw', () => {
    const emitter = new Emitter();
    expect(() => emitter.emit('change', { flags: [], configs: [] })).not.toThrow();
  });
});
