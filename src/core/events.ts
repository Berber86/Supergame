/**
 * Простая шина событий для связи модулей (рендер, логика, сейв).
 * Классический pub/sub — без зависимостей.
 */

export type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<T>(event: string, listener: Listener<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  off<T>(event: string, listener: Listener<T>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<T>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}

/** Стандартные события игры. */
export const GameEvents = {
  stateChanged: 'state:changed',
  goldChanged: 'gold:changed',
  journalAdded: 'journal:added',
} as const;
