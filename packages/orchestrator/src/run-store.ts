import type { AdmissionResult } from "../../domain/src/admission.js";
import type { TrialProfile } from "../../domain/src/builds.js";
import type { RunEvent } from "../../domain/src/events.js";
import type { MeasuredProfile, JudgeResult } from "../../domain/src/judging.js";
import type { ScenarioDefinition } from "../../domain/src/scenarios.js";
import type { ReplayLog } from "../../sandbox/src/replay-log.js";

export interface StoredRun {
  readonly runId: string;
  readonly profile: TrialProfile;
  readonly scenario: ScenarioDefinition;
  readonly events: readonly RunEvent[];
  readonly replay: ReplayLog;
  readonly judge: JudgeResult;
  readonly admission: AdmissionResult;
  readonly measuredProfile: MeasuredProfile;
}

export interface RunStore {
  nextRunId(): string;
  saveRun(run: StoredRun): void;
  getRun(runId: string): StoredRun | undefined;
}

export function createInMemoryRunStore(): RunStore {
  let runCount = 0;
  const runs = new Map<string, StoredRun>();

  return {
    nextRunId() {
      runCount += 1;
      return `run-${String(runCount).padStart(4, "0")}`;
    },
    saveRun(run) {
      runs.set(run.runId, structuredClone(run));
    },
    getRun(runId) {
      const run = runs.get(runId);
      return run ? structuredClone(run) : undefined;
    }
  };
}
