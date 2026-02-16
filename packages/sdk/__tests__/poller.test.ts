import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Poller } from '../src/poller.js';

describe('Poller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls task at interval', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const poller = new Poller(1000, task, onError);

    poller.start();
    expect(poller.running).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(2);

    poller.stop();
    expect(poller.running).toBe(false);
  });

  it('calls onError when task throws', async () => {
    const err = new Error('fetch failed');
    const task = vi.fn().mockRejectedValue(err);
    const onError = vi.fn();
    const poller = new Poller(500, task, onError);

    poller.start();
    await vi.advanceTimersByTimeAsync(500);

    expect(onError).toHaveBeenCalledWith(err);
    expect(poller.running).toBe(true); // keeps running
    poller.stop();
  });

  it('does not double-start', () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const poller = new Poller(100, task, vi.fn());

    poller.start();
    poller.start();

    vi.advanceTimersByTime(100);
    expect(task).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it('stop is idempotent', () => {
    const poller = new Poller(100, vi.fn(), vi.fn());
    poller.stop();
    poller.stop();
    expect(poller.running).toBe(false);
  });
});
