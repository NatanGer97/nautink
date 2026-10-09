// An in-process `BroadcastChannel` for tests. Node's real one reaches every worker thread, so
// test files running in parallel would hear each other's apps; this one stays inside one file.
const channels = new Map<string, Set<LocalBroadcastChannel>>();

class LocalBroadcastChannel extends EventTarget {
  readonly name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    super();
    this.name = name;
    const peers = channels.get(name) ?? new Set<LocalBroadcastChannel>();
    peers.add(this);
    channels.set(name, peers);
  }

  postMessage(data: unknown): void {
    const peers = [...(channels.get(this.name) ?? [])].filter((peer) => peer !== this);
    setTimeout(() => {
      for (const peer of peers) {
        peer.onmessage?.(new MessageEvent('message', { data: structuredClone(data) }));
      }
    }, 0);
  }

  close(): void {
    channels.get(this.name)?.delete(this);
  }
}

export function installLocalBroadcastChannel(): void {
  globalThis.BroadcastChannel = LocalBroadcastChannel;
}
