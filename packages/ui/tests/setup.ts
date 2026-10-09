// jsdom lacks the layout APIs Radix measures with; observers that never fire are enough here.
class ResizeObserverStub {
  observe(): undefined {
    return undefined;
  }

  unobserve(): undefined {
    return undefined;
  }

  disconnect(): undefined {
    return undefined;
  }
}

globalThis.ResizeObserver = ResizeObserverStub;
