import type { RunEvent } from "@openclaw/domain";

export interface ReplayLog {
  readonly runId: string;
  readonly events: readonly RunEvent[];
}

export function createReplayLog(runId: string, events: readonly RunEvent[]): ReplayLog {
  return {
    runId,
    events: events.map((event) => structuredClone(event))
  };
}
