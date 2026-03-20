import type { JudgeScenarioOutput } from "../../judge/src/admission-decision.js";
import type { ReplayLog } from "../../sandbox/src/replay-log.js";
import type { RunEvent, ScenarioDefinition, TrialProfile } from "../../domain/src/index.js";
import type { RunStore, StoredRun } from "./run-store.js";

export interface FinalizeRunInput {
  readonly store: RunStore;
  readonly runId: string;
  readonly profile: TrialProfile;
  readonly scenario: ScenarioDefinition;
  readonly events: readonly RunEvent[];
  readonly replay: ReplayLog;
  readonly judge: JudgeScenarioOutput;
}

export function finalizeRun(input: FinalizeRunInput): StoredRun {
  const storedRun = {
    runId: input.runId,
    profile: input.profile,
    scenario: input.scenario,
    events: structuredClone(input.events),
    replay: structuredClone(input.replay),
    judge: {
      summary: input.judge.summary,
      findings: structuredClone(input.judge.findings),
      redLineTriggered: input.judge.redLineTriggered
    },
    admission: structuredClone(input.judge.admission),
    measuredProfile: structuredClone(input.judge.measuredProfile)
  } satisfies StoredRun;

  input.store.saveRun(storedRun);
  return storedRun;
}
