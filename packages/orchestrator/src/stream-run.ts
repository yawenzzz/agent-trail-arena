import type { RunEvent } from "../../domain/src/events.js";
import type { RunStore } from "./run-store.js";

export interface StreamRunInput {
  readonly store: RunStore;
  readonly runId: string;
}

export async function* streamRun(input: StreamRunInput): AsyncGenerator<RunEvent> {
  const run = input.store.getRun(input.runId);

  if (!run) {
    throw new Error(`Unknown run: ${input.runId}`);
  }

  for (const event of run.events) {
    yield structuredClone(event);
  }
}
