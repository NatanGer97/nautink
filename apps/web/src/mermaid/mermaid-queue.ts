/**
 * One-at-a-time queue for Mermaid work. Mermaid keeps global diagram state, and overlapping
 * parse/render calls fail in odd ways. The preview, validation, the visual editors and history
 * thumbnails all go through here. A job must never enqueue another job and wait for it (deadlock).
 */
let chain: Promise<void> = Promise.resolve();

async function nextMacrotask(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function settle(run: Promise<unknown>): Promise<void> {
  try {
    await run;
  } catch {
    // The caller sees the failure through `run`; the queue only needs to move on.
  }
  // Let the caller read the result (e.g. a diagram's db) before the next job touches Mermaid.
  await nextMacrotask();
}

export async function enqueueMermaid<T>(job: () => T | Promise<T>): Promise<T> {
  const run: Promise<T> = (async (): Promise<T> => {
    await chain;
    return job();
  })();
  chain = settle(run);
  return run;
}
