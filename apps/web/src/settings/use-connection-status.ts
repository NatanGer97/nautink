import { useCallback, useEffect, useState } from 'react';

import { checkConnection } from './health.ts';

import type { ConnectionStatus } from './health.ts';
import type { AgentId } from '@nautink/contracts/agents';

export interface ConnectionCheck {
  status: ConnectionStatus;
  recheck: () => void;
}

const CHECKING: ConnectionStatus = { kind: 'checking' };

/** Runs one check and hands the result to `onResult` unless the returned cancel ran first. */
function startCheck(agent: AgentId, onResult: (status: ConnectionStatus) => void): () => void {
  let isCurrent: boolean = true;
  const run = async (): Promise<void> => {
    const status: ConnectionStatus = await checkConnection(agent);
    if (isCurrent) {
      onResult(status);
    }
  };
  void run();
  return () => {
    isCurrent = false;
  };
}

/** One finished check: which agent and attempt it answers. */
interface CheckResult {
  agent: AgentId;
  attempt: number;
  status: ConnectionStatus;
}

/** Checks `agent`'s CLI each time `isActive` turns on, the agent changes, and on `recheck`. */
export function useConnectionStatus(isActive: boolean, agent: AgentId): ConnectionCheck {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [attempt, setAttempt] = useState<number>(0);
  useEffect(
    () =>
      isActive
        ? startCheck(agent, (status: ConnectionStatus) => {
            setResult({ agent, attempt, status });
          })
        : undefined,
    [isActive, agent, attempt],
  );
  const recheck: () => void = useCallback((): void => {
    setAttempt((previous) => previous + 1);
  }, []);
  // A result for another agent or an older attempt is stale: the new check is still running.
  const isCurrent: boolean = result?.agent === agent && result.attempt === attempt;
  return { status: isCurrent && result !== null ? result.status : CHECKING, recheck };
}
