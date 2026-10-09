// A controllable `window.matchMedia` for jsdom, which has none. Tests flip queries with
// `setMediaQuery` and every subscribed list hears about it.
const matches = new Map<string, boolean>();
const listeners = new Map<string, Set<() => void>>();

export function setMediaQuery(query: string, isMatch: boolean): void {
  matches.set(query, isMatch);
  for (const listener of listeners.get(query) ?? []) {
    listener();
  }
}

export function resetMediaQueries(): void {
  matches.clear();
}

type EventListenerArgs = [type: string, listener: () => void];

function createList(query: string): MediaQueryList {
  const subscribers = listeners.get(query) ?? new Set<() => void>();
  listeners.set(query, subscribers);
  const list = {
    media: query,
    onchange: null,
    addEventListener: (...args: EventListenerArgs): unknown => subscribers.add(args[1]),
    removeEventListener: (...args: EventListenerArgs): unknown => subscribers.delete(args[1]),
    addListener: (listener: () => void): unknown => subscribers.add(listener),
    removeListener: (listener: () => void): unknown => subscribers.delete(listener),
    dispatchEvent: (): boolean => true,
  };
  Object.defineProperty(list, 'matches', { get: () => matches.get(query) ?? false });
  return list as unknown as MediaQueryList;
}

export function installMatchMedia(): void {
  window.matchMedia = createList;
}
