import type { EdgeFlagsEvent, EventPayloadMap } from './types.js';

type Listener<E extends EdgeFlagsEvent> = (payload: EventPayloadMap[E]) => void;

export class Emitter {
  private listeners = new Map<EdgeFlagsEvent, Set<Listener<never>>>();

  on<E extends EdgeFlagsEvent>(event: E, fn: Listener<E>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn as Listener<never>);

    return () => {
      this.listeners.get(event)?.delete(fn as Listener<never>);
    };
  }

  emit<E extends EdgeFlagsEvent>(event: E, payload: EventPayloadMap[E]): void {
    const fns = this.listeners.get(event);
    if (!fns) return;
    for (const fn of fns) {
      (fn as Listener<E>)(payload);
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
