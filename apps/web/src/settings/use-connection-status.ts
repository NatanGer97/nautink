import { useCallback, useEffect, useState } from 'react';

import { checkConnection } from './health.ts';

import type { ConnectionStatus } from './health.ts';

export interface ConnectionCheck {
  status: ConnectionStatus;
  recheck: () => void;
}

const CHECKING: ConnectionStatus = { kind: 'checking' };

/** Runs one check and hands the result to `onResult` unless the returned cancel ran first. */
function startCheck(onResult: (status: ConnectionStatus) => void): () => void {
  let isCurrent: boolean = true;
  const run = async (): Promise<void> => {
    const status: ConnectionStatus = await checkConnection();
    if (isCurrent) {
      onResult(status);
    }
  };
  void run();
  return () => {
    isCurrent = false;
  };
}

/** Checks the Claude Code connection each time `isActive` turns on, and on `recheck`. */
export function useConnectionStatus(isActive: boolean): ConnectionCheck {
  const [status, setStatus] = useState<ConnectionStatus>(CHECKING);
  const [attempt, setAttempt] = useState<number>(0);
  useEffect(() => (isActive ? startCheck(setStatus) : undefined), [isActive, attempt]);
  const recheck: () => void = useCallback((): void => {
    setStatus(CHECKING);
    setAttempt((previous) => previous + 1);
  }, []);
  return { status, recheck };
}
